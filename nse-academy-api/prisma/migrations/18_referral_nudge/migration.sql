-- AlterTable: stale-referral nudge dedupe flag
ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "nudgeSentAt" TIMESTAMP(3);
