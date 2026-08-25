-- Dividend tracking and realized gains (portfolio performance).

-- CreateTable
CREATE TABLE IF NOT EXISTS "Dividend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT,
    "amountKes" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RealizedGain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT,
    "quantity" INTEGER NOT NULL,
    "proceedsKes" DOUBLE PRECISION NOT NULL,
    "costBasisKes" DOUBLE PRECISION NOT NULL,
    "realizedGainKes" DOUBLE PRECISION NOT NULL,
    "tradeDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealizedGain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dividend_userId_idx" ON "Dividend"("userId");
CREATE INDEX IF NOT EXISTS "Dividend_userId_ticker_idx" ON "Dividend"("userId", "ticker");

CREATE UNIQUE INDEX IF NOT EXISTS "RealizedGain_tradeId_key" ON "RealizedGain"("tradeId");
CREATE INDEX IF NOT EXISTS "RealizedGain_userId_idx" ON "RealizedGain"("userId");
CREATE INDEX IF NOT EXISTS "RealizedGain_userId_tradeDate_idx" ON "RealizedGain"("userId", "tradeDate");
CREATE INDEX IF NOT EXISTS "RealizedGain_userId_ticker_idx" ON "RealizedGain"("userId", "ticker");

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RealizedGain" ADD CONSTRAINT "RealizedGain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RealizedGain" ADD CONSTRAINT "RealizedGain_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RealizedGain" ADD CONSTRAINT "RealizedGain_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
