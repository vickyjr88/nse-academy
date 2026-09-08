-- AlterTable: lifecycle-email dedupe flags on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "day1EmailSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "day7EmailSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "day14EmailSentAt" TIMESTAMP(3);

-- AlterTable: win-back dedupe flag on Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "winbackSentAt" TIMESTAMP(3);

-- AlterTable: expiry-warning dedupe flag on CorporateLicense (this table had
-- no expiry reminder at all before the lifecycle module added one)
ALTER TABLE "CorporateLicense" ADD COLUMN IF NOT EXISTS "expiryWarningSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserTag" (
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("userId","tagId")
);

-- AddForeignKey
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
