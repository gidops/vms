import Papa from "papaparse";

/** One guest row parsed from an uploaded CSV. */
export interface CsvGuest {
  fullName: string;
  email: string;
  organization: string;
  phone: string;
  /** Optional host email — used to preselect the host (overridable by VMC). */
  hostEmail: string;
}

const HEADERS = [
  "fullName",
  "email",
  "organization",
  "phone",
  "hostEmail",
] as const;

/** Tolerant header lookup (case/space-insensitive) so hand-edited CSVs still map. */
function pick(row: Record<string, string>, key: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  const target = norm(key);
  for (const [k, v] of Object.entries(row)) {
    if (norm(k) === target) return (v ?? "").trim();
  }
  return "";
}

/** Parse an uploaded guest CSV into rows (client-side; never sent as a file). */
export function parseGuestsCsv(file: File): Promise<CsvGuest[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data
          .map((row) => ({
            fullName: pick(row, "fullName"),
            email: pick(row, "email"),
            organization: pick(row, "organization"),
            phone: pick(row, "phone"),
            hostEmail: pick(row, "hostEmail"),
          }))
          .filter((g) => g.fullName || g.email);
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}

/** Trigger a download of the blank guest CSV template (with one example row). */
export function downloadGuestTemplate(): void {
  const example =
    "Daniel Nwosu,danny@example.com,Protis Studios,+234 9035 5824,sarah.lee@aatc.org";
  const csv = `${HEADERS.join(",")}\n${example}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aatc-guest-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
