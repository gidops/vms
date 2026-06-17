-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeRole" TEXT;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
