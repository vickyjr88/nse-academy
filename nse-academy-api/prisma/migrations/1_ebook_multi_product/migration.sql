-- Add productId column with a temporary default so existing rows are not rejected
ALTER TABLE "EbookPurchase" ADD COLUMN IF NOT EXISTS "productId" TEXT NOT NULL DEFAULT 'legacy';

-- Remove the temporary default (new rows must supply productId explicitly)
ALTER TABLE "EbookPurchase" ALTER COLUMN "productId" DROP DEFAULT;

-- Drop old single-column unique constraint on userId
DROP INDEX IF EXISTS "EbookPurchase_userId_key";

-- Add composite unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "EbookPurchase_userId_productId_key" ON "EbookPurchase"("userId", "productId");
