-- AlterEnum
CREATE TYPE "VotingMode" AS ENUM ('anonymous', 'named');

-- AlterTable
ALTER TABLE "Election" ADD COLUMN "votingMode" "VotingMode" NOT NULL DEFAULT 'anonymous';

-- CreateTable
CREATE TABLE "NamedBallot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "voterEmail" TEXT NOT NULL,
    "candidateKey" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NamedBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NamedBallot_receiptHash_key" ON "NamedBallot"("receiptHash");

-- CreateIndex
CREATE INDEX "NamedBallot_electionId_idx" ON "NamedBallot"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "NamedBallot_electionId_voterEmail_key" ON "NamedBallot"("electionId", "voterEmail");

-- AddForeignKey
ALTER TABLE "NamedBallot" ADD CONSTRAINT "NamedBallot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;
