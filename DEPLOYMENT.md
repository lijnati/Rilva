# DEPLOYMENT.md — RilvaEscrow on Base Sepolia

> **Status (2026-10-19): NOT DEPLOYED.** No deployer credentials or testnet ETH are available in this environment. Everything below has been prepared and verified locally; the broadcast step needs the human's key and explicit approval. Do not record an address, block or transaction hash here until a real deployment produces one.

**Testnet only.**
- Chain: Base Sepolia (chain ID **84532**).
- Explorer: https://sepolia.basescan.org
- **Never deploy to Base mainnet.**

## What gets deployed
- `contracts/RilvaEscrow.sol`, through `ignition/modules/RilvaEscrow.ts`. This is one contract with no constructor arguments, no owner, and no initial calls or funds.
- Compiler: solc **0.8.37**, optimizer **off**, `evmVersion: cancun` (see `hardhat.config.ts` for why).
- Expected deployment gas: **2,653,742** (measured locally with `pnpm contracts:gas`). Bytecode is 11,837 bytes.

## Prerequisites
1. Node ≥ 24, pnpm 11.13.1, and `pnpm install`.
2. A **testnet-only** deployer wallet funded with Base Sepolia ETH from a faucet. The deployer has no special rights in the contract.
3. Store the key in the encrypted Hardhat keystore. The prompt hides input, and the key is never written in plain text to the repo:
   ```bash
   pnpm hardhat keystore set BASE_SEPOLIA_PRIVATE_KEY
   pnpm hardhat keystore set ETHERSCAN_API_KEY   # optional (Etherscan v2 key, covers Basescan)
   ```
   Alternatively, export the variables in your shell for that single command only. Never use a `NEXT_PUBLIC_` name for a secret.
4. Optional: `BASE_SEPOLIA_RPC_URL` for a dedicated RPC. The default is `https://sepolia.base.org`.

## Pre-flight (must all pass)
```bash
pnpm contracts:compile && pnpm contracts:test && pnpm test && pnpm climate:verify all \
  && pnpm lint && pnpm typecheck && pnpm build && pnpm contracts:deploy:local
```

## Deploy (requires explicit human approval)
```bash
pnpm contracts:deploy:base-sepolia
# = hardhat ignition deploy ignition/modules/RilvaEscrow.ts --network baseSepolia --verify
```

How the deploy behaves:
- Ignition asks for confirmation of the network before broadcasting.
- It writes the journal and addresses to `ignition/deployments/chain-84532/`. Commit that folder; it is the deployment record.
- If Basescan verification fails (no or invalid API key), retry with `pnpm hardhat ignition verify chain-84532`. Blockscout (`base-sepolia.blockscout.com`) needs no key.

## After deployment
1. Record the following from `ignition/deployments/chain-84532/deployed_addresses.json` and the journal:
   - contract address;
   - deployment transaction hash;
   - block number.
2. Confirm on chain:
   - `eth_chainId` = `0x14a34`;
   - `eth_getCode(address)` is non-empty;
   - `eip712Domain()` returns `("RilvaEscrow","1",84532,address)`;
   - `campaignCount()` = 0.
3. Set the public configuration (e.g. Vercel project env, or local `.env.local`):
   ```
   NEXT_PUBLIC_RILVA_ESCROW_ADDRESS=0x…
   NEXT_PUBLIC_RILVA_DEPLOY_BLOCK=…
   ```
4. Update this file and ROADMAP.md with the real values.
5. Demo campaigns use small testnet amounts only, for example 0.001–0.01 test ETH, created through the app in Phase 3.

## Smoke checks (read-only)
```ts
import { createPublicClient, http } from "viem";
import { RILVA_CHAIN, RILVA_ESCROW_ABI } from "@/lib/contracts";
const client = createPublicClient({ chain: RILVA_CHAIN, transport: http() });
await client.readContract({ address, abi: RILVA_ESCROW_ABI, functionName: "eip712Domain" });
await client.readContract({ address, abi: RILVA_ESCROW_ABI, functionName: "campaignCount" });
```
