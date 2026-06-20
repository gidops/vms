-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedDesk" TEXT,
ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "notificationPrefs" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "timezone" TEXT;
