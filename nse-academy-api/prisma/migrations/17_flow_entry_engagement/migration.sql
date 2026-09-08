-- AlterTable: open/click tracking on FlowEntry, written by the Brevo
-- transactional-webhook listener when an "opened"/"click" event arrives.
ALTER TABLE "FlowEntry" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE "FlowEntry" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE "FlowEntry" ADD COLUMN IF NOT EXISTS "clickedUrl" TEXT;
