-- CreateEnum
CREATE TYPE "RfidCardStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "RfidAssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'LOST');

-- CreateTable
CREATE TABLE "RfidCard" (
    "id" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "status" "RfidCardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfidCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfidCardAssignment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "visitId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "photoKey" TEXT,
    "status" "RfidAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "closeNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfidCardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RfidCard_cardNumber_key" ON "RfidCard"("cardNumber");

-- CreateIndex
CREATE INDEX "RfidCard_status_idx" ON "RfidCard"("status");

-- CreateIndex
CREATE INDEX "RfidCardAssignment_cardId_idx" ON "RfidCardAssignment"("cardId");

-- CreateIndex
CREATE INDEX "RfidCardAssignment_visitorId_idx" ON "RfidCardAssignment"("visitorId");

-- CreateIndex
CREATE INDEX "RfidCardAssignment_status_idx" ON "RfidCardAssignment"("status");

-- AddForeignKey
ALTER TABLE "RfidCardAssignment" ADD CONSTRAINT "RfidCardAssignment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RfidCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidCardAssignment" ADD CONSTRAINT "RfidCardAssignment_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidCardAssignment" ADD CONSTRAINT "RfidCardAssignment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidCardAssignment" ADD CONSTRAINT "RfidCardAssignment_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidCardAssignment" ADD CONSTRAINT "RfidCardAssignment_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
