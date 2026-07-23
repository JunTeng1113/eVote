import { domainSeparatedHash } from "@/lib/crypto/hash";
import {
  verifyBallotValidity,
  verifyCredentialProof,
} from "@/lib/crypto/zk-proof";
import {
  countBallots,
  requireElection,
  saveBallot,
  saveNamedBallot,
  type SubmittedBallot,
} from "@/lib/store/election-store";
import type { BallotSubmitInput } from "@/lib/schemas/voting";
import {
  getVotingWindowStatus,
  votingWindowMessage,
} from "@/lib/voting-schedule";
import { resolveElectionSchedule } from "@/lib/voting-schedule-server";

type BallotPayload = Omit<BallotSubmitInput, "electionId">;

async function ensureVotingOpen(electionId: string, election: Awaited<ReturnType<typeof requireElection>>) {
  const schedule = await resolveElectionSchedule(electionId, election);
  const status = getVotingWindowStatus(schedule);
  if (status !== "open") {
    return { ok: false as const, error: votingWindowMessage(status) };
  }
  return { ok: true as const };
}

export async function submitBallot(
  electionId: string,
  input: BallotPayload,
) {
  const election = await requireElection(electionId);
  if (election.votingMode !== "anonymous") {
    return { ok: false as const, error: "此場為記名投票，請使用記名投票流程" };
  }
  const open = await ensureVotingOpen(electionId, election);
  if (!open.ok) {
    return open;
  }

  if (
    !verifyCredentialProof(
      election.electionId,
      input.credentialProof,
      election.issuer.n,
      election.issuer.e,
    )
  ) {
    return { ok: false as const, error: "選票驗證失敗，請重新投票" };
  }

  if (election.nullifiers.includes(input.credentialProof.nullifier)) {
    return { ok: false as const, error: "偵測到重複投票，已拒絕此次提交" };
  }

  if (
    !verifyBallotValidity(
      election.threshold.publicKey.pkHex,
      input.ciphertext,
      election.candidates.length,
      input.ballotProof,
    )
  ) {
    return { ok: false as const, error: "選票內容無效，請重新選擇後再送出" };
  }

  const receiptHash = domainSeparatedHash(
    "receipt",
    input.ciphertext.c1,
    input.ciphertext.c2,
    input.credentialProof.nullifier,
    election.electionId,
  );

  const index = await countBallots(electionId);
  const ballot: SubmittedBallot = {
    index,
    ciphertext: input.ciphertext,
    ballotProof: input.ballotProof,
    credentialProof: input.credentialProof,
    nullifier: input.credentialProof.nullifier,
    receiptHash,
    submittedAt: new Date().toISOString(),
  };

  try {
    await saveBallot(electionId, ballot);
  } catch {
    return { ok: false as const, error: "偵測到重複投票，已拒絕此次提交" };
  }

  return {
    ok: true as const,
    receiptHash,
    bulletinIndex: ballot.index,
    electionId: election.electionId,
  };
}

export async function submitNamedBallot(
  electionId: string,
  voterEmail: string,
  candidateId: string,
) {
  const election = await requireElection(electionId);
  if (election.votingMode !== "named") {
    return { ok: false as const, error: "此場為不記名投票" };
  }
  const open = await ensureVotingOpen(electionId, election);
  if (!open.ok) {
    return open;
  }
  if (!election.candidates.some((c) => c.id === candidateId)) {
    return { ok: false as const, error: "請選擇一個選項" };
  }

  const receiptHash = domainSeparatedHash(
    "named-receipt",
    election.electionId,
    voterEmail,
    candidateId,
    crypto.randomUUID(),
  );

  try {
    await saveNamedBallot({
      electionId,
      voterEmail,
      candidateId,
      receiptHash,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "偵測到重複投票，已拒絕此次提交";
    return { ok: false as const, error: message };
  }

  return {
    ok: true as const,
    receiptHash,
    electionId: election.electionId,
  };
}
