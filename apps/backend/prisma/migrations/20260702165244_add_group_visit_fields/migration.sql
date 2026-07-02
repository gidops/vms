-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "groupEmail" TEXT,
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "isGroupVisit" BOOLEAN NOT NULL DEFAULT false;
