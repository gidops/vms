-- V1 gap features (additive only): intake answers on Visit, comms-consent
-- event log, and lookup indexes for notifications-by-visit and export ranges.

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('VISIT', 'WITHDRAWAL');

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "commsConsent" BOOLEAN,
ADD COLUMN     "needsEvacuationAssist" BOOLEAN;

-- CreateTable
CREATE TABLE "CommsConsentEvent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "visitId" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommsConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommsConsentEvent_email_createdAt_idx" ON "CommsConsentEvent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "CommsConsentEvent_visitId_idx" ON "CommsConsentEvent"("visitId");

-- CreateIndex
CREATE INDEX "Notification_visitId_idx" ON "Notification"("visitId");

-- CreateIndex
CREATE INDEX "Visit_scheduledAt_idx" ON "Visit"("scheduledAt");
