-- Offline (non-Paystack) corporate license payments.

-- AlterTable
ALTER TABLE "CorporateLicense" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'paystack';
ALTER TABLE "CorporateLicense" ADD COLUMN IF NOT EXISTS "offlineReference" TEXT;
ALTER TABLE "CorporateLicense" ALTER COLUMN "paystackReference" DROP NOT NULL;
