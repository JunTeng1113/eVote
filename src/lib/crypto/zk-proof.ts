import { Point, CURVE_N, pointFromHex, pointToHex, encodeCandidate, randomScalar } from "@/lib/crypto/elgamal";
import type { ElGamalCiphertext } from "@/lib/crypto/elgamal";
import { hashToScalar, domainSeparatedHash } from "@/lib/crypto/hash";
import { bigintToHex, hexToBigint } from "@/lib/utils";
import { verifyBlindSignature } from "@/lib/crypto/blind-signature";

export type BallotValidityProof = {
  // 1-of-n Chaum-Pedersen OR proof（Fiat–Shamir）
  commits: string[];
  challenges: string[];
  responses: string[];
};

export type CredentialPossessionProof = {
  nullifier: string;
  messageHex: string;
  signatureHex: string;
  // 簡化：公開驗證盲簽；nullifier = H(cred||election) 防重放
  // 生產環境應改為隱藏訊息的 NIZK
  kind: "blind-sig-with-nullifier";
};

function mod(a: bigint): bigint {
  return ((a % CURVE_N) + CURVE_N) % CURVE_N;
}

/**
 * 證明 ciphertext 加密某個合法選項（1-of-n OR proof）。
 */
export function proveBallotValidity(
  pkHex: string,
  ciphertext: ElGamalCiphertext,
  candidateIndex: number,
  candidateCount: number,
  randomnessHex: string,
): BallotValidityProof {
  const pk = pointFromHex(pkHex);
  const c1 = pointFromHex(ciphertext.c1);
  const c2 = pointFromHex(ciphertext.c2);
  const r = hexToBigint(randomnessHex);
  const commits: string[] = new Array(candidateCount);
  const challenges: string[] = new Array(candidateCount);
  const responses: string[] = new Array(candidateCount);

  let challengeSum = 0n;

  for (let i = 0; i < candidateCount; i += 1) {
    if (i === candidateIndex) {
      continue;
    }
    const fakeChallenge = randomScalar();
    const fakeResponse = randomScalar();
    challenges[i] = bigintToHex(fakeChallenge);
    responses[i] = bigintToHex(fakeResponse);
    challengeSum = mod(challengeSum + fakeChallenge);

    // 模擬承諾：A = resp*G - chal*C1, B = resp*PK - chal*(C2 - M_i)
    const Mi = encodeCandidate(i);
    const A = Point.BASE.multiply(fakeResponse).add(
      c1.multiply(fakeChallenge).negate(),
    );
    const c2MinusM = c2.add(Mi.negate());
    const B = pk.multiply(fakeResponse).add(
      c2MinusM.multiply(fakeChallenge).negate(),
    );
    commits[i] = `${pointToHex(A)}:${pointToHex(B)}`;
  }

  const k = randomScalar();
  const realA = Point.BASE.multiply(k);
  const realB = pk.multiply(k);
  commits[candidateIndex] = `${pointToHex(realA)}:${pointToHex(realB)}`;

  const parentChallenge = hashToScalar(
    "ballot-validity",
    pkHex,
    ciphertext.c1,
    ciphertext.c2,
    ...commits,
    String(candidateCount),
  );
  const realChallenge = mod(parentChallenge - challengeSum);
  const realResponse = mod(k + realChallenge * r);
  challenges[candidateIndex] = bigintToHex(realChallenge);
  responses[candidateIndex] = bigintToHex(realResponse);

  return { commits, challenges, responses };
}

export function verifyBallotValidity(
  pkHex: string,
  ciphertext: ElGamalCiphertext,
  candidateCount: number,
  proof: BallotValidityProof,
): boolean {
  if (
    proof.commits.length !== candidateCount ||
    proof.challenges.length !== candidateCount ||
    proof.responses.length !== candidateCount
  ) {
    return false;
  }

  const pk = pointFromHex(pkHex);
  const c1 = pointFromHex(ciphertext.c1);
  const c2 = pointFromHex(ciphertext.c2);
  let challengeSum = 0n;

  for (let i = 0; i < candidateCount; i += 1) {
    const chal = hexToBigint(proof.challenges[i]);
    const resp = hexToBigint(proof.responses[i]);
    challengeSum = mod(challengeSum + chal);

    const parts = proof.commits[i].split(":");
    if (parts.length !== 2) {
      return false;
    }
    const A = pointFromHex(parts[0]);
    const B = pointFromHex(parts[1]);
    const Mi = encodeCandidate(i);
    const leftA = Point.BASE.multiply(resp);
    const rightA = A.add(c1.multiply(chal));
    if (!leftA.equals(rightA)) {
      return false;
    }
    const c2MinusM = c2.add(Mi.negate());
    const leftB = pk.multiply(resp);
    const rightB = B.add(c2MinusM.multiply(chal));
    if (!leftB.equals(rightB)) {
      return false;
    }
  }

  const parentChallenge = hashToScalar(
    "ballot-validity",
    pkHex,
    ciphertext.c1,
    ciphertext.c2,
    ...proof.commits,
    String(candidateCount),
  );
  return challengeSum === parentChallenge;
}

export function createCredentialProof(
  electionId: string,
  messageHex: string,
  signatureHex: string,
  nHex: string,
  eHex: string,
): CredentialPossessionProof | null {
  if (!verifyBlindSignature(messageHex, signatureHex, nHex, eHex)) {
    return null;
  }
  const nullifier = domainSeparatedHash(
    "nf",
    messageHex,
    electionId,
  );
  return {
    kind: "blind-sig-with-nullifier",
    nullifier,
    messageHex,
    signatureHex,
  };
}

export function verifyCredentialProof(
  electionId: string,
  proof: CredentialPossessionProof,
  nHex: string,
  eHex: string,
): boolean {
  if (proof.kind !== "blind-sig-with-nullifier") {
    return false;
  }
  if (!verifyBlindSignature(proof.messageHex, proof.signatureHex, nHex, eHex)) {
    return false;
  }
  const expected = domainSeparatedHash("nf", proof.messageHex, electionId);
  return expected === proof.nullifier;
}
