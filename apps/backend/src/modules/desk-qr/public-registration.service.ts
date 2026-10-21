import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
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
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
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

type StoredForm = Omit<PublicRegistrationInput, 'formToken' | 'website'>;

/**
 * The visitor's side of the desk QR (no login). Opening the link starts a
 * 10-minute form; submitting it emails a one-time 6-digit code to the desk
 * inbox (V1 parity); entering that code creates today's walk-in. Nothing is
 * created from the form alone, so someone who isn't at the desk can't register.
 */
@Injectable()
export class PublicRegistrationService {
  private readonly logger = new Logger(PublicRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly crypto: EncryptionService,
    private readonly notifications: NotificationService,
    private readonly users: UsersService,
    private readonly visits: VisitAuthoringService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Keyed by the app secret: form tokens and code hashes can't be forged. */
  private get secret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  /** The active desk QR for a printed token, or the one "not active" answer. */
  private async activeQr(token: string): Promise<DeskQr> {
    const qr = DESK_QR_TOKEN_RE.test(token)
      ? await this.prisma.deskQr.findUnique({ where: { token } })
      : null;
    // Same answer for unknown, replaced and disabled codes: never reveal which.
    if (!qr?.isActive) throw new NotFoundException('errors.deskQr.notActive');
    return qr;
  }

  /** A visitor scanned the QR: count it and start the 10-minute form. */
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
    };
  }

  async searchHosts(token: string, q: string): Promise<PublicHostOption[]> {
    await this.activeQr(token);
    return this.users.searchPublicHosts(q);
  }

  /**
   * Check the form, keep it (encrypted) and email the desk a one-time code.
   * A filled-in honeypot gets a normal-looking answer and nothing else.
   */
  async submit(
    token: string,
    input: PublicRegistrationInput,
    now = new Date(),
  ): Promise<PublicRegistrationPending> {
    const qr = await this.activeQr(token);
    const form = formTokenValid(this.secret, qr.token, input.formToken, now);
    if (!form.ok) {
      throw form.reason === 'expired'
        ? new GoneException('errors.deskQr.formExpired')
        : new UnprocessableEntityException('errors.deskQr.formInvalid');
    }
    const codeExpiresAt = new Date(
      now.getTime() + DESK_QR_FORM_MINUTES * 60_000,
    );
    if (input.website?.trim()) {
      this.logger.warn('Desk QR honeypot filled; registration dropped');
      return { registrationId: randomUUID(), codeExpiresAt };
    }

    // Unfinished registrations hold personal data: keep them only a day.
    await this.prisma.deskQrRegistration.deleteMany({
      where: {
        visitId: null,
        expiresAt: { lt: new Date(now.getTime() - 24 * 3_600_000) },
      },
    });
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
    await this.txm.run(async (tx) => {
      await tx.deskQrRegistration.create({
        data: {
          id,
          deskQrId: qr.id,
          payload: this.crypto.encrypt(JSON.stringify(stored)),
          codeHash: hashVerificationCode(this.secret, id, code),
          expiresAt: codeExpiresAt,
        },
      });
      // Audit the attempt without personal data or the code.
      await this.events.publish(tx, {
        type: EVENT_TYPES.DeskQrCodeSent,
        aggregateType: 'DeskQr',
        aggregateId: qr.id,
        payload: { deskQrId: qr.id, registrationId: id },
      });
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
    return { registrationId: id, codeExpiresAt };
  }

  /** The visitor typed the code reception read out: create the walk-in. */
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
    // Claim one try before comparing. A read-then-increment would let parallel
    // guesses all see the same count and slip past the limit; the conditional
    // increment is atomic, so at most DESK_QR_CODE_ATTEMPTS checks ever run.
    const claimed = await this.prisma.deskQrRegistration.updateMany({
      where: {
        id: reg.id,
        visitId: null,
        attempts: { lt: DESK_QR_CODE_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new HttpException('errors.deskQr.tooManyTries', HttpStatus.LOCKED);
    }
    if (!verificationCodeMatches(this.secret, reg.id, code, reg.codeHash)) {
      const after = await this.prisma.deskQrRegistration.findUnique({
        where: { id: reg.id },
        select: { attempts: true },
      });
      const attempts = after?.attempts ?? DESK_QR_CODE_ATTEMPTS;
      throw attempts >= DESK_QR_CODE_ATTEMPTS
        ? new HttpException('errors.deskQr.tooManyTries', HttpStatus.LOCKED)
        : new UnprocessableEntityException('errors.deskQr.codeWrong');
    }

    const form = JSON.parse(this.crypto.decrypt(reg.payload)) as StoredForm;
    return this.visits.createSelfRegisteredWalkIn(form, async (tx, visitId) => {
      // Claim the registration in the same transaction; a second, racing
      // correct code finds it already used and rolls its visit back.
      const claimed = await tx.deskQrRegistration.updateMany({
        where: { id: reg.id, visitId: null },
        // The visit now holds the details; drop the encrypted copy.
        data: { visitId, payload: '' },
      });
      if (claimed.count === 0) {
        throw new ConflictException('errors.deskQr.registrationNotFound');
      }
    });
  }
}
