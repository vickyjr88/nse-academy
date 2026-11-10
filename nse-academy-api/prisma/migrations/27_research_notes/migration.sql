-- Reviewed research notes: monthly focus lists and company briefs. Additive.
CREATE TABLE IF NOT EXISTS "ResearchNote" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tickers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "period" TEXT,
    "facts" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchNote_slug_key" ON "ResearchNote"("slug");
CREATE INDEX IF NOT EXISTS "ResearchNote_kind_status_idx" ON "ResearchNote"("kind", "status");
