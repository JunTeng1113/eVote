import { verifyShuffleProof } from "@/lib/crypto/mixnet";
import {
  verifyBallotValidity,
  verifyCredentialProof,
} from "@/lib/crypto/zk-proof";
import { verifyDecryptionProof } from "@/lib/crypto/elgamal";
import { listElections, requireElection } from "@/lib/store/election-store";

export async function runUniversalAudit(electionId: string) {
  const election = await requireElection(electionId);
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

  if (election.votingMode === "named") {
    const authorized = election.voters.filter((v) => v.authorized).length;
    checks.push({
      name: "記名選票檢查",
      passed: election.namedBallots.length === authorized,
      detail: `記名票 ${election.namedBallots.length}／已投票 ${authorized}`,
    });
    checks.push({
      name: "資格人數檢查",
      passed:
        election.namedBallots.length <= authorized &&
        authorized <= election.voters.length,
      detail: `票數 ${election.namedBallots.length}／已投票 ${authorized}／名單 ${election.voters.length}`,
    });
    if (election.tally) {
      const recount: Record<string, number> = {};
      for (const c of election.candidates) {
        recount[c.id] = 0;
      }
      for (const vote of election.tally.namedVotes ?? []) {
        recount[vote.candidateId] = (recount[vote.candidateId] ?? 0) + 1;
      }
      const countsMatch = election.candidates.every(
        (c) => (recount[c.id] ?? 0) === (election.tally?.counts[c.id] ?? 0),
      );
      checks.push({
        name: "計票一致性",
        passed:
          countsMatch &&
          election.tally.total === election.namedBallots.length,
        detail: countsMatch ? "一致" : "不一致",
      });
    } else {
      checks.push({
        name: "計票一致性",
        passed: false,
        detail: "尚未開票",
      });
    }
    const pendingOk = checks
      .filter((c) => c.detail !== "尚未開票")
      .every((c) => c.passed);
    return {
      electionId: election.electionId,
      phase: election.phase,
      checks,
      passed: election.tally ? checks.every((c) => c.passed) : pendingOk,
      individualHint: "此場為記名投票，開票後可對照投票權人與選項。",
    };
  }

  if (election.votingMode === "open") {
    const guestCount = election.guestBallots.length;
    const uniqueIps = new Set(election.guestBallots.map((b) => b.ipHash));
    checks.push({
      name: "公開連結選票檢查",
      passed: uniqueIps.size === guestCount,
      detail: `票數 ${guestCount}／獨立連線 ${uniqueIps.size}`,
    });
    if (election.tally) {
      const recount: Record<string, number> = {};
      for (const c of election.candidates) {
        recount[c.id] = 0;
      }
      for (const ballot of election.guestBallots) {
        recount[ballot.candidateId] = (recount[ballot.candidateId] ?? 0) + 1;
      }
      const countsMatch = election.candidates.every(
        (c) => (recount[c.id] ?? 0) === (election.tally?.counts[c.id] ?? 0),
      );
      checks.push({
        name: "計票一致性",
        passed: countsMatch && election.tally.total === guestCount,
        detail: countsMatch ? "一致" : "不一致",
      });
    } else {
      checks.push({
        name: "計票一致性",
        passed: false,
        detail: "尚未開票",
      });
    }
    const pendingOk = checks
      .filter((c) => c.detail !== "尚未開票")
      .every((c) => c.passed);
    return {
      electionId: election.electionId,
      phase: election.phase,
      checks,
      passed: election.tally ? checks.every((c) => c.passed) : pendingOk,
      individualHint:
        "此場為無須登入投票，以連線位址雜湊防重複；確認碼可證明有投到。",
    };
  }

  let ballotOk = 0;
  for (const ballot of election.ballots) {
    const credOk = verifyCredentialProof(
      election.electionId,
      ballot.credentialProof,
      election.issuer.n,
      election.issuer.e,
    );
    const formatOk = verifyBallotValidity(
      election.threshold.publicKey.pkHex,
      ballot.ciphertext,
      election.candidates.length,
      ballot.ballotProof,
    );
    if (credOk && formatOk) {
      ballotOk += 1;
    }
  }
  checks.push({
    name: "選票驗證",
    passed: ballotOk === election.ballots.length,
    detail: `${ballotOk}/${election.ballots.length} 張有效`,
  });

  const unique = new Set(election.nullifiers);
  checks.push({
    name: "重複投票檢查",
    passed: unique.size === election.nullifiers.length,
    detail: `獨立選票 ${unique.size} 筆`,
  });

  const authorized = election.voters.filter((v) => v.authorized).length;
  checks.push({
    name: "資格人數檢查",
    passed:
      election.ballots.length <= authorized &&
      authorized <= election.voters.length,
    detail: `票數 ${election.ballots.length}／已投票 ${authorized}／名單 ${election.voters.length}`,
  });

  if (election.tally) {
    let mixOk = election.tally.mixProofs.length === election.mixServers.length;
    for (let i = 0; i < election.tally.mixProofs.length; i += 1) {
      const inputs = election.tally.mixLayers[i];
      const outputs = election.tally.mixLayers[i + 1];
      const proof = election.tally.mixProofs[i];
      if (!inputs || !outputs || !proof) {
        mixOk = false;
        break;
      }
      if (!verifyShuffleProof(proof, inputs, outputs)) {
        mixOk = false;
        break;
      }
    }
    checks.push({
      name: "開票混洗檢查",
      passed: mixOk,
      detail: mixOk ? "通過" : "失敗",
    });

    let decOk = 0;
    for (const item of election.tally.decryptionProofs) {
      const idx = election.candidates.findIndex(
        (c) => c.id === item.candidateId,
      );
      if (idx < 0) {
        continue;
      }
      if (
        verifyDecryptionProof(
          election.threshold.publicKey.pkHex,
          item.ciphertext,
          idx,
          item.proof,
        )
      ) {
        decOk += 1;
      }
    }
    checks.push({
      name: "開票結果檢查",
      passed: decOk === election.tally.decryptionProofs.length,
      detail: `${decOk}/${election.tally.decryptionProofs.length} 筆通過`,
    });

    const recount: Record<string, number> = {};
    for (const c of election.candidates) {
      recount[c.id] = 0;
    }
    for (const item of election.tally.decryptionProofs) {
      recount[item.candidateId] = (recount[item.candidateId] ?? 0) + 1;
    }
    const countsMatch = election.candidates.every(
      (c) => (recount[c.id] ?? 0) === (election.tally?.counts[c.id] ?? 0),
    );
    checks.push({
      name: "計票一致性",
      passed: countsMatch && election.tally.total === election.ballots.length,
      detail: countsMatch ? "一致" : "不一致",
    });
  } else {
    checks.push({
      name: "開票混洗檢查",
      passed: false,
      detail: "尚未開票",
    });
    checks.push({
      name: "開票結果檢查",
      passed: false,
      detail: "尚未開票",
    });
  }

  const pendingOk = checks
    .filter((c) => c.detail !== "尚未開票")
    .every((c) => c.passed);
  const strictPassed = checks.every((c) => c.passed);

  return {
    electionId: election.electionId,
    phase: election.phase,
    checks,
    passed: election.tally ? strictPassed : pendingOk,
    individualHint: "投票權人可用確認碼確認票有被收錄，系統不會顯示投票內容。",
  };
}

export async function findReceipt(electionId: string, receiptHash: string) {
  const election = await requireElection(electionId);
  const ballot = election.ballots.find((b) => b.receiptHash === receiptHash);
  if (ballot) {
    return {
      found: true as const,
      votingMode: election.votingMode,
      electionId: election.electionId,
      electionTitle: election.title,
      bulletinIndex: ballot.index,
      submittedAt: ballot.submittedAt,
      nullifierPrefix: ballot.nullifier.slice(0, 8),
    };
  }

  const namedIndex = election.namedBallots.findIndex(
    (b) => b.receiptHash === receiptHash,
  );
  if (namedIndex >= 0) {
    const named = election.namedBallots[namedIndex];
    return {
      found: true as const,
      votingMode: election.votingMode,
      electionId: election.electionId,
      electionTitle: election.title,
      bulletinIndex: namedIndex + 1,
      submittedAt: named.submittedAt,
    };
  }

  const guestIndex = election.guestBallots.findIndex(
    (b) => b.receiptHash === receiptHash,
  );
  if (guestIndex >= 0) {
    const guest = election.guestBallots[guestIndex];
    return {
      found: true as const,
      votingMode: election.votingMode,
      electionId: election.electionId,
      electionTitle: election.title,
      bulletinIndex: guestIndex + 1,
      submittedAt: guest.submittedAt,
    };
  }

  return { found: false as const };
}

export async function findReceiptAnywhere(receiptHash: string) {
  const elections = await listElections();
  for (const election of elections) {
    const ballot = election.ballots.find((b) => b.receiptHash === receiptHash);
    if (ballot) {
      return {
        found: true as const,
        votingMode: election.votingMode,
        electionId: election.electionId,
        electionTitle: election.title,
        bulletinIndex: ballot.index,
        submittedAt: ballot.submittedAt,
        nullifierPrefix: ballot.nullifier.slice(0, 8),
      };
    }
    const namedIndex = election.namedBallots.findIndex(
      (b) => b.receiptHash === receiptHash,
    );
    if (namedIndex >= 0) {
      const named = election.namedBallots[namedIndex];
      return {
        found: true as const,
        votingMode: election.votingMode,
        electionId: election.electionId,
        electionTitle: election.title,
        bulletinIndex: namedIndex + 1,
        submittedAt: named.submittedAt,
      };
    }
    const guestIndex = election.guestBallots.findIndex(
      (b) => b.receiptHash === receiptHash,
    );
    if (guestIndex >= 0) {
      const guest = election.guestBallots[guestIndex];
      return {
        found: true as const,
        votingMode: election.votingMode,
        electionId: election.electionId,
        electionTitle: election.title,
        bulletinIndex: guestIndex + 1,
        submittedAt: guest.submittedAt,
      };
    }
  }
  return { found: false as const };
}
