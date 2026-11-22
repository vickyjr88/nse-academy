-- Hourly X posting config, slot idempotency, and budgeted read tracking.
ALTER TABLE "SocialMediaCredential" ADD COLUMN "bearerToken" TEXT;
ALTER TABLE "SocialMediaPost" ADD COLUMN "quoteTweetId" TEXT;

CREATE TABLE "XAutomationConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XAutomationConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "XSlotRun" (
    "id" TEXT NOT NULL,
    "sessionDate" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "fingerprint" TEXT,
    "lessonIndex" INTEGER,
    "postId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XSlotRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "XSlotRun_sessionDate_slotId_key" ON "XSlotRun"("sessionDate", "slotId");
CREATE INDEX "XSlotRun_sessionDate_idx" ON "XSlotRun"("sessionDate");

CREATE TABLE "XStreamItem" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ruleTag" TEXT,
    "draftPostId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XStreamItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "XStreamItem_externalId_key" ON "XStreamItem"("externalId");
CREATE INDEX "XStreamItem_receivedAt_idx" ON "XStreamItem"("receivedAt");

CREATE TABLE "XReadSpend" (
    "bucket" TEXT NOT NULL,
    "posts" INTEGER NOT NULL DEFAULT 0,
    "usd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "XReadSpend_pkey" PRIMARY KEY ("bucket")
);

CREATE TABLE "XStreamCursor" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "sinceId" TEXT,

    CONSTRAINT "XStreamCursor_pkey" PRIMARY KEY ("id")
);
