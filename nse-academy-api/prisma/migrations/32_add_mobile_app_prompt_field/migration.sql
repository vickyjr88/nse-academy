-- Add mobile app download prompt tracking field
ALTER TABLE "User" ADD COLUMN "mobileAppPromptSentAt" TIMESTAMP(3);
