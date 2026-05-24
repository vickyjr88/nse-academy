-- AlterTable
ALTER TABLE "InvestorProfile" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfile_publicSlug_key" ON "InvestorProfile"("publicSlug");
