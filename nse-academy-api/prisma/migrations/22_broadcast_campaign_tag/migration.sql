-- Remember which tag filter a broadcast used (additive).
ALTER TABLE "BroadcastCampaign" ADD COLUMN IF NOT EXISTS "tagId" TEXT;
