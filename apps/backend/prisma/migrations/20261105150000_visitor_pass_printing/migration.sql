-- Visitor passes: per floor-wing numbering, print log, retire fields.

-- Pass zones now use the visit floor names (FLOOR_OPTIONS). Names with no wing
-- ("2nd Floor", "4th Floor") have no exact match and are kept as legacy zones.
UPDATE "AccessCard" SET "zone" = 'Unassigned' WHERE "zone" IS NULL;
UPDATE "AccessCard" SET "zone" = 'Mezzanine' WHERE "zone" = 'Floor Mezzanine';
UPDATE "AccessCard" SET "zone" = '3rd Floor - Left Wing' WHERE "zone" = '3rd Floor - LW';
UPDATE "AccessCard" SET "zone" = '5th Floor - Left Wing' WHERE "zone" = '5th Floor - left wing';
UPDATE "AccessCard" SET "zone" = '5th Floor - Right Wing' WHERE "zone" = '5th Floor - right wing';

-- CreateEnum
CREATE TYPE "PassPrintKind" AS ENUM ('PRINTED', 'REPRINTED', 'RECORDED');

-- DropIndex
DROP INDEX "AccessCard_cardNumber_key";

-- AlterTable
ALTER TABLE "AccessCard" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "retireNote" TEXT,
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ALTER COLUMN "zone" SET NOT NULL;

-- CreateTable
CREATE TABLE "AccessCardPrint" (
    "id" TEXT NOT NULL,
    "accessCardId" TEXT NOT NULL,
    "kind" "PassPrintKind" NOT NULL,
    "batchId" TEXT,
    "note" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCardPrint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessCardPrint_accessCardId_createdAt_idx" ON "AccessCardPrint"("accessCardId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessCardPrint_batchId_idx" ON "AccessCardPrint"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCard_zone_cardNumber_key" ON "AccessCard"("zone", "cardNumber");

-- AddForeignKey
ALTER TABLE "AccessCardPrint" ADD CONSTRAINT "AccessCardPrint_accessCardId_fkey" FOREIGN KEY ("accessCardId") REFERENCES "AccessCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

