import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, type DeskQr } from '@prisma/client';
import {
  DESK_QR_CODE_ATTEMPTS,
  DESK_QR_FORM_MINUTES,
  DESK_QR_TOKEN_RE,
  type DeskQrFormSession,
  type PublicHostOption,
  type PublicRegistrationInput,
  type PublicRegistrationPending,
  type PublicRegistrationResult,
} from '@vms/contracts';
import { hkdfSync, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../../shared/audit/security-audit.service';
import { formatWat, watToday } from '../../shared/common/wat';
import type { Env } from '../../shared/config/env.schema';
import { EncryptionService } from '../../shared/crypto/encryption.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { UsersService } from '../identity/users.service';
import { NotificationService } from '../notifications/notification.service';
import { NOTIFICATION_TEMPLATES } from '../notifications/notification.types';
import { VisitAuthoringService } from '../visits/authoring.service';
import {
  formTokenValid,
  hashVerificationCode,
  newVerificationCode,
  signFormToken,
  verificationCodeMatches,
} from './desk-qr.tokens';

/** Submissions per QR per minute, across all phones (a leaked link backstop). */
const MAX_SUBMISSIONS_PER_MINUTE = 30;
/** Unfinished registrations hold personal data: keep them only a day. */
const RETENTION_MS = 24 * 3_600_000;
const PURGE_INTERVAL_MS = 3_600_000;

type StoredForm = Omit<PublicRegistrationInput, 'formToken' | 'website'>;

/** The form only emails a one-time code to the desk; the walk-in is created once the visitor enters it, so only someone at the desk can register. */
@Injectable()
export class PublicRegistrationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PublicRegistrationService.name);
  private purgeTimer?: NodeJS.Timeout;
  /** Keys form tokens and code hashes; never the raw JWT secret itself. */
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly crypto: EncryptionService,
    private readonly notifications: NotificationService,
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

  onModuleInit(): void {
    this.purgeTimer = setInterval(
      () =>
        void this.purgeExpired().catch((err: Error) => this.logger.error(err)),
      PURGE_INTERVAL_MS,
    );
    this.purgeTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.purgeTimer);
  }

  /** Deletes unfinished registrations past the retention window. */
  async purgeExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.deskQrRegistration.deleteMany({
      where: {
        visitId: null,
        expiresAt: { lt: new Date(now.getTime() - RETENTION_MS) },
      },
    });
    return count;
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
  ): Promise<PublicRegistrationPending> {
    const qr = await this.activeQr(token);
    this.assertFormOpen(qr.token, input.formToken, now);
    const codeExpiresAt = new Date(
      now.getTime() + DESK_QR_FORM_MINUTES * 60_000,
    );
    if (input.website?.trim()) {
      return this.trapBot(qr, codeExpiresAt);
    }

    const recent = await this.prisma.deskQrRegistration.count({
      where: {
        deskQrId: qr.id,
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
    const id = randomUUID();
    const code = newVerificationCode();
    await this.prisma.deskQrRegistration.create({
      data: {
        id,
        deskQrId: qr.id,
        payload: this.crypto.encrypt(JSON.stringify(stored)),
        codeHash: hashVerificationCode(this.secret, id, code),
        expiresAt: codeExpiresAt,
      },
    });

    const queued = await this.notifications.enqueue({
      templateKey: NOTIFICATION_TEMPLATES.DESK_QR_CODE,
      // Read by reception, not the visitor.
      locale: 'EN',
      data: {
        visitorName: stored.fullName,
        organization: stored.organization,
        code,
        expiresAt: formatWat(codeExpiresAt).slice(11),
      },
      channels: [
        { channel: NotificationChannel.EMAIL, recipient: qr.codeEmail },
      ],
    });
    if (queued === 0) {
      // Email is switched off: nobody could ever read this code out.
      await this.prisma.deskQrRegistration.delete({ where: { id } });
      throw new ServiceUnavailableException('errors.deskQr.codeNotSent');
    }
    // Only audited once the email is really queued; no personal data or code.
    await this.txm.run((tx) =>
      this.events.publish(tx, {
        type: EVENT_TYPES.DeskQrCodeSent,
        aggregateType: 'DeskQr',
        aggregateId: qr.id,
        payload: { deskQrId: qr.id, registrationId: id },
      }),
    );
    return {
      registrationId: id,
      codeExpiresAt,
      secondsLeft: DESK_QR_FORM_MINUTES * 60,
    };
  }

  /**
   * A bot filled the hidden field. Store a registration whose code can never
   * match (its hash is of a random UUID, not six digits), so the bot sees the
   * same wrong-code and lockout answers a person would.
   */
  private async trapBot(
    qr: DeskQr,
    codeExpiresAt: Date,
  ): Promise<PublicRegistrationPending> {
    const id = randomUUID();
    await this.prisma.deskQrRegistration.create({
      data: {
        id,
        deskQrId: qr.id,
        payload: this.crypto.encrypt('null'),
        codeHash: hashVerificationCode(this.secret, id, randomUUID()),
        expiresAt: codeExpiresAt,
      },
    });
    await this.security.record({
      action: EVENT_TYPES.DeskQrHoneypotTriggered,
      entityType: 'DeskQr',
      entityId: qr.id,
      metadata: { deskQrId: qr.id, registrationId: id },
    });
    return {
      registrationId: id,
      codeExpiresAt,
      secondsLeft: DESK_QR_FORM_MINUTES * 60,
    };
  }

  async verify(
    token: string,
    registrationId: string,
    code: string,
    now = new Date(),
  ): Promise<PublicRegistrationResult> {
    const qr = await this.activeQr(token);
    const reg = await this.prisma.deskQrRegistration.findFirst({
      where: { id: registrationId, deskQrId: qr.id, visitId: null },
    });
    if (!reg) throw new NotFoundException('errors.deskQr.registrationNotFound');
    if (reg.expiresAt <= now)
      throw new GoneException('errors.deskQr.codeExpired');
    // Atomic conditional increment before comparing, so parallel guesses cannot exceed DESK_QR_CODE_ATTEMPTS.
    const claimed = await this.prisma.deskQrRegistration.updateMany({
      where: {
        id: reg.id,
        visitId: null,
        attempts: { lt: DESK_QR_CODE_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      await this.recordCodeAbuse(
        EVENT_TYPES.DeskQrRegistrationLocked,
        qr,
        reg.id,
        DESK_QR_CODE_ATTEMPTS,
      );
      throw new HttpException('errors.deskQr.tooManyTries', HttpStatus.LOCKED);
    }
    if (!verificationCodeMatches(this.secret, reg.id, code, reg.codeHash)) {
      const after = await this.prisma.deskQrRegistration.findUnique({
        where: { id: reg.id },
        select: { attempts: true },
      });
      const attempts = after?.attempts ?? DESK_QR_CODE_ATTEMPTS;
      const locked = attempts >= DESK_QR_CODE_ATTEMPTS;
      await this.recordCodeAbuse(
        locked
          ? EVENT_TYPES.DeskQrRegistrationLocked
          : EVENT_TYPES.DeskQrCodeRejected,
        qr,
        reg.id,
        attempts,
      );
      throw locked
        ? new HttpException('errors.deskQr.tooManyTries', HttpStatus.LOCKED)
        : new UnprocessableEntityException('errors.deskQr.codeWrong');
    }

    const form = JSON.parse(this.crypto.decrypt(reg.payload)) as StoredForm;
    return this.visits.createSelfRegisteredWalkIn(form, async (tx, visitId) => {
      // Claimed in the same transaction so a racing correct code rolls its visit back.
      const claimed = await tx.deskQrRegistration.updateMany({
        where: { id: reg.id, visitId: null },
        data: { visitId, payload: '' },
      });
      if (claimed.count === 0) {
        throw new ConflictException('errors.deskQr.registrationNotFound');
      }
    });
  }

  /** Never records the code or the QR token, only which registration was guessed at. */
  private recordCodeAbuse(
    action: string,
    qr: DeskQr,
    registrationId: string,
    attempts: number,
  ): Promise<void> {
    return this.security.record({
      action,
      entityType: 'DeskQr',
      entityId: qr.id,
      metadata: { deskQrId: qr.id, registrationId, attempts },
    });
  }
}
