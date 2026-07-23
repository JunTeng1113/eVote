import { domainSeparatedHash } from "@/lib/crypto/hash";
import { bigintToHex, hexToBigint } from "@/lib/utils";

export type RsaPublicJwk = {
  kty: "RSA";
  n: string;
  e: string;
  alg: "RS256";
  ext: true;
  key_ops: ["verify"];
};

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) {
      result = (result * b) % mod;
    }
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function modInv(a: bigint, mod: bigint): bigint | null {
  let t = 0n;
  let newT = 1n;
  let r = mod;
  let newR = ((a % mod) + mod) % mod;
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  if (r > 1n) {
    return null;
  }
  if (t < 0n) {
    t += mod;
  }
  return t;
}

export function messageFromCredentialSeed(
  electionId: string,
  seed: string,
): string {
  return domainSeparatedHash("vote-cred", electionId, seed);
}

/** 客戶端：盲化訊息 m' = m * r^e mod n */
export function blindMessage(
  messageHex: string,
  blindingFactorHex: string,
  nHex: string,
  eHex: string,
): string {
  const n = hexToBigint(nHex);
  const e = hexToBigint(eHex);
  const m = hexToBigint(messageHex) % n;
  const r = hexToBigint(blindingFactorHex) % n;
  if (r <= 1n) {
    throw new Error("blinding factor 無效");
  }
  const rInv = modInv(r, n);
  if (rInv === null) {
    throw new Error("blinding factor 與 n 不互質");
  }
  const blinded = (m * modPow(r, e, n)) % n;
  return bigintToHex(blinded);
}

/** 簽發端／核心：σ' = (m')^d mod n */
export function blindSignWithD(
  blindedMessageHex: string,
  nHex: string,
  dHex: string,
): string {
  const n = hexToBigint(nHex);
  const d = hexToBigint(dHex);
  const mPrime = hexToBigint(blindedMessageHex);
  if (mPrime <= 0n || mPrime >= n) {
    throw new Error("盲化訊息超出模數範圍");
  }
  return bigintToHex(modPow(mPrime, d, n));
}

/** 客戶端：解盲 σ = σ' * r^{-1} mod n */
export function unblindSignature(
  blindedSignatureHex: string,
  blindingFactorHex: string,
  nHex: string,
): string {
  const n = hexToBigint(nHex);
  const sigmaPrime = hexToBigint(blindedSignatureHex);
  const r = hexToBigint(blindingFactorHex) % n;
  const rInv = modInv(r, n);
  if (rInv === null) {
    throw new Error("無法計算 blinding factor 反元素");
  }
  return bigintToHex((sigmaPrime * rInv) % n);
}

export function verifyBlindSignature(
  messageHex: string,
  signatureHex: string,
  nHex: string,
  eHex: string,
): boolean {
  const n = hexToBigint(nHex);
  const e = hexToBigint(eHex);
  const m = hexToBigint(messageHex) % n;
  const sigma = hexToBigint(signatureHex) % n;
  if (sigma <= 0n || sigma >= n) {
    return false;
  }
  return modPow(sigma, e, n) === m;
}

export function randomBlindingFactor(nHex: string): string {
  const n = hexToBigint(nHex);
  const bytes = new Uint8Array(256);
  crypto.getRandomValues(bytes);
  let r = 0n;
  for (const byte of bytes) {
    r = (r << 8n) + BigInt(byte);
  }
  r = (r % (n - 2n)) + 2n;
  const inv = modInv(r, n);
  if (inv === null) {
    return randomBlindingFactor(nHex);
  }
  return bigintToHex(r);
}

export function randomCredentialSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
