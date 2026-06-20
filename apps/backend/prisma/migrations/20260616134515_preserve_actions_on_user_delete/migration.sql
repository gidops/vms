-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_authorId_fkey";

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "authorName" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "createdByName" TEXT;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
