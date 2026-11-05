import { CSV_BOM, escapeCsvCell, toCsv } from './csv';

describe('CSV writer', () => {
  it('neutralises formula injection', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell('+2348031234567')).toBe(`"'+2348031234567"`);
    expect(escapeCsvCell('-1')).toBe(`"'-1"`);
    expect(escapeCsvCell('@cmd')).toBe(`"'@cmd"`);
  });

  it('quotes commas, quotes and newlines; blanks null', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell('Zoé')).toBe('Zoé');
  });

  it('prefixes a UTF-8 BOM and uses CRLF rows', () => {
    const csv = toCsv(['Name', 'Org'], [['Amina', 'Société Générale']]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}Name,Org\r\nAmina,Société Générale\r\n`);
  });
});
