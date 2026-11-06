-- Operational records for the admin and the daily business report. Additive.
CREATE TABLE IF NOT EXISTS "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "summary" TEXT,
    "error" TEXT,
    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

CREATE TABLE IF NOT EXISTS "AiCall" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT,
    "ok" BOOLEAN NOT NULL,
    "verified" BOOLEAN,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "durationMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "userId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiCall_feature_createdAt_idx" ON "AiCall"("feature", "createdAt");
CREATE INDEX IF NOT EXISTS "AiCall_createdAt_idx" ON "AiCall"("createdAt");
