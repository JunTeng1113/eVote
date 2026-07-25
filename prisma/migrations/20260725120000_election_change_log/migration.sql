-- CreateTable
CREATE TABLE "ElectionChangeLog" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElectionChangeLog_electionId_createdAt_idx" ON "ElectionChangeLog"("electionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ElectionChangeLog" ADD CONSTRAINT "ElectionChangeLog_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;
