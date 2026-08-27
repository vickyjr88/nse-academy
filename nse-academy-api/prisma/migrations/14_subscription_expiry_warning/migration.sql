-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "expiryWarningSentAt" TIMESTAMP(3);
