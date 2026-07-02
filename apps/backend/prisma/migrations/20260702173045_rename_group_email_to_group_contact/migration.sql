-- Rename the group contact column (preserves existing values). The field now
-- holds a free-text email OR phone number, so it is no longer email-specific.
ALTER TABLE "Visit" RENAME COLUMN "groupEmail" TO "groupContact";
