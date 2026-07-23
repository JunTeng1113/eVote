-- AlterEnum
ALTER TYPE "VotingMode" ADD VALUE 'open';

-- CreateTable
CREATE TABLE "GuestBallot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "candidateKey" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestBallot_receiptHash_key" ON "GuestBallot"("receiptHash");

-- CreateIndex
CREATE INDEX "GuestBallot_electionId_idx" ON "GuestBallot"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestBallot_electionId_ipHash_key" ON "GuestBallot"("electionId", "ipHash");

-- AddForeignKey
ALTER TABLE "GuestBallot" ADD CONSTRAINT "GuestBallot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;
