# DEPLOYMENT.md — RilvaEscrow on Base Sepolia

> **Status (2026-10-23): DEPLOYED to Base Sepolia** with explicit human approval. All smoke checks passed. Source verification has not been done yet.
>
> | | |
> |---|---|
> | Address | [`0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E`](https://sepolia.basescan.org/address/0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E) |
> | Deployment tx | [`0x52999d1c1280d0e0498c4b4a1cdb60040e70f27134178316d15cd0b3a53c500d`](https://sepolia.basescan.org/tx/0x52999d1c1280d0e0498c4b4a1cdb60040e70f27134178316d15cd0b3a53c500d) |
> | Block | 49094017 |
> | Deployer | `0xdb3e14879897939ccfd0b22da16f178463ae6020` (testnet-only, no rights in the contract) |
> | Gas used | 2,653,742 (equal to the local measurement; the preflight's RPC estimate was 2,675,971) |
> | Creation code keccak256 | `0x8e75864f7e03615f36e790ad8bc79522e230583d501554d5868305903e0733db` (equal to the tested artifact) |
>
> Record: `ignition/deployments/chain-84532/` (Ignition journal) and `deployments/base-sepolia.json` (smoke test output).

## Demo campaigns on Base Sepolia (created 2026-10-24 through the deployed app)

All receipts were checked with `eth_getTransactionReceipt` (status `0x1`) and the events decoded from the contract's own logs. Every campaign uses the same roles and 0.001 test ETH:
- Funder: `0xdB3E14879897939cCFD0B22Da16f178463aE6020` (the testnet deployer wallet; it has no special rights in the contract).
- Attestor: `0x9C9a7BF5A3502071e49AA6D586b3f43239fC18Bc`.
- Beneficiary: `0x0aaFA86F39DA8AFe0CdB3Ae82f3B6Ba7Aea8CA8C`.
- Threshold: 6000 bps (illustrative).

| # | Season | Created (tx · block) | Settled (tx · block) | Attested index | Outcome |
|---|---|---|---|---|---|
| 1 | OND 2021 | [`0xbdb419fc…a110`](https://sepolia.basescan.org/tx/0xbdb419fc39b5469df19f86c674e95cc3607f725c305e148787b13e938d64a110) · 49473901 | [`0xd5e77248…d95c`](https://sepolia.basescan.org/tx/0xd5e77248c989878540c6c082b2b6c877c4aa5fb3c38eba3bc6c8f5d0e807d95c) · 49484594 | 3363 bps, evidence `0xde7fdf48…3be94f50` | **Released**: 0.001 ETH to the beneficiary |
| 2 | OND 2023 | [`0x52703f5f…3bbd`](https://sepolia.basescan.org/tx/0x52703f5f335fb14e14cf12b66dd9af957b9c45f38d16b1b62866936885cc3bbd) · 49476672 | [`0xb5d6d551…b019`](https://sepolia.basescan.org/tx/0xb5d6d551bfc49b13a211fe5bdad028a153c75f916ccc47e50e1c4f0f62bab019) · 49485521 | 21322 bps, evidence `0x5c28852c…6b253e` | **Refunded (rule not met)**: 0.001 ETH back to the funder |
| 3 | OND 2022 | [`0xdc95d02a…9a86`](https://sepolia.basescan.org/tx/0xdc95d02adb1fd85e1be685f4bb023734038045897933ef3b08745745b79c9a86) · 49477072 | — | — | **Active** until 2026-11-23 04:47 UTC; kept open for "Try to break it" |

- The attested evidence digests equal the committed `public/evidence/*.json` (snapshot of 2026-10-19). See CLIMATE_DATA.md §2.4 for why attestations are pinned to the snapshot.
- The wallet (MetaMask with EIP-7702 delegation) submitted these transactions through its delegation framework: a relayer called `redeemDelegations` on `DelegationManager` (`to` = `0xdb9b1e94…7db3`, as shown by Blockscout), which executed the call from the user's own address. RilvaEscrow saw the funder and attestor addresses as `msg.sender`. `/verify` therefore decodes the nested `settle()` call (`decodeSettleCalldata`).
- Public reports: https://rilva.xylolabs.space/verify/1, /verify/2 and /verify/3.

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
pnpm contracts:compile && pnpm contracts:test && pnpm test && pnpm climate:verify all   && pnpm lint && pnpm typecheck && pnpm build
pnpm contracts:preflight:base-sepolia   # read-only: sends nothing
```
The preflight prints the Hardhat network, the chain id **reported by the RPC** (it refuses anything other than 84532 or a local 31337), the deployer address and balance, the artifact and its creation-code hash, the gas estimate (2,653,742 locally) and the worst-case cost. It never prints a key or the full RPC URL. Show its output to the human before asking for approval.

Compiler profiles: `hardhat ignition deploy` compiles with Hardhat's **production** profile. `hardhat.config.ts` defines it identically to the default profile (solc 0.8.37, optimizer off, cancun), because Hardhat's generated production profile would otherwise enable the optimizer and deploy different bytecode from the tested build. `tests/contracts/deployment.test.ts` guards this.

## Deploy (requires explicit human approval)
```bash
pnpm contracts:deploy:base-sepolia      # hardhat ignition deploy … --network baseSepolia
pnpm contracts:smoke:base-sepolia       # read-only checks; writes deployments/base-sepolia.json if all pass
pnpm contracts:verify:base-sepolia      # source verification (hardhat ignition verify chain-84532)
```

How the deploy behaves:
- Ignition asks for confirmation of the network before broadcasting.
- It writes the journal and addresses to `ignition/deployments/chain-84532/`. Commit that folder; it is the deployment record.
- The smoke test reads the address and deployment transaction from that journal and checks them against the chain: RPC chain id, a successful receipt that created exactly that address, runtime code equal to the compiled artifact (immutables masked), the EIP-712 domain and `campaignCount()`.
- Verification is a separate step, so a missing or invalid `ETHERSCAN_API_KEY` cannot fail the deployment. Blockscout (`base-sepolia.blockscout.com`) needs no key.

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
   NEXT_PUBLIC_RILVA_CHAIN=base-sepolia
   NEXT_PUBLIC_RILVA_ESCROW_ADDRESS=0x…
   NEXT_PUBLIC_RILVA_DEPLOY_BLOCK=…
   ```
4. Update this file with the real values.
5. Demo campaigns use small testnet amounts only, for example 0.001–0.01 test ETH, created through the app in Phase 3.

## Smoke checks (read-only)
```ts
import { createPublicClient, http } from "viem";
import { RILVA_CHAIN, RILVA_ESCROW_ABI } from "@/lib/contracts";
const client = createPublicClient({ chain: RILVA_CHAIN, transport: http() });
await client.readContract({ address, abi: RILVA_ESCROW_ABI, functionName: "eip712Domain" });
await client.readContract({ address, abi: RILVA_ESCROW_ABI, functionName: "campaignCount" });
```

## Local development chain (Phase 3, no credentials)
For building and testing the UI before the testnet deployment. Nothing here touches a public network.
```bash
pnpm chain:node            # terminal 1 — Hardhat node, chain 31337, http://127.0.0.1:8545
pnpm chain:deploy:local    # terminal 2 — Ignition deploy to localhost (record in ignition/deployments/chain-31337, git-ignored)
pnpm chain:seed:local      # creates demo campaigns via the app helpers; refuses any chain but 31337
```
`chain:seed:local` creates #1 OND 2021 (settled → Released), #2 OND 2023 (settled → Refunded, rule not met), #3 OND 2022 (Active, 7-day window) and #4 OND 2021 (Active, 11-minute window for the timeout-refund demo). The node's unlocked dev accounts sign over JSON-RPC; the script holds no keys.

Then create `.env.local` (git-ignored) with the values the script prints:
```
NEXT_PUBLIC_RILVA_CHAIN=local
NEXT_PUBLIC_RILVA_ESCROW_ADDRESS=<printed address>
NEXT_PUBLIC_RILVA_DEPLOY_BLOCK=0
```
To sign or submit from the browser, a wallet must be pointed at `http://127.0.0.1:8545` (chain 31337) with one of Hardhat's publicly documented **test** accounts — local only, never on any public network. Every page shows "Local Hardhat chain · development only" in this mode.
