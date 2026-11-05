-- CreateTable
CREATE TABLE "GateKiosk" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'gate',
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "tokenRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScanAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GateKiosk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GateKiosk_key_key" ON "GateKiosk"("key");

-- CreateIndex
CREATE UNIQUE INDEX "GateKiosk_token_key" ON "GateKiosk"("token");

-- AddForeignKey
ALTER TABLE "GateKiosk" ADD CONSTRAINT "GateKiosk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The gate is now a no-login kiosk page: GATE stops being a role.
-- Accounts that held only GATE are deactivated (kept for audit history).
UPDATE "User" u
SET "isActive" = false
WHERE EXISTS (
    SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
    WHERE ur."userId" = u."id" AND r."name" = 'GATE'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
    WHERE ur."userId" = u."id" AND r."name" <> 'GATE'
  );

-- Every GATE holder signs in again, so no session keeps acting as GATE.
UPDATE "RefreshToken" SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "revokedAt" IS NULL AND "userId" IN (
  SELECT ur."userId" FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
  WHERE r."name" = 'GATE'
);
UPDATE "Session" SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "revokedAt" IS NULL AND "userId" IN (
  SELECT ur."userId" FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
  WHERE r."name" = 'GATE'
);

DELETE FROM "UserRole" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "name" = 'GATE');
DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "name" = 'GATE');
DELETE FROM "Role" WHERE "name" = 'GATE';

-- Replaced by gate:manage (the kiosk itself needs no user).
DELETE FROM "RolePermission" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" = 'gate:verify');
DELETE FROM "Permission" WHERE "key" = 'gate:verify';
