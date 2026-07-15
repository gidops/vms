import { Prisma } from '@prisma/client';
import type {
  VisitListItem,
  VisitPass,
  VisitRequestDetail,
} from '@vms/contracts';

/** Relations loaded for a single visit's detail view. */
export const detailInclude = Prisma.validator<Prisma.VisitInclude>()({
  visitor: true,
  host: { include: { user: true } },
  createdBy: true,
  notes: { include: { author: true }, orderBy: { createdAt: 'asc' } },
  pass: { include: { accessCard: true } },
  alerts: { orderBy: { createdAt: 'desc' } },
});

export type VisitDetailRow = Prisma.VisitGetPayload<{
  include: typeof detailInclude;
}>;

/** Relations loaded for each row of the paginated visit list. */
export const listInclude = Prisma.validator<Prisma.VisitInclude>()({
  visitor: true,
  host: { include: { user: true } },
});

export type VisitListRow = Prisma.VisitGetPayload<{
  include: typeof listInclude;
}>;

export function toHost(
  host: VisitDetailRow['host'],
): VisitRequestDetail['host'] {
  if (!host) return null;
  return {
    id: host.id,
    userId: host.userId,
    department: host.department,
    office: host.office,
    createdAt: host.createdAt,
    updatedAt: host.updatedAt,
    user: {
      id: host.user.id,
      fullName: host.user.fullName,
      email: host.user.email,
    },
  };
}

export function toPass(pass: VisitDetailRow['pass']): VisitPass | null {
  if (!pass?.accessCard) return null;
  return {
    cardNumber: pass.accessCard.cardNumber,
    zone: pass.accessCard.zone,
    status: pass.status,
    assignedAt: pass.accessCard.assignedAt,
  };
}

export function toDetail(visit: VisitDetailRow): VisitRequestDetail {
  return {
    id: visit.id,
    visitorId: visit.visitorId,
    hostId: visit.hostId,
    invitationId: visit.invitationId,
    groupId: visit.groupId,
    isGroupVisit: visit.isGroupVisit,
    groupName: visit.groupName,
    groupContact: visit.groupContact,
    referenceCode: visit.referenceCode,
    type: visit.type,
    status: visit.status,
    purpose: visit.purpose,
    floor: visit.floor,
    riskLevel: visit.riskLevel,
    scheduledAt: visit.scheduledAt,
    gateValidatedAt: visit.gateValidatedAt,
    checkInAt: visit.checkInAt,
    checkOutAt: visit.checkOutAt,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
    source: visit.source,
    createdById: visit.createdById,
    createdByName: visit.createdByName ?? visit.createdBy?.fullName ?? null,
    visitor: visit.visitor,
    host: toHost(visit.host),
    pass: toPass(visit.pass),
    notes: visit.notes.map((note) => ({
      id: note.id,
      visitId: note.visitId,
      alertId: note.alertId,
      authorId: note.authorId,
      authorName: note.authorName,
      body: note.body,
      createdAt: note.createdAt,
    })),
    alerts: (visit.alerts ?? []).map((alert) => ({
      id: alert.id,
      visitId: alert.visitId,
      visitorId: alert.visitorId,
      type: alert.type,
      level: alert.level,
      status: alert.status,
      reason: alert.reason,
      category: alert.category,
      raisedById: alert.raisedById,
      resolvedById: alert.resolvedById,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    })),
  };
}

export function toListItem(
  visit: VisitListRow,
  groupSize: number,
): VisitListItem {
  return {
    id: visit.id,
    visitorId: visit.visitorId,
    hostId: visit.hostId,
    invitationId: visit.invitationId,
    groupId: visit.groupId,
    isGroupVisit: visit.isGroupVisit,
    groupName: visit.groupName,
    groupContact: visit.groupContact,
    referenceCode: visit.referenceCode,
    type: visit.type,
    status: visit.status,
    purpose: visit.purpose,
    floor: visit.floor,
    riskLevel: visit.riskLevel,
    scheduledAt: visit.scheduledAt,
    gateValidatedAt: visit.gateValidatedAt,
    checkInAt: visit.checkInAt,
    checkOutAt: visit.checkOutAt,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
    createdByName: visit.createdByName,
    visitor: visit.visitor,
    host: toHost(visit.host),
    groupSize,
  };
}
