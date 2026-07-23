import {
  combineAdditiveShares,
  decryptWithSecret,
  proveDecryption,
} from "@/lib/crypto/elgamal";
import type { ElGamalCiphertext } from "@/lib/crypto/elgamal";
import { verifiableShuffle, verifyShuffleProof } from "@/lib/crypto/mixnet";
import {
  requireElection,
  saveTallyResult,
  updateElectionPhase,
  type TallyResult,
} from "@/lib/store/election-store";
import {
  canReopenVoting,
  electionScheduleFrom,
} from "@/lib/voting-schedule";

export async function closeVoting(electionId: string) {
  const election = await requireElection(electionId);
  if (election.phase !== "voting") {
    return { ok: false as const, error: "目前階段無法截止投票" };
  }
  await updateElectionPhase(electionId, "closed");
  return { ok: true as const, ballotCount: election.ballots.length };
}

export async function reopenVoting(electionId: string) {
  const election = await requireElection(electionId);
  if (election.phase !== "closed") {
    return {
      ok: false as const,
      error: "僅已截止且尚未開票的投票可恢復投票",
    };
  }
  const schedule = electionScheduleFrom(election);
  if (!canReopenVoting(schedule)) {
    return {
      ok: false as const,
      error: "投票時間已過，無法恢復投票",
    };
  }
  await updateElectionPhase(electionId, "voting");
  return { ok: true as const, ballotCount: election.ballots.length };
}

export async function runTally(electionId: string) {
  const election = await requireElection(electionId);
  if (election.phase !== "closed" && election.phase !== "mixing") {
    if (election.phase === "tallied" && election.tally) {
      return { ok: true as const, tally: election.tally, cached: true };
    }
    return { ok: false as const, error: "請先截止投票再開票" };
  }

  if (election.votingMode === "named") {
    if (election.namedBallots.length === 0) {
      return { ok: false as const, error: "尚無選票可開票" };
    }
    const counts: Record<string, number> = {};
    for (const c of election.candidates) {
      counts[c.id] = 0;
    }
    for (const ballot of election.namedBallots) {
      counts[ballot.candidateId] = (counts[ballot.candidateId] ?? 0) + 1;
    }
    const tally: TallyResult = {
      counts,
      total: election.namedBallots.length,
      mixLayers: [],
      mixedCiphertexts: [],
      mixProofs: [],
      decryptionProofs: [],
      namedVotes: election.namedBallots.map((b) => ({
        email: b.voterEmail,
        candidateId: b.candidateId,
      })),
      talliedAt: new Date().toISOString(),
    };
    await saveTallyResult(electionId, tally);
    return { ok: true as const, tally, cached: false };
  }

  if (election.ballots.length === 0) {
    return { ok: false as const, error: "尚無選票可開票" };
  }

  await updateElectionPhase(electionId, "mixing");
  const pkHex = election.threshold.publicKey.pkHex;
  const mixLayers: ElGamalCiphertext[][] = [
    election.ballots.map((b) => b.ciphertext),
  ];
  let layer = mixLayers[0]!;
  const mixProofs = [];

  for (const serverId of election.mixServers) {
    const result = verifiableShuffle(serverId, pkHex, layer);
    if (!verifyShuffleProof(result.proof, layer, result.outputs)) {
      return { ok: false as const, error: "混洗步驟失敗，請重試" };
    }
    mixProofs.push(result.proof);
    layer = result.outputs;
    mixLayers.push(layer);
  }

  const activeShares = election.threshold.shares
    .filter((s) => s.skShareHex !== "0")
    .slice(0, election.threshold.thresholdK);
  if (activeShares.length < election.threshold.thresholdK) {
    return { ok: false as const, error: "開票金鑰不足" };
  }
  const skHex = combineAdditiveShares(activeShares);

  const counts: Record<string, number> = {};
  for (const c of election.candidates) {
    counts[c.id] = 0;
  }

  const decryptionProofs: TallyResult["decryptionProofs"] = [];
  for (const ct of layer) {
    const idx = decryptWithSecret(skHex, ct, election.candidates.length);
    if (idx === null) {
      return { ok: false as const, error: "開票失敗，請聯繫系統管理員" };
    }
    const candidate = election.candidates[idx]!;
    counts[candidate.id] = (counts[candidate.id] ?? 0) + 1;
    decryptionProofs.push({
      ciphertext: ct,
      candidateId: candidate.id,
      proof: proveDecryption(skHex, ct, idx),
    });
  }

  const tally: TallyResult = {
    counts,
    total: layer.length,
    mixLayers,
    mixedCiphertexts: layer,
    mixProofs,
    decryptionProofs,
    talliedAt: new Date().toISOString(),
  };
  await saveTallyResult(electionId, tally);
  return { ok: true as const, tally, cached: false };
}
