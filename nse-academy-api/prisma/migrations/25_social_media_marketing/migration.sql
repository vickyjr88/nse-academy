-- CreateTable "SocialMediaCredential"
CREATE TABLE "SocialMediaCredential" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessTokenSecret" TEXT,
    "refreshToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMediaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable "SocialMediaPost"
CREATE TABLE "SocialMediaPost" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportId" TEXT,
    "externalPostId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'published',
    "error" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMediaPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaCredential_platform_accountName_key" ON "SocialMediaCredential"("platform", "accountName");

-- CreateIndex
CREATE INDEX "SocialMediaCredential_platform_isActive_idx" ON "SocialMediaCredential"("platform", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaPost_platform_externalPostId_key" ON "SocialMediaPost"("platform", "externalPostId");

-- CreateIndex
CREATE INDEX "SocialMediaPost_credentialId_platform_idx" ON "SocialMediaPost"("credentialId", "platform");

-- CreateIndex
CREATE INDEX "SocialMediaPost_reportId_idx" ON "SocialMediaPost"("reportId");

-- CreateIndex
CREATE INDEX "SocialMediaPost_publishedAt_idx" ON "SocialMediaPost"("publishedAt");

-- AddForeignKey
ALTER TABLE "SocialMediaPost" ADD CONSTRAINT "SocialMediaPost_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "SocialMediaCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
