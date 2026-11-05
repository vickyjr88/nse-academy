-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketReport" (
    "id" TEXT NOT NULL,
    "sessionDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "facts" JSONB NOT NULL,
    "story" JSONB NOT NULL,
    "social" JSONB NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketReport_sessionDate_key" ON "MarketReport"("sessionDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketReport_status_sessionDate_idx" ON "MarketReport"("status", "sessionDate");
