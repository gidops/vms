import { parsePhone, toE164 } from '@vms/contracts';
import { normalizeE164 } from './phone';

const DIAL_CODES = ['+234', '+1', '+44', '+971', '+233', '+27'];

describe('normalizeE164', () => {
  it('passes through a clean E.164 number', () => {
    expect(normalizeE164('+2348132813835')).toBe('+2348132813835');
  });

  it('strips spaces and formatting', () => {
    expect(normalizeE164('+234 813 281 3835')).toBe('+2348132813835');
    expect(normalizeE164('+1 (415) 523-8886')).toBe('+14155238886');
  });

  it('collapses an accidentally doubled country code', () => {
    expect(normalizeE164('+234 +2348132813835')).toBe('+2348132813835');
    expect(normalizeE164('+234 +2348079434380')).toBe('+2348079434380');
  });

  it('converts a 00 international prefix to +', () => {
    expect(normalizeE164('002348132813835')).toBe('+2348132813835');
  });

  it('returns an empty string for nullish input', () => {
    expect(normalizeE164(null)).toBe('');
    expect(normalizeE164(undefined)).toBe('');
    expect(normalizeE164('')).toBe('');
  });
});

describe('toE164', () => {
  it('assembles a clean number from any national input shape', () => {
    expect(toE164('+234', '8132813835')).toBe('+2348132813835'); // national
    expect(toE164('+234', '08132813835')).toBe('+2348132813835'); // trunk 0
    expect(toE164('+234', '+2348132813835')).toBe('+2348132813835'); // typed full intl
    expect(toE164('+234', '2348132813835')).toBe('+2348132813835'); // code, no +
    expect(toE164('+234', '813 281 3835')).toBe('+2348132813835'); // spaced
  });

  it('returns empty when there is no national number', () => {
    expect(toE164('+234', '')).toBe('');
    expect(toE164('+234', '   ')).toBe('');
  });
});

describe('parsePhone', () => {
  it('splits a clean value on the longest matching dial code', () => {
    expect(parsePhone('+2348132813835', DIAL_CODES)).toEqual({
      code: '+234',
      number: '8132813835',
    });
    expect(parsePhone('+14155238886', DIAL_CODES)).toEqual({
      code: '+1',
      number: '4155238886',
    });
  });

  it('tolerates legacy dirty shapes (space, doubled code)', () => {
    expect(parsePhone('+234 8132813835', DIAL_CODES)).toEqual({
      code: '+234',
      number: '8132813835',
    });
    expect(parsePhone('+234 +2348132813835', DIAL_CODES)).toEqual({
      code: '+234',
      number: '8132813835',
    });
  });

  it('falls back to the first dial code when nothing matches', () => {
    expect(parsePhone(null, DIAL_CODES)).toEqual({
      code: '+234',
      number: '',
    });
  });
});
