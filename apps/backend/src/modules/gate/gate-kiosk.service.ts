import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type GateKiosk } from '@prisma/client';
import { GATE_KIOSK_TOKEN_RE, type GateKioskView } from '@vms/contracts';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../shared/config/env.schema';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { QrService } from '../notifications/qr/qr.service';

const KEY = 'gate';

type KioskWithCreator = GateKiosk & { createdBy: { fullName: string } | null };

export function newKioskToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * The gate kiosk link: the secret that lets a device open the no-login gate
 * page. One link, managed by the System Admin; rotating or disabling it cuts
 * off every device using the old one.
 */
@Injectable()
export class GateKioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly qr: QrService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  urlFor(token: string): string {
    const base = this.config.get('APP_PUBLIC_URL', { infer: true });
    return `${base.replace(/\/+$/, '')}/gate/${token}`;
  }

  /** Same answer for unknown, rotated and disabled links: never reveal which. */
  async activeKiosk(token: string): Promise<GateKiosk> {
    const kiosk = GATE_KIOSK_TOKEN_RE.test(token)
      ? await this.prisma.gateKiosk.findUnique({ where: { token } })
      : null;
    if (!kiosk?.isActive)
      throw new NotFoundException('errors.gateKiosk.notActive');
    return kiosk;
  }

  async get(): Promise<GateKioskView | null> {
    const row = await this.find();
    return row ? this.toView(row) : null;
  }

  async create(actorUserId: string): Promise<GateKioskView> {
    if (await this.find())
      throw new ConflictException('errors.gateKiosk.exists');
    const id = await this.txm
      .run(async (tx) => {
        const row = await tx.gateKiosk.create({
          data: { key: KEY, token: newKioskToken(), createdById: actorUserId },
        });
        await this.publish(
          tx,
          EVENT_TYPES.GateKioskCreated,
          row.id,
          actorUserId,
        );
        return row.id;
      })
      .catch((err: unknown) => {
        // Two concurrent creates both passed the check above; the unique key decides.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('errors.gateKiosk.exists');
        }
        throw err;
      });
    return this.toView(await this.reload(id));
  }

  rotate(actorUserId: string): Promise<GateKioskView> {
    return this.change(
      EVENT_TYPES.GateKioskRotated,
      { token: newKioskToken(), tokenRotatedAt: new Date() },
      actorUserId,
    );
  }

  disable(actorUserId: string): Promise<GateKioskView> {
    return this.change(
      EVENT_TYPES.GateKioskDisabled,
      { isActive: false, disabledAt: new Date() },
      actorUserId,
    );
  }

  enable(actorUserId: string): Promise<GateKioskView> {
    return this.change(
      EVENT_TYPES.GateKioskEnabled,
      { isActive: true, disabledAt: null },
      actorUserId,
    );
  }

  /** QR of the kiosk link, so the device can open it with its camera. */
  async png(size = 1024): Promise<Buffer> {
    const row = await this.find();
    if (!row) throw new NotFoundException('errors.gateKiosk.notFound');
    return this.qr.toPngBuffer(this.urlFor(row.token), { width: size });
  }

  private toView(row: KioskWithCreator): GateKioskView {
    return {
      id: row.id,
      isActive: row.isActive,
      url: this.urlFor(row.token),
      tokenRotatedAt: row.tokenRotatedAt,
      disabledAt: row.disabledAt,
      lastScanAt: row.lastScanAt,
      createdAt: row.createdAt,
      createdByName: row.createdBy?.fullName ?? null,
    };
  }

  private find() {
    return this.prisma.gateKiosk.findUnique({
      where: { key: KEY },
      include: { createdBy: { select: { fullName: true } } },
    });
  }

  private reload(id: string): Promise<KioskWithCreator> {
    return this.prisma.gateKiosk.findUniqueOrThrow({
      where: { id },
      include: { createdBy: { select: { fullName: true } } },
    });
  }

  private async change(
    type: string,
    data: Prisma.GateKioskUpdateInput,
    actorUserId: string,
  ): Promise<GateKioskView> {
    const current = await this.find();
    if (!current) throw new NotFoundException('errors.gateKiosk.notFound');
    await this.txm.run(async (tx) => {
      await tx.gateKiosk.update({ where: { id: current.id }, data });
      await this.publish(tx, type, current.id, actorUserId);
    });
    return this.toView(await this.reload(current.id));
  }

  private publish(
    tx: Prisma.TransactionClient,
    type: string,
    id: string,
    actorUserId: string,
  ) {
    return this.events.publish(tx, {
      type,
      aggregateType: 'GateKiosk',
      aggregateId: id,
      // The token never goes in the audit trail: it is the device's secret.
      payload: { gateKioskId: id },
      metadata: { actorUserId },
    });
  }
}
