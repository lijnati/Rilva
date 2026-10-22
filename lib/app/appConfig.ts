/**
 * Public, build-time app configuration. NEXT_PUBLIC_ variables must be written out literally so
 * Next.js inlines them. No secret ever belongs here.
 */
import { readEscrowConfig, resolveRilvaChain } from "../contracts";

export const CHAIN = resolveRilvaChain({
  NEXT_PUBLIC_RILVA_CHAIN: process.env.NEXT_PUBLIC_RILVA_CHAIN,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
});

export const ESCROW = readEscrowConfig({
  NEXT_PUBLIC_RILVA_ESCROW_ADDRESS: process.env.NEXT_PUBLIC_RILVA_ESCROW_ADDRESS,
  NEXT_PUBLIC_RILVA_DEPLOY_BLOCK: process.env.NEXT_PUBLIC_RILVA_DEPLOY_BLOCK,
});
