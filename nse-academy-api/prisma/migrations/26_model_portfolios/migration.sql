-- Model portfolios and their holdings. Additive.
CREATE TABLE IF NOT EXISTS "ModelPortfolio" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskProfile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewedBy" TEXT,
    "inceptionDate" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelPortfolio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModelPortfolio_slug_key" ON "ModelPortfolio"("slug");
CREATE INDEX IF NOT EXISTS "ModelPortfolio_status_idx" ON "ModelPortfolio"("status");

CREATE TABLE IF NOT EXISTS "ModelPortfolioHolding" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "weightPct" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    CONSTRAINT "ModelPortfolioHolding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModelPortfolioHolding_modelId_ticker_key" ON "ModelPortfolioHolding"("modelId", "ticker");
DO $$ BEGIN
  ALTER TABLE "ModelPortfolioHolding" ADD CONSTRAINT "ModelPortfolioHolding_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
