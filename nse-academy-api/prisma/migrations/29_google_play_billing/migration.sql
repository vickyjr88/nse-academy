-- Google Play Billing for the Android app. Additive.
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'paystack';

CREATE TABLE IF NOT EXISTS "PlayPurchase" (
    "purchaseToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "basePlanId" TEXT,
    "orderId" TEXT,
    "tier" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "autoRenewing" BOOLEAN NOT NULL DEFAULT false,
    "expiryTime" TIMESTAMP(3),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "linkedToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayPurchase_pkey" PRIMARY KEY ("purchaseToken"),
    CONSTRAINT "PlayPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlayPurchase_userId_idx" ON "PlayPurchase"("userId");
CREATE INDEX IF NOT EXISTS "PlayPurchase_state_lastSyncedAt_idx" ON "PlayPurchase"("state", "lastSyncedAt");
