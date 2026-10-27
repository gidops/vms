interface WithIdentity {
  visitorNameAtVisit: string | null;
  organizationAtVisit: string | null;
  visitor: { fullName: string; organization: string | null };
}

/** Who was on site for this visit: what they typed at the walk-in QR, else the visitor record. */
export function identityAtVisit(visit: WithIdentity): {
  fullName: string;
  organization: string | null;
} {
  return {
    fullName: visit.visitorNameAtVisit ?? visit.visitor.fullName,
    organization: visit.organizationAtVisit ?? visit.visitor.organization,
  };
}

/** The stored visitor record, only when this visit was registered under different details. */
export function storedVisitorIfDifferent(
  visit: WithIdentity,
): { fullName: string; organization: string | null } | null {
  const shown = identityAtVisit(visit);
  const { fullName, organization } = visit.visitor;
  return shown.fullName === fullName && shown.organization === organization
    ? null
    : { fullName, organization };
}
