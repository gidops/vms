import { Injectable } from '@nestjs/common';
import type { GateVerifyInput, GateVerifyResult } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { identityAtVisit } from '../visits/helpers/visit-identity';
import { gateVerdict } from './gate.verdict';

/** The single gate today; matches check-in's GateEvent rows. */
const GATE_ID = 'MAIN';

/**
 * The gate kiosk checks a pre-invited visitor's code against today's visits.
 * No user is involved: scans are attributed to the kiosk link. Read-only for
 * the visit except `gateValidatedAt`, which a valid scan stamps so reception
 * sees the visitor passed the gate. Every scan is logged.
 */
@Injectable()
export class GateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async verify(
    input: GateVerifyInput,
    kioskId: string,
  ): Promise<GateVerifyResult> {
    const visit = await this.prisma.visit.findUnique({
      where: { referenceCode: input.code },
      include: {
        visitor: { select: { fullName: true, organization: true } },
        host: { select: { user: { select: { fullName: true } } } },
      },
    });
    const verdict = gateVerdict(visit);
    // A walk-in code is "not found" to the gate; don't describe that visit.
    const known = verdict === 'NOT_FOUND' ? null : visit;

    await this.txm.run(async (tx) => {
      const event = await tx.gateEvent.create({
        data: {
          visitId: known?.id ?? null,
          gateId: GATE_ID,
          type: input.source === 'scan' ? 'QR_SCAN' : 'INVITATION_VERIFY',
          operativeUserId: null,
          result: verdict,
          metadata: { code: input.code, source: input.source, kioskId },
        },
      });
      await tx.gateKiosk.update({
        where: { id: kioskId },
        data: { lastScanAt: event.occurredAt },
      });
      if (known && verdict === 'VALID_TODAY' && !known.gateValidatedAt) {
        await tx.visit.update({
          where: { id: known.id },
          data: { gateValidatedAt: event.occurredAt },
        });
      }
      await this.events.publish(tx, {
        type: EVENT_TYPES.GateCodeChecked,
        aggregateType: known ? 'Visit' : 'GateEvent',
        aggregateId: known?.id ?? event.id,
        payload: { verdict, source: input.source, code: input.code, kioskId },
        metadata: {},
      });
    });

    if (!known) return { verdict, visit: null };
    const identity = identityAtVisit(known);
    return {
      verdict,
      visit: {
        visitorName: identity.fullName,
        organization: identity.organization,
        hostName: known.host?.user.fullName ?? null,
        scheduledAt: known.scheduledAt,
        status: known.status,
      },
    };
  }
}
