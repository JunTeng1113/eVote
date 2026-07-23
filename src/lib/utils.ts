import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bigintToHex(value: bigint, byteLength?: number): string {
  const hex = value.toString(16);
  if (byteLength === undefined) {
    return hex.length % 2 === 0 ? hex : `0${hex}`;
  }
  return hex.padStart(byteLength * 2, "0");
}

export function hexToBigint(hex: string): bigint {
  return BigInt(`0x${hex === "" ? "0" : hex}`);
}

export function shortHash(value: string, size = 12): string {
  if (value.length <= size) {
    return value;
  }
  return `${value.slice(0, size / 2)}…${value.slice(-size / 2)}`;
}
