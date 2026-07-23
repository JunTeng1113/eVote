import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@/lib/utils";

export function sha256Hex(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  return bytesToHex(sha256(bytes));
}

export function domainSeparatedHash(
  domain: string,
  ...parts: string[]
): string {
  return sha256Hex(`${domain}|${parts.join("|")}`);
}

export function hashToScalar(domain: string, ...parts: string[]): bigint {
  const digest = domainSeparatedHash(domain, ...parts);
  const n = BigInt(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
  );
  return hexToBytesToBigint(digest) % n;
}

function hexToBytesToBigint(hex: string): bigint {
  const bytes = hexToBytes(hex);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }
  return value;
}
