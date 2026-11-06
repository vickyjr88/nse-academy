-- Audit trail, member activity, first-party page views and signup attribution. Additive.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "statusCode" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "detail" JSONB,
    "ip" TEXT,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_at_idx" ON "AdminAuditLog"("at");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actor_at_idx" ON "AdminAuditLog"("actor", "at");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "ActivityDay" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("userId", "day")
);
CREATE INDEX IF NOT EXISTS "ActivityDay_day_idx" ON "ActivityDay"("day");
DO $$ BEGIN
  ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "device" TEXT NOT NULL,
    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PageView_at_idx" ON "PageView"("at");
CREATE INDEX IF NOT EXISTS "PageView_visitorId_at_idx" ON "PageView"("visitorId", "at");

CREATE TABLE IF NOT EXISTS "SignupAttribution" (
    "userId" TEXT NOT NULL,
    "visitorId" TEXT,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "landingPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignupAttribution_pkey" PRIMARY KEY ("userId")
);
DO $$ BEGIN
  ALTER TABLE "SignupAttribution" ADD CONSTRAINT "SignupAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
