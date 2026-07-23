import { createPrivateKey, generateKeyPairSync } from "crypto";
import {
  blindSignWithD,
  type RsaPublicJwk,
} from "@/lib/crypto/blind-signature";
import { bigintToHex } from "@/lib/utils";

export type BlindSignKeys = {
  publicJwk: RsaPublicJwk;
  privatePem: string;
  publicPem: string;
  n: string;
  e: string;
  d: string;
};

function pemToJwkComponents(privatePem: string): {
  n: bigint;
  e: bigint;
  d: bigint;
} {
  const key = createPrivateKey(privatePem);
  const jwk = key.export({ format: "jwk" });
  if (
    typeof jwk.n !== "string" ||
    typeof jwk.e !== "string" ||
    typeof jwk.d !== "string"
  ) {
    throw new Error("RSA JWK 缺少 n/e/d");
  }
  return {
    n: Buffer.from(jwk.n, "base64url").reduce(
      (acc, byte) => (acc << 8n) + BigInt(byte),
      0n,
    ),
    e: Buffer.from(jwk.e, "base64url").reduce(
      (acc, byte) => (acc << 8n) + BigInt(byte),
      0n,
    ),
    d: Buffer.from(jwk.d, "base64url").reduce(
      (acc, byte) => (acc << 8n) + BigInt(byte),
      0n,
    ),
  };
}

export function generateBlindSignKeys(): BlindSignKeys {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const privatePem = privateKey.export({
    type: "pkcs8",
    format: "pem",
  }) as string;
  const publicPem = publicKey.export({
    type: "spki",
    format: "pem",
  }) as string;
  const { n, e, d } = pemToJwkComponents(privatePem);
  const publicJwk: RsaPublicJwk = {
    kty: "RSA",
    n: bigintToHex(n),
    e: bigintToHex(e),
    alg: "RS256",
    ext: true,
    key_ops: ["verify"],
  };
  return {
    publicJwk,
    privatePem,
    publicPem,
    n: bigintToHex(n),
    e: bigintToHex(e),
    d: bigintToHex(d),
  };
}

export function blindSign(blindedMessageHex: string, keys: BlindSignKeys): string {
  return blindSignWithD(blindedMessageHex, keys.n, keys.d);
}
