/**
 * Public deployment configuration and explorer links. Only NEXT_PUBLIC_ values belong here —
 * never a private key.
 */
import { isAddress, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const RILVA_CHAIN = baseSepolia;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export interface EscrowConfig {
  address: Address | null;
  deployBlock: bigint | null;
}

/**
 * Reads the deployed escrow address/block. Pass `process.env` with the variables written out
 * literally in Next.js code (NEXT_PUBLIC_ values are inlined at build time).
 */
export function readEscrowConfig(env: { NEXT_PUBLIC_RILVA_ESCROW_ADDRESS?: string; NEXT_PUBLIC_RILVA_DEPLOY_BLOCK?: string }): EscrowConfig {
  const rawAddress = env.NEXT_PUBLIC_RILVA_ESCROW_ADDRESS?.trim();
  const rawBlock = env.NEXT_PUBLIC_RILVA_DEPLOY_BLOCK?.trim();
  if (rawAddress && !isAddress(rawAddress, { strict: false })) {
    throw new Error(`NEXT_PUBLIC_RILVA_ESCROW_ADDRESS is not a valid address: ${rawAddress}`);
  }
  if (rawBlock && !/^\d+$/.test(rawBlock)) {
    throw new Error(`NEXT_PUBLIC_RILVA_DEPLOY_BLOCK is not a block number: ${rawBlock}`);
  }
  return {
    address: rawAddress ? (rawAddress as Address) : null,
    deployBlock: rawBlock ? BigInt(rawBlock) : null,
  };
}

export function explorerTxUrl(hash: Hex): string {
  return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`;
}

export function explorerAddressUrl(address: Address): string {
  return `${BASE_SEPOLIA_EXPLORER}/address/${address}`;
}
