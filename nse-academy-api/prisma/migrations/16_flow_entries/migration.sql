-- AlterTable: 5-day post-expiry renewal-nudge dedupe flag (distinct from
-- and earlier than winbackSentAt at 7 days)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "renewalNudgeSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FlowEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,

    CONSTRAINT "FlowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowEntry_flow_enteredAt_idx" ON "FlowEntry"("flow", "enteredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FlowEntry_userId_flow_idx" ON "FlowEntry"("userId", "flow");

-- AddForeignKey
ALTER TABLE "FlowEntry" ADD CONSTRAINT "FlowEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
