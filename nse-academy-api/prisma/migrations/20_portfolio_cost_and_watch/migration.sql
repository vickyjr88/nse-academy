-- Cost provenance on holdings, the portfolio-watch opt-out, and the alert log.
-- All additive; the backfill only touches holdings that have no cost yet.

ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "costSource" TEXT;
ALTER TABLE "Holding" ADD COLUMN IF NOT EXISTS "costDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "portfolioWatchEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "PortfolioAlertLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioAlertLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortfolioAlertLog_userId_key_sentAt_idx" ON "PortfolioAlertLog"("userId", "key", "sentAt");
DO $$ BEGIN
  ALTER TABLE "PortfolioAlertLog" ADD CONSTRAINT "PortfolioAlertLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: statement-imported holdings (no cost, no trades behind them) get the
-- last market price recorded at or before the moment they were imported as their
-- estimated buy price. The user can overwrite it from the portfolio page.
WITH priced AS (
  SELECT h."id",
         (SELECT sp."price"     FROM "StockPrice" sp WHERE sp."ticker" = h."ticker" AND sp."price" > 0 AND sp."timestamp" <= h."createdAt" ORDER BY sp."timestamp" DESC LIMIT 1) AS price,
         (SELECT sp."timestamp" FROM "StockPrice" sp WHERE sp."ticker" = h."ticker" AND sp."price" > 0 AND sp."timestamp" <= h."createdAt" ORDER BY sp."timestamp" DESC LIMIT 1) AS ts
  FROM "Holding" h
  WHERE h."avgCost" IS NULL
    AND h."quantity" > 0
    AND NOT EXISTS (SELECT 1 FROM "Trade" t WHERE t."userId" = h."userId" AND t."brokerId" = h."brokerId" AND t."ticker" = h."ticker")
)
UPDATE "Holding" h
SET "avgCost" = priced.price, "costSource" = 'IMPORT_PRICE', "costDate" = priced.ts
FROM priced
WHERE h."id" = priced."id" AND priced.price IS NOT NULL;
