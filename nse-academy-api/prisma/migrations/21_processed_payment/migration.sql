-- Idempotency record for subscription payments (see ProcessedPayment in schema.prisma). Additive.
CREATE TABLE IF NOT EXISTS "ProcessedPayment" (
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedPayment_pkey" PRIMARY KEY ("reference")
);
CREATE INDEX IF NOT EXISTS "ProcessedPayment_userId_idx" ON "ProcessedPayment"("userId");
