-- CreateTable
CREATE TABLE "BroadcastCampaign" (
    "id" TEXT NOT NULL,
    "brevoCampaignId" INTEGER,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "tier" TEXT,
    "audienceCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastCampaign_pkey" PRIMARY KEY ("id")
);
