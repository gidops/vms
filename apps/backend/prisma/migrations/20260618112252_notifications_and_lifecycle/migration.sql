-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- DropIndex
DROP INDEX "Notification_status_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "recipient" TEXT,
ADD COLUMN     "visitId" TEXT;

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "preferredLocale" "Locale" NOT NULL DEFAULT 'EN';

-- CreateIndex
CREATE INDEX "Notification_status_availableAt_idx" ON "Notification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
