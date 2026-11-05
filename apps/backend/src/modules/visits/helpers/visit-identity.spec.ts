import { identityAtVisit, storedVisitorIfDifferent } from './visit-identity';

const stored = { fullName: 'Ada Obi', organization: 'Dangote' };

describe('visit identity', () => {
  it('uses the stored visitor when nothing was typed at the visit', () => {
    const visit = {
      visitorNameAtVisit: null,
      organizationAtVisit: null,
      visitor: stored,
    };
    expect(identityAtVisit(visit)).toEqual(stored);
    expect(storedVisitorIfDifferent(visit)).toBeNull();
  });

  it('shows what was typed at the walk-in QR and reports the stored record', () => {
    const visit = {
      visitorNameAtVisit: 'Someone Else',
      organizationAtVisit: 'Other Ltd',
      visitor: stored,
    };
    expect(identityAtVisit(visit)).toEqual({
      fullName: 'Someone Else',
      organization: 'Other Ltd',
    });
    expect(storedVisitorIfDifferent(visit)).toEqual(stored);
  });

  it('reports no mismatch when the typed details match the record', () => {
    expect(
      storedVisitorIfDifferent({
        visitorNameAtVisit: 'Ada Obi',
        organizationAtVisit: 'Dangote',
        visitor: stored,
      }),
    ).toBeNull();
  });
});
