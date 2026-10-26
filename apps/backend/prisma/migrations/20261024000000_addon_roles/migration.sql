-- Data-only: AUDITOR is retired (folded into READ_ADMIN), and READ_ADMIN /
-- VMC_ADMIN become add-ons that only extend STAFF / VMC. Runs before the
-- seeder's "drop unknown roles" step so nobody silently loses access.

-- Make sure the roles we assign exist (the seeder fills in their permissions).
INSERT INTO "Role" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r.name, now(), now()
FROM (VALUES ('READ_ADMIN'), ('STAFF'), ('VMC')) AS r(name)
WHERE NOT EXISTS (SELECT 1 FROM "Role" x WHERE x.name = r.name)
  AND EXISTS (SELECT 1 FROM "UserRole");

-- 1. AUDITOR holders become READ_ADMIN holders.
INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
SELECT ur."userId", ra."id", ur."assignedAt"
FROM "UserRole" ur
JOIN "Role" a ON a."id" = ur."roleId" AND a."name" = 'AUDITOR'
JOIN "Role" ra ON ra."name" = 'READ_ADMIN'
ON CONFLICT ("userId", "roleId") DO NOTHING;

DELETE FROM "UserRole" ur
USING "Role" a
WHERE a."id" = ur."roleId" AND a."name" = 'AUDITOR';

-- 2. Every add-on gets its base role (assigned first, so it is the default).
INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
SELECT ur."userId", base."id", ur."assignedAt" - interval '1 millisecond'
FROM "UserRole" ur
JOIN "Role" addon ON addon."id" = ur."roleId"
JOIN "Role" base ON base."name" = CASE addon."name"
  WHEN 'READ_ADMIN' THEN 'STAFF'
  WHEN 'VMC_ADMIN' THEN 'VMC'
END
WHERE addon."name" IN ('READ_ADMIN', 'VMC_ADMIN')
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- 3. Add-ons can no longer be the active role; null → the default role.
UPDATE "Session"
SET "activeRole" = NULL
WHERE "activeRole" IN ('AUDITOR', 'READ_ADMIN', 'VMC_ADMIN');
