/**
 * One-off migration of the legacy QServers VMS (phpMyAdmin/MariaDB dump of
 * `aatcabuj_visitors_version_2`) into this system's Postgres schema.
 *
 *   npx ts-node --transpile-only scripts/migrate-legacy.ts --dump <file.sql>          # dry run (default)
 *   npx ts-node --transpile-only scripts/migrate-legacy.ts --dump <file.sql> --apply  # write to DATABASE_URL
 *
 * Design notes (the WHY — the mapping was agreed with the team, Oct 2026):
 * - Idempotent: users/visitors upsert by email; a visit is skipped when a
 *   LEGACY_IMPORT visit with the same visitor + check-in instant already
 *   exists. Safe to re-run after a partial failure or a dev-environment rebuild.
 * - Writes mirror what the app itself writes (visits/authoring.service.ts):
 *   visitor phone is stored as the app currently stores it; passwords are
 *   argon2 like the identity module. No row should be distinguishable from an
 *   app-created one except by source = LEGACY_IMPORT.
 * - Legacy DATETIME columns (check_in_time/check_out_time, visit_date +
 *   time_of_visit) are server-local Africa/Lagos (+01:00); legacy TIMESTAMP
 *   columns (created_at) were dumped in UTC. Both are normalised to UTC here.
 * - The legacy `host_id` column is unusable (0 for 2,530 of 2,532 rows). Host
 *   attribution comes from `employee_id` (726 valid) with a host_name
 *   fallback; `host_name = "Walk-In"` (1,805 rows) maps to hostId = null,
 *   which the Visit model documents as the walk-in shape.
 * - Passwords never migrate (incompatible PHP hashes): every staff user gets
 *   an unusable random password; real logins are granted via password reset.
 * - CURATED_* below absorb the staff-list fixes prepared for the old system
 *   (Desktop/staff/01-add-22-hosts.sql + 02-fill-missing-emails.sql): real
 *   corporate emails for hosts whose dump rows lack one, plus hosts added to
 *   the old system after the dump was taken.
 */
import { PrismaClient, VisitStatus, VisitType } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Curated staff data (from Desktop/staff/*.sql, prepared against the old DB)
// ---------------------------------------------------------------------------

/** Legacy employees.id -> real corporate email (02-fill-missing-emails.sql). */
const CURATED_EMAIL_FILLS: Record<string, string> = {
  '63': 'oolusoji@afreximbank.com',
  '64': 'rolojede@afreximbank.com',
  '65': 'mmohammed@afreximbank.com',
  '66': 'mageba@afreximbank.com',
  '67': 'atwarumba@afreximbank.com',
  '68': 'mnwanja@afreximbank.com',
  '69': 'ooluseye@afreximbank.com',
  '70': 'aelemide@afreximbank.com',
  '71': 'bmayowa@afreximbank.com',
  '72': 'aogo@afreximbank.com',
  '73': 'zbello@afreximbank.com',
  '77': 'wtawiah@afreximbank.com',
  '78': 'fadetiba@afreximbank.com',
  '79': 'kolaosun@afreximbank.com',
  '80': 'bmessi@afreximbank.com',
  '81': 'rnwachukwu@afreximbank.com',
  '82': 'ooni@afreximbank.com',
  '83': 'amubarak@afreximbank.com',
  '84': 'mkanagie@afreximbank.com',
  '85': 'uokafor@afreximbank.com',
  '87': 'jbakare@afreximbank.com',
  '88': 'nnwachukwu@afreximbank.com',
  '89': 'donyemaechi@afreximbank.com',
  '90': 'gmadu@afreximbank.com',
  '91': 'pewaoche@afreximbank.com',
};

/** Hosts added to the old system after the dump (01-add-22-hosts.sql). */
const CURATED_EXTRA_HOSTS: Array<{
  name: string;
  email: string | null;
  organization: string;
}> = [
  {
    name: 'Matereke Kudakwashe',
    email: 'kmatereke@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Obioma Iweka',
    email: 'oiweka@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Otitodilichukwu Onuegbu',
    email: 'oonuegbu@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Ugonna Nwankwo',
    email: 'unwankwo@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Lawal Mohammed',
    email: 'lawal.mohammed@bureauveritas.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Al Amin Ishaq',
    email: 'aishaq@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Stephen Iyen',
    email: 'siyen@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Sherifat Omokide',
    email: 'somokide@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Adewale Oni',
    email: 'aoni@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Mukhtar Nasir',
    email: 'mnasir@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Sarah Ajieh',
    email: 'sajieh@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Onyinyechukwu Amonu',
    email: 'oamonu@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Colette Anayoanyiam',
    email: 'canayoanyiam@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'McDonald Emomotimi',
    email: 'memomotini@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Maryam Dunji',
    email: 'mdunji@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Blessing Timothy',
    email: 'btimothy@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Ruth Oyeranmi',
    email: 'royeranmi@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Honour Odozie',
    email: 'hodozie@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Nancy Nyam',
    email: 'nnyam@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Kikelomo Adesina',
    email: 'kadesina@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Moyosore Ademilola',
    email: 'mademilola@afreximbank.com',
    organization: 'Afreximbank',
  },
  {
    name: 'Arnold Nwaneri',
    email: 'anwaneri@afreximbank.com',
    organization: 'Afreximbank',
  },
  // Organisations that receive visitors in their own right (no mailbox).
  {
    name: 'African Energy Bank',
    email: null,
    organization: 'African Energy Bank',
  },
  { name: 'Oando', email: null, organization: 'Oando' },
  { name: 'Orashi', email: null, organization: 'Orashi' },
];

const IMPORT_SOURCE = 'LEGACY_IMPORT';
const IMPORT_ACTOR = 'Legacy import (QServers aatcabuj_visitors_version_2)';
/** Placeholder-email domain: syntactically valid, obviously not deliverable. */
const PLACEHOLDER_DOMAIN = 'legacy-import.invalid';

// ---------------------------------------------------------------------------
// Minimal MySQL-dump reader: INSERT INTO `t` (cols) VALUES (...),(...);
// ---------------------------------------------------------------------------

type Row = Record<string, string | null>;

function parseDump(sql: string): Record<string, Row[]> {
  const tables: Record<string, Row[]> = {};
  const insertRe = /INSERT INTO `(\w+)` \(([^)]*)\) VALUES\s*/g;
  let m: RegExpExecArray | null;
  while ((m = insertRe.exec(sql)) !== null) {
    const table = m[1];
    const cols = m[2].split(',').map((c) => c.trim().replace(/`/g, ''));
    const rows = (tables[table] ??= []);
    // Scan value tuples char-by-char: SQL strings may contain commas, quotes
    // and parentheses, so a regex split would corrupt them.
    let i = insertRe.lastIndex;
    let depth = 0;
    let inStr = false;
    let field = '';
    let tuple: (string | null)[] = [];
    for (; i < sql.length; i++) {
      const ch = sql[i];
      if (inStr) {
        if (ch === '\\' && i + 1 < sql.length) {
          field += unescapeMysql(sql[i + 1]);
          i++;
        } else if (ch === "'") {
          if (sql[i + 1] === "'") {
            field += "'";
            i++;
          } else inStr = false;
        } else field += ch;
      } else if (ch === "'") {
        inStr = true;
        field = field === 'NULL' ? '' : field; // value starts fresh
      } else if (ch === '(') {
        depth++;
        if (depth === 1) {
          tuple = [];
          field = '';
        } else field += ch;
      } else if (ch === ')') {
        depth--;
        if (depth === 0) {
          tuple.push(finishField(field));
          field = '';
          const row: Row = {};
          cols.forEach((c, idx) => (row[c] = tuple[idx] ?? null));
          rows.push(row);
        } else field += ch;
      } else if (ch === ',' && depth === 1) {
        tuple.push(finishField(field));
        field = '';
      } else if (ch === ';' && depth === 0) {
        break; // end of this INSERT statement
      } else if (depth >= 1) field += ch;
    }
    insertRe.lastIndex = i;
  }
  return tables;
}

function unescapeMysql(c: string): string {
  return c === 'n'
    ? '\n'
    : c === 'r'
      ? '\r'
      : c === 't'
        ? '\t'
        : c === '0'
          ? '\0'
          : c;
}

/** A bare (unquoted) NULL token means SQL NULL; everything else is a value. */
function finishField(raw: string): string | null {
  const t = raw.trim();
  return t === 'NULL' ? null : t;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/** Legacy DATETIME / DATE+TIME values are Africa/Lagos wall-clock (+01:00). */
function lagosToUtc(datetime: string | null): Date | null {
  if (!datetime || !datetime.trim() || datetime.startsWith('0000')) return null;
  const d = new Date(`${datetime.trim().replace(' ', 'T')}+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Legacy TIMESTAMP values were dumped with time_zone = +00:00 (UTC). */
function utcTs(datetime: string | null): Date | null {
  if (!datetime || !datetime.trim() || datetime.startsWith('0000')) return null;
  const d = new Date(`${datetime.trim().replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim();
}

function slugEmail(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'unknown';
  return `${slug}@${PLACEHOLDER_DOMAIN}`;
}

function hash8(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 8);
}

interface StaffOut {
  legacyIds: string[];
  fullName: string;
  email: string;
  emailSynthesized: boolean;
  department: string | null;
}

interface VisitorOut {
  key: string;
  fullName: string;
  email: string;
  emailSynthesized: boolean;
  phone: string | null;
  organization: string | null;
}

interface VisitOut {
  visitorKey: string;
  hostEmail: string | null; // null = walk-in
  hostUnresolvedName?: string;
  status: VisitStatus;
  purpose: string;
  floor: string | null;
  scheduledAt: Date | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  createdAt: Date;
  anomaly?: string;
}

function transform(tables: Record<string, Row[]>) {
  const employees = tables.employees ?? [];
  const legacyVisits = tables.visitors ?? [];

  // --- staff -> users (STAFF role) + Host rows -----------------------------
  const staffByEmail = new Map<string, StaffOut>();
  const staffByLegacyId = new Map<string, StaffOut>();
  const staffByName = new Map<string, StaffOut>();
  const addStaff = (
    legacyId: string | null,
    name: string,
    email: string | null,
    dept: string | null,
  ) => {
    const fullName = norm(name);
    if (!fullName) return;
    const realEmail = norm(email).toLowerCase();
    const finalEmail = realEmail || slugEmail(fullName);
    let s = staffByEmail.get(finalEmail);
    if (!s) {
      s = {
        legacyIds: [],
        fullName,
        email: finalEmail,
        emailSynthesized: !realEmail,
        department: dept ? norm(dept) || null : null,
      };
      staffByEmail.set(finalEmail, s);
    }
    if (legacyId) {
      s.legacyIds.push(legacyId);
      staffByLegacyId.set(legacyId, s);
    }
    staffByName.set(fullName.toLowerCase(), s);
  };
  for (const e of employees) {
    const id = norm(e.id);
    addStaff(
      id,
      e.name ?? '',
      CURATED_EMAIL_FILLS[id] ?? e.email,
      e.designation ?? e.organization,
    );
  }
  for (const h of CURATED_EXTRA_HOSTS)
    addStaff(null, h.name, h.email, h.organization);

  // --- visits -> unique visitors + Visit rows ------------------------------
  // Identity key preference order: phone, then email, then name. Rows with no
  // phone/email collapse by name — the best available for 16 legacy rows.
  const visitors = new Map<string, VisitorOut>();
  const visits: VisitOut[] = [];
  const anomalies: string[] = [];

  for (const r of legacyVisits) {
    const phone = norm(r.phone) || null;
    const email = norm(r.email).toLowerCase() || null;
    const name = norm(r.name) || 'Unknown visitor';
    const key = phone ?? email ?? `name:${name.toLowerCase()}`;

    let vtor = visitors.get(key);
    if (!vtor) {
      vtor = {
        key,
        fullName: name,
        email: email ?? `visitor-${hash8(key)}@${PLACEHOLDER_DOMAIN}`,
        emailSynthesized: !email,
        phone,
        organization: norm(r.organization) || null,
      };
      visitors.set(key, vtor);
    } else {
      // Later rows refine the record (the app's upsert updates these too).
      if (email && vtor.emailSynthesized) {
        vtor.email = email;
        vtor.emailSynthesized = false;
      }
      vtor.phone = vtor.phone ?? phone;
      vtor.organization = vtor.organization ?? (norm(r.organization) || null);
      if (name.length > vtor.fullName.length) vtor.fullName = name;
    }

    // Host: employee_id first, host_name fallback, "Walk-In" => null host.
    const hostName = norm(r.host_name);
    let hostEmail: string | null = null;
    let hostUnresolvedName: string | undefined;
    if (hostName && hostName.toLowerCase() !== 'walk-in') {
      const byId = r.employee_id
        ? staffByLegacyId.get(norm(r.employee_id))
        : undefined;
      const byName = staffByName.get(hostName.toLowerCase());
      const host = byId ?? byName;
      if (host) hostEmail = host.email;
      else hostUnresolvedName = hostName;
    }

    const legacyStatus = norm(r.status);
    let status: VisitStatus;
    let anomaly: string | undefined;
    switch (legacyStatus) {
      case 'checked_out':
        status = VisitStatus.CHECKED_OUT;
        break;
      case 'checked_in':
        // Stale "in the building" rows, months old: this is history, not
        // presence — closed out without a checkout time.
        status = VisitStatus.CHECKED_OUT;
        anomaly =
          'legacy checked_in with no checkout (closed as CHECKED_OUT, checkOutAt = null)';
        break;
      case 'rejected':
        status = VisitStatus.DENIED;
        break;
      default:
        status = VisitStatus.EXPIRED;
        anomaly = `legacy status "${legacyStatus}" mapped to EXPIRED`;
    }

    const visitDate = norm(r.visit_date);
    const timeOfVisit = norm(r.time_of_visit);
    const scheduledAt =
      visitDate && timeOfVisit
        ? lagosToUtc(`${visitDate} ${timeOfVisit}`)
        : lagosToUtc(visitDate ? `${visitDate} 00:00:00` : null);
    const createdAt = utcTs(r.created_at) ?? scheduledAt ?? new Date();

    const v: VisitOut = {
      visitorKey: key,
      hostEmail,
      hostUnresolvedName,
      status,
      purpose: norm(r.reason) || (hostEmail ? 'Visit' : 'Walk-in'),
      floor: norm(r.floor_of_visit) || null,
      scheduledAt,
      checkInAt: lagosToUtc(r.check_in_time),
      checkOutAt: lagosToUtc(r.check_out_time),
      createdAt,
      anomaly,
    };
    visits.push(v);
    if (anomaly) anomalies.push(`visit ${r.id} (${name}): ${anomaly}`);
    if (hostUnresolvedName)
      anomalies.push(
        `visit ${r.id} (${name}): host "${hostUnresolvedName}" not in staff list -> imported as walk-in`,
      );
  }

  return {
    staff: [...staffByEmail.values()],
    visitors: [...visitors.values()],
    visits,
    anomalies,
  };
}

// ---------------------------------------------------------------------------
// Load (only with --apply)
// ---------------------------------------------------------------------------

async function load(out: ReturnType<typeof transform>) {
  const prisma = new PrismaClient();
  const counts = {
    usersCreated: 0,
    usersSkipped: 0,
    visitorsCreated: 0,
    visitorsSkipped: 0,
    visitsCreated: 0,
    visitsSkipped: 0,
  };
  try {
    const staffRole = await prisma.role.findUnique({
      where: { name: 'STAFF' },
    });
    if (!staffRole)
      throw new Error(
        'STAFF role not found — has the backend booted once (role seeding)?',
      );

    const hostIdByEmail = new Map<string, string>();
    for (const s of out.staff) {
      let user = await prisma.user.findUnique({ where: { email: s.email } });
      if (user) counts.usersSkipped++;
      else {
        // Unusable random password: legacy hashes are incompatible and real
        // logins are granted via password reset, never via a migrated secret.
        const passwordHash = await argon2.hash(randomBytes(24).toString('hex'));
        user = await prisma.user.create({
          data: { email: s.email, fullName: s.fullName, passwordHash },
        });
        await prisma.userRole.create({
          data: { userId: user.id, roleId: staffRole.id },
        });
        counts.usersCreated++;
      }
      const host = await prisma.host.upsert({
        where: { userId: user.id },
        create: { userId: user.id, department: s.department },
        update: {},
      });
      hostIdByEmail.set(s.email, host.id);
    }

    const visitorIdByKey = new Map<string, string>();
    for (const v of out.visitors) {
      const existing = await prisma.visitor.findUnique({
        where: { email: v.email },
      });
      if (existing) {
        counts.visitorsSkipped++;
        visitorIdByKey.set(v.key, existing.id);
      } else {
        const created = await prisma.visitor.create({
          data: {
            fullName: v.fullName,
            email: v.email,
            phone: v.phone,
            organization: v.organization,
          },
        });
        counts.visitorsCreated++;
        visitorIdByKey.set(v.key, created.id);
      }
    }

    for (const v of out.visits) {
      const visitorId = visitorIdByKey.get(v.visitorKey);
      if (!visitorId) continue; // cannot happen: every visit's visitor was built above
      const dup = await prisma.visit.findFirst({
        where: {
          source: IMPORT_SOURCE,
          visitorId,
          checkInAt: v.checkInAt,
          scheduledAt: v.scheduledAt,
        },
        select: { id: true },
      });
      if (dup) {
        counts.visitsSkipped++;
        continue;
      }
      await prisma.visit.create({
        data: {
          visitorId,
          hostId: v.hostEmail ? hostIdByEmail.get(v.hostEmail) : null,
          type: VisitType.WALK_IN, // every legacy row was logged at reception
          status: v.status,
          purpose: v.purpose,
          floor: v.floor,
          scheduledAt: v.scheduledAt,
          checkInAt: v.checkInAt,
          checkOutAt: v.checkOutAt,
          source: IMPORT_SOURCE,
          createdByName: IMPORT_ACTOR,
          createdAt: v.createdAt, // preserve real history for date-based views
        },
      });
      counts.visitsCreated++;
    }
  } finally {
    await prisma.$disconnect();
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dumpIdx = args.indexOf('--dump');
  const dumpPath = dumpIdx >= 0 ? args[dumpIdx + 1] : undefined;
  if (!dumpPath) {
    console.error(
      'Usage: migrate-legacy.ts --dump <aatcabuj_visitors_version_2.sql> [--apply]',
    );
    process.exit(1);
  }

  const sql = readFileSync(dumpPath, 'utf8');
  const tables = parseDump(sql);
  const out = transform(tables);

  const byStatus = new Map<string, number>();
  for (const v of out.visits)
    byStatus.set(v.status, (byStatus.get(v.status) ?? 0) + 1);
  const walkIns = out.visits.filter((v) => !v.hostEmail).length;
  const synthStaff = out.staff.filter((s) => s.emailSynthesized);
  const synthVisitors = out.visitors.filter((v) => v.emailSynthesized).length;

  console.log(
    `Legacy dump: ${tables.visitors?.length ?? 0} visit rows, ${tables.employees?.length ?? 0} employees`,
  );
  console.log(
    `Will write:  ${out.staff.length} staff users (+Host rows), ${out.visitors.length} visitors, ${out.visits.length} visits`,
  );
  console.log(
    `Visits by status: ${[...byStatus.entries()].map(([s, n]) => `${s}=${n}`).join('  ')}`,
  );
  console.log(
    `Walk-ins (no host): ${walkIns}   hosted: ${out.visits.length - walkIns}`,
  );
  console.log(
    `Placeholder emails: ${synthStaff.length} staff (${synthStaff.map((s) => s.fullName).join(', ') || 'none'}), ${synthVisitors} visitors`,
  );
  console.log(`Anomalies: ${out.anomalies.length}`);
  for (const a of out.anomalies.slice(0, 20)) console.log(`  - ${a}`);
  if (out.anomalies.length > 20)
    console.log(`  … and ${out.anomalies.length - 20} more`);

  console.log('\nSample visits:');
  for (const v of out.visits.slice(0, 3))
    console.log('  ', JSON.stringify({ ...v, visitorKey: undefined }));

  if (!apply) {
    console.log('\nDRY RUN — no database writes. Re-run with --apply to load.');
    return;
  }
  console.log(
    '\nAPPLYING to',
    process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@'),
  );
  const counts = await load(out);
  console.log('Done:', counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
