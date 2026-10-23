import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeskQr, Prisma } from '@prisma/client';
import type {
  CreateDeskQrInput,
  DeskQrView,
  UpdateDeskQrInput,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { watToday } from '../../shared/common/wat';
import type { Env } from '../../shared/config/env.schema';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { QrService } from '../notifications/qr/qr.service';
import { newDeskToken, parseV1Token } from './desk-qr.tokens';

/** The only row's fixed key (see the Prisma model). */
const DESK = 'desk';

type DeskQrWithCreator = DeskQr & { createdBy: { fullName: string } | null };

/**
 * Reception's side of the desk QR: one QR for the whole VMC desk. Create it,
 * change where verification codes are emailed, replace it (the printed poster
 * stops working), disable/enable it, and render it for printing. Every change
 * is audit-logged through its domain event.
 */
@Injectable()
export class DeskQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly qr: QrService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** The URL printed in the QR. The app picks the visitor's language. */
  urlFor(token: string): string {
    const base = this.config.get('APP_PUBLIC_URL', { infer: true });
    return `${base.replace(/\/+$/, '')}/r/${token}`;
  }

  private toView(row: DeskQrWithCreator, now = new Date()): DeskQrView {
    return {
      id: row.id,
      isActive: row.isActive,
      url: this.urlFor(row.token),
      codeEmail: row.codeEmail,
      // The counter belongs to the WAT day it was last bumped on.
      scansToday: row.scanDay === watToday(now) ? row.scansToday : 0,
      lastScanAt: row.lastScanAt,
      tokenRotatedAt: row.tokenRotatedAt,
      disabledAt: row.disabledAt,
      createdAt: row.createdAt,
      createdByName: row.createdBy?.fullName ?? null,
    };
  }

  private find() {
    return this.prisma.deskQr.findUnique({
      where: { key: DESK },
      include: { createdBy: { select: { fullName: true } } },
    });
  }

  private async findOrThrow(): Promise<DeskQrWithCreator> {
    const row = await this.find();
    if (!row) throw new NotFoundException('errors.deskQr.notFound');
    return row;
  }

  /** The desk QR, or null before one has been created. */
  async get(): Promise<DeskQrView | null> {
    const row = await this.find();
    return row ? this.toView(row) : null;
  }

  async create(
    input: CreateDeskQrInput,
    actorUserId: string,
  ): Promise<DeskQrView> {
    if (await this.find()) throw new ConflictException('errors.deskQr.exists');
    const id = await this.txm.run(async (tx) => {
      const row = await tx.deskQr.create({
        data: {
          key: DESK,
          token: newDeskToken(),
          codeEmail: input.codeEmail,
          createdById: actorUserId,
        },
      });
      await this.publish(tx, EVENT_TYPES.DeskQrCreated, row.id, actorUserId, {
        codeEmail: row.codeEmail,
      });
      return row.id;
    });
    return this.toView(await this.reload(id));
  }

  /**
   * Cutover: take over the V1 issuer QR that is already printed at the desk, so
   * it keeps working in v2. Creates the desk QR or replaces its token.
   */
  async importV1(
    v1UrlOrToken: string,
    codeEmail: string,
    actorUserId?: string,
  ): Promise<DeskQrView> {
    const token = parseV1Token(v1UrlOrToken);
    if (!token) throw new BadRequestException('errors.deskQr.badV1Token');
    const id = await this.txm.run(async (tx) => {
      const row = await tx.deskQr.upsert({
        where: { key: DESK },
        create: {
          key: DESK,
          token,
          codeEmail,
          createdById: actorUserId ?? null,
        },
        update: {
          token,
          codeEmail,
          isActive: true,
          disabledAt: null,
          tokenRotatedAt: new Date(),
        },
      });
      await this.publish(tx, EVENT_TYPES.DeskQrImported, row.id, actorUserId, {
        codeEmail,
      });
      return row.id;
    });
    return this.toView(await this.reload(id));
  }

  async update(
    input: UpdateDeskQrInput,
    actorUserId: string,
  ): Promise<DeskQrView> {
    const current = await this.findOrThrow();
    await this.txm.run(async (tx) => {
      await tx.deskQr.update({
        where: { id: current.id },
        data: { codeEmail: input.codeEmail },
      });
      await this.publish(
        tx,
        EVENT_TYPES.DeskQrUpdated,
        current.id,
        actorUserId,
        { codeEmail: input.codeEmail },
      );
    });
    return this.toView(await this.reload(current.id));
  }

  /** New token. The printed poster (and any form still open) stops working. */
  async rotate(actorUserId: string): Promise<DeskQrView> {
    return this.change(
      EVENT_TYPES.DeskQrRotated,
      { token: newDeskToken(), tokenRotatedAt: new Date() },
      actorUserId,
    );
  }

  /** Scanning shows "please register at the desk" until enabled again. */
  async disable(actorUserId: string): Promise<DeskQrView> {
    return this.change(
      EVENT_TYPES.DeskQrDisabled,
      { isActive: false, disabledAt: new Date() },
      actorUserId,
    );
  }

  /** Brings back the same token, so the poster on the desk works again. */
  async enable(actorUserId: string): Promise<DeskQrView> {
    return this.change(
      EVENT_TYPES.DeskQrEnabled,
      { isActive: true, disabledAt: null },
      actorUserId,
    );
  }

  /** The QR as a PNG, large enough to print (V1 parity: Download PNG). */
  async png(size = 1024): Promise<Buffer> {
    const row = await this.findOrThrow();
    return this.qr.toPngBuffer(this.urlFor(row.token), { width: size });
  }

  private async change(
    type: string,
    data: Prisma.DeskQrUpdateInput,
    actorUserId: string,
  ): Promise<DeskQrView> {
    const current = await this.findOrThrow();
    await this.txm.run(async (tx) => {
      await tx.deskQr.update({ where: { id: current.id }, data });
      await this.publish(tx, type, current.id, actorUserId, {});
    });
    return this.toView(await this.reload(current.id));
  }

  private async reload(id: string): Promise<DeskQrWithCreator> {
    return this.prisma.deskQr.findUniqueOrThrow({
      where: { id },
      include: { createdBy: { select: { fullName: true } } },
    });
  }

  private publish(
    tx: Prisma.TransactionClient,
    type: string,
    id: string,
    actorUserId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    return this.events.publish(tx, {
      type,
      aggregateType: 'DeskQr',
      aggregateId: id,
      // The token never goes in the audit trail: it is the printed secret.
      payload: { deskQrId: id, ...payload },
      metadata: actorUserId ? { actorUserId } : {},
    });
  }
}
