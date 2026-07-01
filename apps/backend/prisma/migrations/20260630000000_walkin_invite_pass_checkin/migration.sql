-- AlterTable
ALTER TABLE "AccessCard" ADD COLUMN     "zone" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "gateValidatedAt" TIMESTAMP(3),
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "referenceCode" TEXT,
ALTER COLUMN "hostId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AccessCard_zone_idx" ON "AccessCard"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_referenceCode_key" ON "Visit"("referenceCode");

-- CreateIndex
CREATE INDEX "Visit_groupId_idx" ON "Visit"("groupId");
