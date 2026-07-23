/**
 * 端到端協定煙霧測試（需 PostgreSQL + DATABASE_URL）
 */
import "dotenv/config";
import {
  blindMessage,
  messageFromCredentialSeed,
  randomBlindingFactor,
  randomCredentialSeed,
  unblindSignature,
  verifyBlindSignature,
} from "../src/lib/crypto/blind-signature";
import { encryptBallot } from "../src/lib/crypto/elgamal";
import {
  createCredentialProof,
  proveBallotValidity,
} from "../src/lib/crypto/zk-proof";
import {
  addEligibleEmails,
  createElection,
  listElections,
  resetElectionStore,
} from "../src/lib/store/election-store";
import { issueAuthTicket } from "../src/lib/services/auth-service";
import { issueBlindSignature } from "../src/lib/services/credential-service";
import { submitBallot } from "../src/lib/services/ballot-service";
import { closeVoting, runTally } from "../src/lib/services/tally-service";
import { runUniversalAudit } from "../src/lib/services/audit-service";
import { prisma } from "../src/lib/db";

async function main() {
  const store = await resetElectionStore(false);
  await addEligibleEmails(store.electionId, [
    "alice@example.com",
    "bob@example.com",
  ]);

  await createElection({
    title: "第二場投票",
    candidates: [
      { name: "甲", party: "A" },
      { name: "乙", party: "B" },
    ],
    voterEmails: ["alice@example.com"],
  });

  const auth = await issueAuthTicket(store.electionId, "alice@example.com");
  if (!auth.ok) throw new Error(auth.error);

  const seed = randomCredentialSeed();
  const messageHex = messageFromCredentialSeed(store.electionId, seed);
  const blinding = randomBlindingFactor(store.issuer.n);
  const blindedMessage = blindMessage(
    messageHex,
    blinding,
    store.issuer.n,
    store.issuer.e,
  );
  const issued = await issueBlindSignature(
    store.electionId,
    auth.authTicket,
    blindedMessage,
  );
  if (!issued.ok) throw new Error(issued.error);

  const signatureHex = unblindSignature(
    issued.blindedSignature,
    blinding,
    store.issuer.n,
  );
  if (
    !verifyBlindSignature(
      messageHex,
      signatureHex,
      store.issuer.n,
      store.issuer.e,
    )
  ) {
    throw new Error("blind sig verify failed");
  }

  const { ciphertext, randomnessHex } = encryptBallot(
    store.threshold.publicKey.pkHex,
    1,
  );
  const ballotProof = proveBallotValidity(
    store.threshold.publicKey.pkHex,
    ciphertext,
    1,
    store.candidates.length,
    randomnessHex,
  );
  const credentialProof = createCredentialProof(
    store.electionId,
    messageHex,
    signatureHex,
    store.issuer.n,
    store.issuer.e,
  );
  if (!credentialProof) throw new Error("cred proof failed");

  const submitted = await submitBallot(store.electionId, {
    ciphertext,
    ballotProof,
    credentialProof,
  });
  if (!submitted.ok) throw new Error(submitted.error);

  const auth2 = await issueAuthTicket(store.electionId, "bob@example.com");
  if (!auth2.ok) throw new Error(auth2.error);
  const seed2 = randomCredentialSeed();
  const msg2 = messageFromCredentialSeed(store.electionId, seed2);
  const blind2 = randomBlindingFactor(store.issuer.n);
  const blinded2 = blindMessage(msg2, blind2, store.issuer.n, store.issuer.e);
  const issued2 = await issueBlindSignature(
    store.electionId,
    auth2.authTicket,
    blinded2,
  );
  if (!issued2.ok) throw new Error(issued2.error);
  const sig2 = unblindSignature(
    issued2.blindedSignature,
    blind2,
    store.issuer.n,
  );
  const enc2 = encryptBallot(store.threshold.publicKey.pkHex, 0);
  const proof2 = proveBallotValidity(
    store.threshold.publicKey.pkHex,
    enc2.ciphertext,
    0,
    store.candidates.length,
    enc2.randomnessHex,
  );
  const cred2 = createCredentialProof(
    store.electionId,
    msg2,
    sig2,
    store.issuer.n,
    store.issuer.e,
  );
  if (!cred2) throw new Error("cred2 failed");
  const sub2 = await submitBallot(store.electionId, {
    ciphertext: enc2.ciphertext,
    ballotProof: proof2,
    credentialProof: cred2,
  });
  if (!sub2.ok) throw new Error(sub2.error);

  const closed = await closeVoting(store.electionId);
  if (!closed.ok) throw new Error(closed.error);
  const tallied = await runTally(store.electionId);
  if (!tallied.ok) throw new Error(tallied.error);

  const audit = await runUniversalAudit(store.electionId);
  if (!audit.passed) {
    console.error(audit.checks);
    throw new Error("audit failed");
  }

  const elections = await listElections();
  if (elections.length < 2) {
    throw new Error("expected multiple elections");
  }

  console.log(
    "SMOKE OK",
    tallied.tally.counts,
    "elections",
    elections.length,
    "audit passed",
  );
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
