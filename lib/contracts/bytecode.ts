/**
 * Does a deployed contract run exactly the compiled RilvaEscrow? Runtime code is compared with the
 * artifact's deployedBytecode, ignoring only the immutable slots the constructor fills in (EIP-712
 * caches the chain id, address and hashed name/version there).
 */
import type { Hex } from "viem";

export type ImmutableReferences = Record<string, ReadonlyArray<{ start: number; length: number }>>;

export function runtimeCodeMatches(onchain: Hex | undefined, artifactDeployed: Hex, immutableReferences: ImmutableReferences): boolean {
  if (!onchain || onchain === "0x") return false;
  const a = onchain.slice(2).toLowerCase();
  const b = artifactDeployed.slice(2).toLowerCase();
  if (a.length !== b.length) return false;
  const masked = new Uint8Array(b.length / 2);
  for (const refs of Object.values(immutableReferences)) {
    for (const { start, length } of refs) {
      if (start < 0 || length <= 0 || start + length > masked.length) throw new Error(`immutable reference ${start}+${length} is outside the code`);
      masked.fill(1, start, start + length);
    }
  }
  for (let i = 0; i < masked.length; i++) {
    if (!masked[i] && a.slice(2 * i, 2 * i + 2) !== b.slice(2 * i, 2 * i + 2)) return false;
  }
  return true;
}
