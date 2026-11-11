/**
 * Which cached queries a domain change makes stale, by event-type prefix. Used
 * both for live pushes from other users and for this browser's own writes, so a
 * change refreshes every screen that shows it.
 */
type QueryPrefix = readonly string[];

/** Anything about a visit: the boards, feeds, counts, detail sheets and stats. */
export const VISIT_KEYS: QueryPrefix[] = [
  ["visits"],
  ["visit"],
  ["inbox"],
  ["alert"],
  ["staff"],
  ["insights"],
];

/** Card and pass stock moves at check-in and check-out too. */
const CARD_KEYS: QueryPrefix[] = [
  ["rfid-cards"],
  ["visitor-passes"],
  ["access-cards"],
];

const RULES: [prefix: string, keys: QueryPrefix[]][] = [
  ["visitor.checked_", [...VISIT_KEYS, ...CARD_KEYS]],
  ["visit.", VISIT_KEYS],
  ["visitor.", VISIT_KEYS],
  ["invitation.", VISIT_KEYS],
  ["alert.", VISIT_KEYS],
  ["note.", VISIT_KEYS],
  ["gate.code_checked", VISIT_KEYS],
  ["gate.", [["gate-kiosk"]]],
  ["rfid_card.", [...CARD_KEYS, ["visits"], ["visit"]]],
  ["visitor_pass.", CARD_KEYS],
  ["consent.", [["consent"], ["insights"]]],
  ["user.", [["users"], ["user"], ["hosts"]]],
  ["desk_qr.", [["desk-qr"]]],
  ["notification.", [["visit"]]],
];

/** Query-key prefixes to refetch for one event type (the audit trail always). */
export function staleKeysFor(eventType: string): QueryPrefix[] {
  const rule = RULES.find(([prefix]) => eventType.startsWith(prefix));
  return [...(rule?.[1] ?? []), ["audit"]];
}
