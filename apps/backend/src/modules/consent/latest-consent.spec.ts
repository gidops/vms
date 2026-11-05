import { latestConsent } from './latest-consent';

describe('latestConsent', () => {
  it('returns nothing and skips the query for no emails', async () => {
    const findMany = jest.fn();
    await expect(
      latestConsent({ commsConsentEvent: { findMany } } as never, []),
    ).resolves.toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
  });

  it('keeps the newest answer per normalised email', async () => {
    const findMany = jest.fn().mockResolvedValue([
      // Newest first, as ordered by the query.
      { email: 'zoe@societe.fr', consent: false },
      { email: 'zoe@societe.fr', consent: true },
      { email: 'ade@x.com', consent: true },
    ]);
    const out = await latestConsent(
      { commsConsentEvent: { findMany } } as never,
      [' Zoe@Societe.fr ', 'zoe@societe.fr', 'ADE@x.com'],
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { in: ['zoe@societe.fr', 'ade@x.com'] } },
      }),
    );
    expect(out).toEqual(
      new Map([
        ['zoe@societe.fr', false],
        ['ade@x.com', true],
      ]),
    );
  });
});
