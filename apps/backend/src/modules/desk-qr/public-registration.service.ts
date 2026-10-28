import {
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeskQr } from '@prisma/client';
import {
  DESK_QR_FORM_MINUTES,
  DESK_QR_TOKEN_RE,
  VISIT_SOURCE_DESK_QR,
  type DeskQrFormSession,
  type PublicHostOption,
  type PublicRegistrationInput,
  type PublicRegistrationResult,
} from '@vms/contracts';
import { hkdfSync } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../../shared/audit/security-audit.service';
import { watToday } from '../../shared/common/wat';
import type { Env } from '../../shared/config/env.schema';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { UsersService } from '../identity/users.service';
import { VisitAuthoringService } from '../visits/authoring.service';
import { generateReferenceCode } from '../visits/helpers/visit.codes';
import { formTokenValid, signFormToken } from './desk-qr.tokens';

/** Submissions per minute, across all phones (a leaked-link backstop beyond the per-IP limits). */
const MAX_SUBMISSIONS_PER_MINUTE = 30;

/** Scanning the QR opens a short-lived signed form; submitting it registers the walk-in immediately. */
@Injectable()
export class PublicRegistrationService {
  /** Keys form tokens; never the raw JWT secret itself. */
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visits: VisitAuthoringService,
    private readonly config: ConfigService<Env, true>,
    private readonly security: SecurityAuditService,
  ) {
    this.secret =
      config.get('DESK_QR_SECRET', { infer: true }) ??
      Buffer.from(
        hkdfSync(
          'sha256',
          config.get('JWT_SECRET', { infer: true }),
          '',
          'vms/desk-qr',
          32,
        ),
      ).toString('base64url');
  }

  private async activeQr(token: string): Promise<DeskQr> {
    const qr = DESK_QR_TOKEN_RE.test(token)
      ? await this.prisma.deskQr.findUnique({ where: { token } })
      : null;
    // Same answer for unknown, replaced and disabled codes: never reveal which.
    if (!qr?.isActive) throw new NotFoundException('errors.deskQr.notActive');
    return qr;
  }

  async open(token: string, now = new Date()): Promise<DeskQrFormSession> {
    const qr = await this.activeQr(token);
    const today = watToday(now);
    await this.prisma.deskQr.update({
      where: { id: qr.id },
      data: {
        scanDay: today,
        scansToday: qr.scanDay === today ? { increment: 1 } : 1,
        lastScanAt: now,
      },
    });
    const formExpiresAt = new Date(
      now.getTime() + DESK_QR_FORM_MINUTES * 60_000,
    );
    return {
      formToken: signFormToken(this.secret, qr.token, formExpiresAt),
      formExpiresAt,
      secondsLeft: DESK_QR_FORM_MINUTES * 60,
    };
  }

  private assertFormOpen(qrToken: string, formToken: string, now: Date): void {
    const form = formTokenValid(this.secret, qrToken, formToken, now);
    if (!form.ok) {
      throw form.reason === 'expired'
        ? new GoneException('errors.deskQr.formExpired')
        : new UnprocessableEntityException('errors.deskQr.formInvalid');
    }
  }

  async searchHosts(
    token: string,
    q: string,
    formToken: string,
    now = new Date(),
  ): Promise<PublicHostOption[]> {
    const qr = await this.activeQr(token);
    this.assertFormOpen(qr.token, formToken, now);
    return this.users.searchPublicHosts(q);
  }

  /** A filled-in honeypot gets a normal-looking answer and nothing else. */
  async submit(
    token: string,
    input: PublicRegistrationInput,
    now = new Date(),
  ): Promise<PublicRegistrationResult> {
    const qr = await this.activeQr(token);
    this.assertFormOpen(qr.token, input.formToken, now);
    if (input.website?.trim()) {
      return this.trapBot(qr, input, now);
    }

    const recent = await this.prisma.visit.count({
      where: {
        source: VISIT_SOURCE_DESK_QR,
        createdAt: { gte: new Date(now.getTime() - 60_000) },
      },
    });
    if (recent >= MAX_SUBMISSIONS_PER_MINUTE) {
      throw new HttpException(
        'errors.rateLimited',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (input.hostUserId && !(await this.users.isActiveHost(input.hostUserId)))
      throw new UnprocessableEntityException('errors.host.notStaff');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { formToken, website, ...stored } = input;
    return this.visits.createSelfRegisteredWalkIn(stored);
  }

  /**
   * A bot filled the hidden field. Return the same success shape a person
   * would see (a plausible reference code, nothing persisted), so automated
   * probing can't tell it was caught.
   */
  private async trapBot(
    qr: DeskQr,
    input: PublicRegistrationInput,
    now: Date,
  ): Promise<PublicRegistrationResult> {
    await this.security.record({
      action: EVENT_TYPES.DeskQrHoneypotTriggered,
      entityType: 'DeskQr',
      entityId: qr.id,
      metadata: { deskQrId: qr.id },
    });
    return {
      referenceCode: generateReferenceCode(),
      fullName: input.fullName,
      hostName: null,
      visitDate: now,
    };
  }
}
