-- Advisor queries become threaded conversations, and advisor profiles gain
-- an admin approval gate.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdvisorQueryMessage" (
    "id"         TEXT NOT NULL,
    "queryId"    TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorQueryMessage_pkey" PRIMARY KEY ("id")
);

-- AlterTable: AdvisorQuery gains subject/updatedAt ahead of the backfill.
ALTER TABLE "AdvisorQuery" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "AdvisorQuery" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: subject from the existing question column.
UPDATE "AdvisorQuery" SET "subject" = LEFT("question", 140) WHERE "subject" IS NULL;

-- Backfill: each existing question becomes the thread's first client message.
INSERT INTO "AdvisorQueryMessage" ("id", "queryId", "senderRole", "body", "createdAt")
SELECT gen_random_uuid()::text, "id", 'client', "question", "createdAt"
FROM "AdvisorQuery"
WHERE "question" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill: each existing non-null reply becomes the thread's first advisor message.
INSERT INTO "AdvisorQueryMessage" ("id", "queryId", "senderRole", "body", "createdAt")
SELECT gen_random_uuid()::text, "id", 'advisor', "reply", COALESCE("answeredAt", "createdAt")
FROM "AdvisorQuery"
WHERE "reply" IS NOT NULL
ON CONFLICT DO NOTHING;

-- AlterTable: drop the now-migrated flat columns, make subject required.
ALTER TABLE "AdvisorQuery" ALTER COLUMN "subject" SET NOT NULL;
ALTER TABLE "AdvisorQuery" DROP COLUMN IF EXISTS "question";
ALTER TABLE "AdvisorQuery" DROP COLUMN IF EXISTS "reply";
ALTER TABLE "AdvisorQuery" DROP COLUMN IF EXISTS "answeredAt";

-- AlterTable: advisor approval gate.
ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "AdvisorProfile" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdvisorQueryMessage_queryId_createdAt_idx" ON "AdvisorQueryMessage"("queryId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdvisorQueryMessage" ADD CONSTRAINT "AdvisorQueryMessage_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "AdvisorQuery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
