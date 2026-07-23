import {
  reencrypt,
  type ElGamalCiphertext,
} from "@/lib/crypto/elgamal";
import { domainSeparatedHash } from "@/lib/crypto/hash";

export type MixServerProof = {
  serverId: string;
  inputCommitment: string;
  outputCommitment: string;
  permutationCommitment: string;
  transcript: string;
};

export type MixLayerResult = {
  outputs: ElGamalCiphertext[];
  proof: MixServerProof;
  permutation: number[];
};

function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const j =
      (bytes[0]! |
        (bytes[1]! << 8) |
        (bytes[2]! << 16) |
        (bytes[3]! << 24)) >>>
      0;
    const idx = j % (i + 1);
    const tmp = indices[i]!;
    indices[i] = indices[idx]!;
    indices[idx] = tmp;
  }
  return indices;
}

function commitCiphertexts(list: ElGamalCiphertext[]): string {
  return domainSeparatedHash(
    "bb-batch",
    ...list.map((c) => `${c.c1}:${c.c2}`),
  );
}

/**
 * 可驗證混洗（示範版）：
 * 重加密 + 隨機置換，並以 Fiat–Shamir transcript 綁定輸入／輸出。
 * 生產環境應改為 Bayer–Groth / Wikström shuffle proof。
 */
export function verifiableShuffle(
  serverId: string,
  pkHex: string,
  inputs: ElGamalCiphertext[],
): MixLayerResult {
  const permutation = shuffleIndices(inputs.length);
  const outputs: ElGamalCiphertext[] = new Array(inputs.length);
  const randomnessList: string[] = [];

  for (let i = 0; i < inputs.length; i += 1) {
    const src = inputs[permutation[i]!]!;
    const { ciphertext, randomnessHex } = reencrypt(pkHex, src);
    outputs[i] = ciphertext;
    randomnessList.push(randomnessHex);
  }

  const inputCommitment = commitCiphertexts(inputs);
  const outputCommitment = commitCiphertexts(outputs);
  const permutationCommitment = domainSeparatedHash(
    "perm",
    serverId,
    permutation.join(","),
    randomnessList.join(","),
  );
  const transcript = domainSeparatedHash(
    "shuffle-proof",
    serverId,
    inputCommitment,
    outputCommitment,
    permutationCommitment,
  );

  return {
    outputs,
    permutation,
    proof: {
      serverId,
      inputCommitment,
      outputCommitment,
      permutationCommitment,
      transcript,
    },
  };
}

export function verifyShuffleProof(
  proof: MixServerProof,
  inputs: ElGamalCiphertext[],
  outputs: ElGamalCiphertext[],
): boolean {
  const inputCommitment = commitCiphertexts(inputs);
  const outputCommitment = commitCiphertexts(outputs);
  if (proof.inputCommitment !== inputCommitment) {
    return false;
  }
  if (proof.outputCommitment !== outputCommitment) {
    return false;
  }
  if (inputs.length !== outputs.length) {
    return false;
  }
  const expectedTranscript = domainSeparatedHash(
    "shuffle-proof",
    proof.serverId,
    inputCommitment,
    outputCommitment,
    proof.permutationCommitment,
  );
  return expectedTranscript === proof.transcript;
}

/** 稽核用：在受控環境揭露置換以驗證（公開驗證仍依 transcript 完整性） */
export function verifyShuffleWithWitness(
  pkHex: string,
  inputs: ElGamalCiphertext[],
  outputs: ElGamalCiphertext[],
  permutation: number[],
  proof: MixServerProof,
): boolean {
  if (!verifyShuffleProof(proof, inputs, outputs)) {
    return false;
  }
  if (permutation.length !== inputs.length) {
    return false;
  }
  const seen = new Set<number>();
  for (const p of permutation) {
    if (p < 0 || p >= inputs.length || seen.has(p)) {
      return false;
    }
    seen.add(p);
  }
  // 重加密關係在公開驗證中不揭露 randomness；此處僅確認置換為雙射
  void pkHex;
  void outputs;
  return true;
}
