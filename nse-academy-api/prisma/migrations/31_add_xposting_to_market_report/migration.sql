-- Add X posting fields to MarketReport for social media integration
ALTER TABLE "MarketReport" ADD COLUMN "xPosted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketReport" ADD COLUMN "xPostId" TEXT;
ALTER TABLE "MarketReport" ADD COLUMN "xError" TEXT;
ALTER TABLE "MarketReport" ADD COLUMN "lastXAttemptAt" TIMESTAMP(3);
ALTER TABLE "MarketReport" ADD COLUMN "cardImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create indexes for X posting queries
CREATE INDEX "MarketReport_xPosted_idx" ON "MarketReport"("xPosted");
CREATE INDEX "MarketReport_lastXAttemptAt_idx" ON "MarketReport"("lastXAttemptAt");
