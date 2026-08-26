-- Financial advisor module: advisor profiles, client connections, queries, insights, alerts.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdvisorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "specialties" TEXT[] NOT NULL DEFAULT '{}',
    "credentials" TEXT,
    "photoUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorClient" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'request',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "AdvisorClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorQuery" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "reply" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "AdvisorQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorInsight" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tickers" TEXT[] NOT NULL DEFAULT '{}',
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorAlert" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorProfile_orgId_key" ON "AdvisorProfile"("orgId");

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorClient_advisorId_userId_key" ON "AdvisorClient"("advisorId", "userId");
CREATE INDEX IF NOT EXISTS "AdvisorClient_userId_idx" ON "AdvisorClient"("userId");
CREATE INDEX IF NOT EXISTS "AdvisorClient_advisorId_status_idx" ON "AdvisorClient"("advisorId", "status");

CREATE INDEX IF NOT EXISTS "AdvisorQuery_advisorId_status_idx" ON "AdvisorQuery"("advisorId", "status");
CREATE INDEX IF NOT EXISTS "AdvisorQuery_userId_idx" ON "AdvisorQuery"("userId");

CREATE INDEX IF NOT EXISTS "AdvisorInsight_advisorId_createdAt_idx" ON "AdvisorInsight"("advisorId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdvisorAlert_advisorId_createdAt_idx" ON "AdvisorAlert"("advisorId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisorClient" ADD CONSTRAINT "AdvisorClient_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvisorClient" ADD CONSTRAINT "AdvisorClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisorQuery" ADD CONSTRAINT "AdvisorQuery_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvisorQuery" ADD CONSTRAINT "AdvisorQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisorInsight" ADD CONSTRAINT "AdvisorInsight_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisorAlert" ADD CONSTRAINT "AdvisorAlert_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "AdvisorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
