-- Facebook, Instagram, Threads and TikTok posting on the same slot engine as X.
ALTER TABLE "SocialMediaCredential" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "SocialMediaCredential" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "SocialMediaPost" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "XSlotRun" ADD COLUMN IF NOT EXISTS "deliveries" JSONB;
