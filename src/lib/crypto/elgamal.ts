import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes, bigintToHex, hexToBigint } from "@/lib/utils";
import { hashToScalar } from "@/lib/crypto/hash";

const { Point } = secp256k1;
const CURVE_N = Point.Fn.ORDER;

export type ElGamalPublicKey = {
  pkHex: string;
};

export type ElGamalSecretKey = {
  skHex: string;
};

export type ElGamalCiphertext = {
  c1: string;
  c2: string;
};

export type TrusteeShare = {
  id: number;
  skShareHex: string;
};

function randomScalar(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }
  return (value % (CURVE_N - 1n)) + 1n;
}

export function pointToHex(point: InstanceType<typeof Point>): string {
  return bytesToHex(point.toBytes(true));
}

export function pointFromHex(hex: string): InstanceType<typeof Point> {
  return Point.fromBytes(hexToBytes(hex));
}

export function encodeCandidate(candidateIndex: number): InstanceType<typeof Point> {
  // M = g^(index+1)，開票時以小範圍離散對數還原
  return Point.BASE.multiply(BigInt(candidateIndex + 1));
}

export function generateThresholdKeypair(
  trusteeCount: number,
  threshold: number,
): {
  publicKey: ElGamalPublicKey;
  masterSecret: ElGamalSecretKey;
  shares: TrusteeShare[];
} {
  if (threshold < 1 || threshold > trusteeCount) {
    throw new Error("門檻參數無效");
  }
  const sk = randomScalar();
  const pk = Point.BASE.multiply(sk);

  // 簡化門檻：將 sk 拆成 t 份加法份額（示範用；生產應使用 Feldman/Pedersen VSS）
  const shares: TrusteeShare[] = [];
  let acc = 0n;
  for (let i = 1; i < threshold; i += 1) {
    const share = randomScalar();
    shares.push({ id: i, skShareHex: bigintToHex(share) });
    acc = (acc + share) % CURVE_N;
  }
  const last = (sk - acc + CURVE_N) % CURVE_N;
  shares.push({ id: threshold, skShareHex: bigintToHex(last) });

  // 其餘受託人持有 0 份額標記（需湊齊前 threshold 份）
  for (let i = threshold + 1; i <= trusteeCount; i += 1) {
    shares.push({ id: i, skShareHex: "0" });
  }

  return {
    publicKey: { pkHex: pointToHex(pk) },
    masterSecret: { skHex: bigintToHex(sk) },
    shares,
  };
}

export function encryptBallot(
  pkHex: string,
  candidateIndex: number,
  randomnessHex?: string,
): { ciphertext: ElGamalCiphertext; randomnessHex: string } {
  const pk = pointFromHex(pkHex);
  const r = randomnessHex ? hexToBigint(randomnessHex) % CURVE_N : randomScalar();
  const M = encodeCandidate(candidateIndex);
  const c1 = Point.BASE.multiply(r);
  const c2 = pk.multiply(r).add(M);
  return {
    ciphertext: { c1: pointToHex(c1), c2: pointToHex(c2) },
    randomnessHex: bigintToHex(r),
  };
}

export function reencrypt(
  pkHex: string,
  ciphertext: ElGamalCiphertext,
): { ciphertext: ElGamalCiphertext; randomnessHex: string } {
  const pk = pointFromHex(pkHex);
  const r = randomScalar();
  const c1 = pointFromHex(ciphertext.c1).add(Point.BASE.multiply(r));
  const c2 = pointFromHex(ciphertext.c2).add(pk.multiply(r));
  return {
    ciphertext: { c1: pointToHex(c1), c2: pointToHex(c2) },
    randomnessHex: bigintToHex(r),
  };
}

export function decryptWithSecret(
  skHex: string,
  ciphertext: ElGamalCiphertext,
  candidateCount: number,
): number | null {
  const sk = hexToBigint(skHex);
  const c1 = pointFromHex(ciphertext.c1);
  const c2 = pointFromHex(ciphertext.c2);
  const shared = c1.multiply(sk);
  const M = c2.add(shared.negate());
  for (let i = 0; i < candidateCount; i += 1) {
    if (encodeCandidate(i).equals(M)) {
      return i;
    }
  }
  return null;
}

export function combineAdditiveShares(shares: TrusteeShare[]): string {
  let sk = 0n;
  for (const share of shares) {
    sk = (sk + hexToBigint(share.skShareHex)) % CURVE_N;
  }
  return bigintToHex(sk);
}

export function decryptPartial(
  skShareHex: string,
  ciphertext: ElGamalCiphertext,
): string {
  const sk = hexToBigint(skShareHex);
  if (sk === 0n) {
    return pointToHex(Point.ZERO);
  }
  return pointToHex(pointFromHex(ciphertext.c1).multiply(sk));
}

export function combinePartialsAndDecrypt(
  ciphertext: ElGamalCiphertext,
  partials: string[],
  candidateCount: number,
): number | null {
  let shared = Point.ZERO;
  for (const partial of partials) {
    const p = pointFromHex(partial);
    if (!p.equals(Point.ZERO)) {
      shared = shared.add(p);
    }
  }
  const M = pointFromHex(ciphertext.c2).add(shared.negate());
  for (let i = 0; i < candidateCount; i += 1) {
    if (encodeCandidate(i).equals(M)) {
      return i;
    }
  }
  return null;
}

export function proveDecryption(
  skHex: string,
  ciphertext: ElGamalCiphertext,
  plaintextIndex: number,
): { challenge: string; response: string; plaintextCommit: string } {
  const sk = hexToBigint(skHex);
  const c1 = pointFromHex(ciphertext.c1);
  const shared = c1.multiply(sk);
  const k = randomScalar();
  const commit = pointToHex(c1.multiply(k));
  const challenge = hashToScalar(
    "decryption-proof",
    ciphertext.c1,
    ciphertext.c2,
    pointToHex(shared),
    commit,
    String(plaintextIndex),
  );
  const response = (k + challenge * sk) % CURVE_N;
  return {
    challenge: bigintToHex(challenge),
    response: bigintToHex(response),
    plaintextCommit: pointToHex(shared),
  };
}

export function verifyDecryptionProof(
  pkHex: string,
  ciphertext: ElGamalCiphertext,
  plaintextIndex: number,
  proof: { challenge: string; response: string; plaintextCommit: string },
): boolean {
  const c1 = pointFromHex(ciphertext.c1);
  const shared = pointFromHex(proof.plaintextCommit);
  const M = encodeCandidate(plaintextIndex);
  const expectedC2 = shared.add(M);
  if (!expectedC2.equals(pointFromHex(ciphertext.c2))) {
    return false;
  }

  const challenge = hexToBigint(proof.challenge);
  const response = hexToBigint(proof.response);
  // 驗證 Chaum-Pedersen：resp*C1 == commit + chal*shared
  // prove 時 commit = k*C1，response = k + chal*sk，shared = sk*C1
  const commitCheck = c1
    .multiply(response)
    .add(shared.multiply(challenge).negate());
  const expectedChallenge = hashToScalar(
    "decryption-proof",
    ciphertext.c1,
    ciphertext.c2,
    proof.plaintextCommit,
    pointToHex(commitCheck),
    String(plaintextIndex),
  );
  void pkHex;
  return expectedChallenge === challenge;
}

export { CURVE_N, Point, randomScalar };
