-- AlterTable
ALTER TABLE "Election" ADD COLUMN "createdByEmail" TEXT;

-- CreateIndex
CREATE INDEX "Election_createdByEmail_idx" ON "Election"("createdByEmail");

-- CreateTable
CREATE TABLE "ElectionManager" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElectionManager_email_idx" ON "ElectionManager"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionManager_electionId_email_key" ON "ElectionManager"("electionId", "email");

-- AddForeignKey
ALTER TABLE "ElectionManager" ADD CONSTRAINT "ElectionManager_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;
