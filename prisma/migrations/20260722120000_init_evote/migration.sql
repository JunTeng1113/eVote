-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ElectionPhase" AS ENUM ('voting', 'closed', 'mixing', 'tallied');

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "phase" "ElectionPhase" NOT NULL DEFAULT 'voting',
    "mixServers" JSONB NOT NULL,
    "issuer" JSONB NOT NULL,
    "threshold" JSONB NOT NULL,
    "tally" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibleVoter" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "authorized" BOOLEAN NOT NULL DEFAULT false,
    "authTicketHash" TEXT,
    "authorizedAt" TIMESTAMP(3),

    CONSTRAINT "EligibleVoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthTicket" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ballot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "ciphertext" JSONB NOT NULL,
    "ballotProof" JSONB NOT NULL,
    "credentialProof" JSONB NOT NULL,
    "nullifier" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Election_electionId_key" ON "Election"("electionId");

-- CreateIndex
CREATE INDEX "Election_createdAt_idx" ON "Election"("createdAt");

-- CreateIndex
CREATE INDEX "Candidate_electionId_sortOrder_idx" ON "Candidate"("electionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_electionId_key_key" ON "Candidate"("electionId", "key");

-- CreateIndex
CREATE INDEX "EligibleVoter_electionId_authorized_idx" ON "EligibleVoter"("electionId", "authorized");

-- CreateIndex
CREATE UNIQUE INDEX "EligibleVoter_electionId_email_key" ON "EligibleVoter"("electionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthTicket_ticket_key" ON "AuthTicket"("ticket");

-- CreateIndex
CREATE INDEX "AuthTicket_electionId_voterId_idx" ON "AuthTicket"("electionId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_receiptHash_key" ON "Ballot"("receiptHash");

-- CreateIndex
CREATE INDEX "Ballot_electionId_idx" ON "Ballot"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_electionId_nullifier_key" ON "Ballot"("electionId", "nullifier");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_electionId_index_key" ON "Ballot"("electionId", "index");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibleVoter" ADD CONSTRAINT "EligibleVoter_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthTicket" ADD CONSTRAINT "AuthTicket_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("electionId") ON DELETE CASCADE ON UPDATE CASCADE;
