-- CreateTable
CREATE TABLE "OnlinePresence" (
    "deviceId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePresence_pkey" PRIMARY KEY ("deviceId")
);

-- CreateIndex
CREATE INDEX "OnlinePresence_lastSeenAt_idx" ON "OnlinePresence"("lastSeenAt");
