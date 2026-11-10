-- Addresses that must not be emailed (bounced, blocked, complained, unsubscribed). Additive.
CREATE TABLE IF NOT EXISTS "EmailSuppression" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("email")
);
