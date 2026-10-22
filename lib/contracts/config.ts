/**
 * Public deployment configuration and explorer links. Only NEXT_PUBLIC_ values belong here —
 * never a private key.
 */
import { isAddress, type Address, type Chain, type Hex } from "viem";
import { baseSepolia, hardhat } from "viem/chains";

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

// ── network selection (Phase 3) ──────────────────────────────────────────────────────────────

export type RilvaNetwork = "base-sepolia" | "local";

export interface RilvaChainConfig {
  network: RilvaNetwork;
  chain: Chain;
  rpcUrl: string;
  /** Block explorer base URL, or null for the local development chain. */
  explorer: string | null;
  isLocal: boolean;
  label: string;
}

/**
 * Selects the chain the app talks to. Only Base Sepolia (default) and a local Hardhat node exist;
 * there is deliberately no mainnet option. Pass the NEXT_PUBLIC_ values written out literally.
 */
export function resolveRilvaChain(env: { NEXT_PUBLIC_RILVA_CHAIN?: string; NEXT_PUBLIC_RPC_URL?: string }): RilvaChainConfig {
  const raw = env.NEXT_PUBLIC_RILVA_CHAIN?.trim() || "base-sepolia";
  if (raw !== "base-sepolia" && raw !== "local") {
    throw new Error(`NEXT_PUBLIC_RILVA_CHAIN must be "base-sepolia" or "local", got ${raw}`);
  }
  const override = env.NEXT_PUBLIC_RPC_URL?.trim();
  if (override && !/^https?:\/\/[^\s]+$/.test(override)) {
    throw new Error(`NEXT_PUBLIC_RPC_URL is not an http(s) RPC URL: ${override}`);
  }
  if (raw === "local") {
    return { network: "local", chain: hardhat, rpcUrl: override || "http://127.0.0.1:8545", explorer: null, isLocal: true, label: "Local Hardhat chain · development only" };
  }
  return {
    network: "base-sepolia",
    chain: baseSepolia,
    rpcUrl: override || "https://sepolia.base.org",
    explorer: BASE_SEPOLIA_EXPLORER,
    isLocal: false,
    label: "Base Sepolia · testnet",
  };
}

export function chainTxUrl(cfg: Pick<RilvaChainConfig, "explorer">, hash: Hex): string | null {
  return cfg.explorer ? `${cfg.explorer}/tx/${hash}` : null;
}

export function chainAddressUrl(cfg: Pick<RilvaChainConfig, "explorer">, address: Address): string | null {
  return cfg.explorer ? `${cfg.explorer}/address/${address}` : null;
}

export function explorerTxUrl(hash: Hex): string {
  return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`;
}

export function explorerAddressUrl(address: Address): string {
  return `${BASE_SEPOLIA_EXPLORER}/address/${address}`;
}
