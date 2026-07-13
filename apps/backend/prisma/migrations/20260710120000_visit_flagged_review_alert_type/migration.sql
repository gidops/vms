-- Rename the "needs more info" visit status to REVIEW_REQUESTED (preserves existing
-- rows) and add the new FLAGGED status. Introduce the AlertType enum and type every
-- Alert row (existing rows default to SECURITY_REVIEW).

-- VisitStatus: rename + add
ALTER TYPE "VisitStatus" RENAME VALUE 'NEEDS_MORE_INFO' TO 'REVIEW_REQUESTED';
ALTER TYPE "VisitStatus" ADD VALUE 'FLAGGED' BEFORE 'APPROVED';

-- AlertType enum + column (default types existing/seed alerts as SECURITY_REVIEW)
CREATE TYPE "AlertType" AS ENUM ('SECURITY_REVIEW', 'ADDITIONAL_INFO', 'RESTRICTED_MATCH');
ALTER TABLE "Alert" ADD COLUMN "type" "AlertType" NOT NULL DEFAULT 'SECURITY_REVIEW';
