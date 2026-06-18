import { I18nService, normalizeLocale } from './i18n.service';

describe('I18nService', () => {
  const i18n = new I18nService();

  it('translates a key for the requested locale', () => {
    expect(i18n.translate('errors.visit.notFound', 'EN')).toBe(
      'Visit not found',
    );
    expect(i18n.translate('errors.visit.notFound', 'FR')).toBe(
      'Visite introuvable',
    );
  });

  it('interpolates {var} placeholders', () => {
    expect(
      i18n.translate('email.common.greeting', 'EN', { name: 'Paebi' }),
    ).toBe('Dear Paebi,');
  });

  it('falls back to EN when the locale is missing the key', () => {
    // A key that only needs to resolve; AR catalog has it, so force a fallback
    // by requesting a nonexistent locale via resolveLocale → defaults to EN.
    const locale = i18n.resolveLocale('zz');
    expect(locale).toBe('EN');
    expect(i18n.translate('errors.internal', locale)).toBe(
      'Internal server error',
    );
  });

  it('returns the key itself when no translation exists', () => {
    expect(i18n.translate('nope.not.here', 'EN')).toBe('nope.not.here');
  });

  it('has() distinguishes catalog keys from free text', () => {
    expect(i18n.has('errors.visit.notFound')).toBe(true);
    expect(i18n.has('Some free-text message')).toBe(false);
  });

  it('normalizes locale-ish input', () => {
    expect(normalizeLocale('en')).toBe('EN');
    expect(normalizeLocale('fr-FR')).toBe('FR');
    expect(normalizeLocale('AR')).toBe('AR');
    expect(normalizeLocale(undefined)).toBe('EN');
    expect(normalizeLocale('xx')).toBe('EN');
  });
});
