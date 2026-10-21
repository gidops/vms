/**
 * Minimal RFC 4180 CSV writer for exports that open cleanly in Excel:
 * UTF-8 BOM (so French/Arabic names render), CRLF rows, quoted fields, and
 * formula-injection escaping (a leading = + - @ tab or CR is prefixed with ').
 */
export const CSV_BOM = '\uFEFF';

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'string') s = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    s = value.toString();
  else s = JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s) || s.startsWith("'")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',') + '\r\n';
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return CSV_BOM + toCsvRow(header) + rows.map(toCsvRow).join('');
}
