-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "evacuationAssistOther" TEXT,
ADD COLUMN     "evacuationAssistTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
