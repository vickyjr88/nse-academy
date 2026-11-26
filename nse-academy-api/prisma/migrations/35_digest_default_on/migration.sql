-- The evening digest is now on for every member until they switch it off.

-- Recorded when a member switches it off (or uses the unsubscribe link), so it is never switched back on for them.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "digestOptedOutAt" TIMESTAMP(3);

-- A member who is off now but has been sent a digest had it on and switched it off. That is an opt-out: keep it.
UPDATE "User" SET "digestOptedOutAt" = CURRENT_TIMESTAMP
WHERE "digestEnabled" = false AND "digestLastSentOn" IS NOT NULL AND "digestOptedOutAt" IS NULL;

-- New accounts start with it on.
ALTER TABLE "User" ALTER COLUMN "digestEnabled" SET DEFAULT true;

-- Switch it on for everyone else.
UPDATE "User" SET "digestEnabled" = true
WHERE "digestEnabled" = false AND "digestOptedOutAt" IS NULL;
