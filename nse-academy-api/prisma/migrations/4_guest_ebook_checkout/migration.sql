-- Guest checkout: purchases can exist without a user, keyed by email.
-- Existing rows are backfilled from the owning user's email.

ALTER TABLE "EbookPurchase" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "EbookPurchase" ADD COLUMN IF NOT EXISTS "guestToken" TEXT;
ALTER TABLE "EbookPurchase" ADD COLUMN IF NOT EXISTS "downloadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EbookPurchase" ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMP(3);
ALTER TABLE "EbookPurchase" ADD COLUMN IF NOT EXISTS "emailedAt" TIMESTAMP(3);

UPDATE "EbookPurchase" AS ep
SET "email" = lower(u.email)
FROM "User" AS u
WHERE ep."userId" = u.id
  AND (ep."email" IS NULL OR ep."email" = '');

-- Any leftover rows without an email (shouldn't exist) get a placeholder so NOT NULL can be applied.
UPDATE "EbookPurchase"
SET "email" = 'unknown+' || id || '@nseacademy.local'
WHERE "email" IS NULL OR "email" = '';

UPDATE "EbookPurchase"
SET "guestToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "guestToken" IS NULL OR "guestToken" = '';

ALTER TABLE "EbookPurchase" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "EbookPurchase" ALTER COLUMN "guestToken" SET NOT NULL;

ALTER TABLE "EbookPurchase" ALTER COLUMN "userId" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "EbookPurchase_guestToken_key" ON "EbookPurchase"("guestToken");
CREATE UNIQUE INDEX IF NOT EXISTS "EbookPurchase_reference_key" ON "EbookPurchase"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "EbookPurchase_email_productId_key" ON "EbookPurchase"("email", "productId");
CREATE INDEX IF NOT EXISTS "EbookPurchase_email_idx" ON "EbookPurchase"("email");
