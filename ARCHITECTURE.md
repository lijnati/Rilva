# ARCHITECTURE.md — Rilva system architecture

> Phase 0 design. Unless marked Verified, statements are **Decisions**. Related: [CONTRACTS.md](CONTRACTS.md) (on-chain), [CLIMATE_DATA.md](CLIMATE_DATA.md) (indicator and evidence), [DESIGN.md](DESIGN.md) (UI).

## 1. Principles

1. **Nothing off-chain is trusted by default.**
   - The browser recomputes evidence from the public source.
   - The server is a convenience cache and holds no keys.
2. **One deterministic climate module, used everywhere.** The same `lib/climate` code runs in the explorer, the attestor flow, the verifier and the tests.
3. **No database in the MVP.**
   - Campaign state lives on-chain.
   - Evidence is reproducible from `spec` + public data.
   - Demo evidence JSON is also committed as static files.
4. **No AI.** Rilva has no AI features (AI summaries were removed from scope on 2026-10-22). Nothing but the deterministic SRPN-v1 code and the contract decides anything.
5. **Minimal dependencies, one repo, one deployable app.** Contracts live in the same repo under Hardhat 3 (Phase 2 switched from Foundry).

## 2. System diagram

```
                         ┌──────────────────────────── Browser (untrusted UI, trusted computation by the user) ─────────────────────────┐
                         │                                                                                                              │
 Funder wallet ─────────►│  /campaigns/new ──createCampaign(spec,…){value}──────────────────────────────┐                               │
                         │                                                                               │                               │
 Attestor wallet ───────►│  /campaigns/[id] ─► lib/climate: fetch → SRPN-v1 → evidence.core → keccak     │                               │
                         │                     check spec ↔ on-chain params ↔ recomputed hash            │                               │
                         │                     eth_signTypedData_v4(Attestation) ─► settle(id,a,sig) ────┤                               │
                         │                                                                               ▼                               │
 Anyone / judge ────────►│  /verify/[id] ─► read events + campaign ─► re-fetch → recompute → compare ◄── Base Sepolia: RilvaEscrow      │
                         │  /explore     ─► lib/climate + Recharts (real ERA5 & CHIRPS numbers)          (events = audit trail)          │
                         └─────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │ direct CORS GET (models=era5), with a labelled fallback to the saved snapshots
                                       ▼
                    archive-api.open-meteo.com (ERA5, models=era5)     /public/snapshots/.../*.json (committed raw responses)
```

## 3. Components

| Component | Responsibility | Trust |
|---|---|---|
| `contracts/` (Hardhat 3, solc 0.8.37) | `RilvaEscrow` escrow, EIP-712 verification, state machine, events (CONTRACTS.md) | Security-critical |
| `lib/contracts/` | Generated ABI, the single EIP-712 type definition, spec→terms mapping, read/write-prep helpers, event parsing, error text, Base Sepolia config | Security-relevant; parity-tested with Solidity |
| `lib/climate/` (pure TS, no I/O in core) | Parse Open-Meteo responses, validate completeness, compute SRPN-v1 with BigInt, build `evidence.core`, JCS + keccak256 | Correctness-critical; must be unit-tested against golden values |
| `lib/climate/source.ts` | Fetch with retry, chunking by decade, and fallback order **direct → saved snapshot**, always labelled | Untrusted I/O |
| `lib/app/` (Phase 3, pure TS, relative imports, unit-tested) | View logic for the UI: explorer series, create-form validation (exact wei, contract-rule mirror), campaign view model (contract states only), bounded log history + settle-calldata decoding, the verification checklist, signed-attestation export/import, revert decoding, browser evidence loader | Security-relevant: never decides eligibility; the contract re-checks everything |
| `components/chain/` | wagmi (injected wallet only) + TanStack Query providers, wallet/network states, read hooks via the public RPC | UI; no keys |
| `app/` (Next.js App Router) | Pages in [DESIGN.md](DESIGN.md) §5 | UI |
| `public/snapshots/open-meteo/era5/yabelo/` | Committed raw Open-Meteo responses (baseline decades and observed seasons) | Byte-exact. SHA-256 recorded in `manifest.json`; `.gitattributes -text` |
| `public/evidence/` | Precomputed evidence JSON for demo campaigns, named by `evidenceHash` | Convenience only; the verifier recomputes regardless |
| `ignition/modules/RilvaEscrow.ts` | Hardhat Ignition deployment of the single contract | Deployer key only from the Hardhat keystore or a shell env; never in the repo |
| `scripts/` | Climate snapshot/evidence/verify commands; `contracts/export-abi.ts` | No keys |

## 4. Data flows

### 4.1 Create and fund (Funder)
1. The funder picks the location (fixed: Yabelo in the MVP), season and year, threshold (default 6000 bps), beneficiary, attestor and amount. Replay seasons must be labelled.
2. The UI builds the canonical `spec` (RFC 8785) and shows it.
3. The funder calls `createCampaign(…, spec)` with `value = amount`.
4. The `CampaignCreated` event is the record.

### 4.2 Evidence and attestation (Attestor)
1. The attestor opens `/campaigns/[id]`. The UI reads the campaign and the spec from the event.
2. It checks `keccak256(spec) == specHash` and that the spec agrees with the numeric on-chain fields.
3. `lib/climate` fetches the target season and the baseline, validates (see CLIMATE_DATA.md §4), and computes `indexBps`. It then builds `core` and `evidenceHash`.
4. The UI shows `indexBps`, the threshold, the predicted outcome, and the hash. The attestor's wallet signs `Attestation{…, expiresAt = now + 1h}`.
5. Anyone, normally the attestor, submits `settle(id, a, sig)`.
6. The result is a `Settled` event, plus `Released` when triggered.

### 4.3 Public verification (anyone, no wallet)
`/verify/[id]` reads the campaign and its events, then shows a checklist where each item passes or fails visibly:
- Spec hash matches.
- Spec is consistent with on-chain fields.
- Recomputed `indexBps` equals the attested one.
- Recomputed `evidenceHash` equals the on-chain one.
- The attestation signer equals the campaign attestor. Recover from the `settle` tx calldata with viem.
- The outcome follows the rule.
- Funds moved to the right address.

It links every tx to Basescan.

### 4.4 Rejection demonstrations
The campaign page has a "Try to break it" panel that runs `simulateContract`, with no gas and no state change. `settle` checks `status` first, so the first two attempts must run while the campaign is still **Funded**, after the attestor has signed and before the genuine `settle`. The demo flow uses campaign B (OND 2023):
- **Unauthorized:** the same struct signed by a non-attestor demo key generated in-browser and discarded → `InvalidSigner`.
- **Altered:** the attestor's valid signature, but with `indexBps` changed from 21322 to 3363 to fake a trigger → `InvalidSigner`.
- Then the genuine attestation is submitted → `Refunded` (reason `NotTriggered`), and the funder is repaid in the same transaction.
- **Duplicate:** resubmit the original valid attestation → `CampaignNotActive`. This also works on settled campaign A.

All three are also Hardhat contract tests (`tests/contracts/`). Optionally, one real reverting tx is broadcast by script so it appears on Basescan.

## 5. APIs

- **Removed from scope (2026-10-22):** the `/api/rainfall` proxy. The browser fetches Open-Meteo directly (CORS verified) and falls back to the committed, SHA-256-checked snapshots with a visible notice. One fewer server component to trust or operate.
- No server API exists. Chain reads go through the public RPC `https://sepolia.base.org` via viem (or `NEXT_PUBLIC_RPC_URL`). Event history (`lib/app/chainHistory.ts`): the public endpoint rejects `eth_getLogs` over more than 200 blocks (observed 2026-10-22: "eth_getLogs is limited to a 200 range"), so nothing scans. The creation block is found by binary search over historical `campaignCount()` and the final block over the campaign's status (both only move forward; the public RPC serves historical `eth_call`, checked 2026-10-22), then logs are read for those single blocks with the indexed `campaignId`. `NEXT_PUBLIC_RILVA_DEPLOY_BLOCK` only narrows the search. The wagmi transport batches JSON-RPC (accepted by the public endpoint), with 3 retries and a 15 s timeout. A dedicated RPC URL is optional (`NEXT_PUBLIC_RPC_URL`).
- Before any chain-backed page renders, `EscrowGate` confirms the configured address is RilvaEscrow v1 on the configured chain (RPC chain id, code present, EIP-5267 domain). Otherwise it shows a configuration error and offers no transaction; climate pages keep working. Every write and signature names its chain (`lib/app/walletRequest.ts`).

## 6. Persistence decision

- **No Neon or Drizzle.**
- On-chain state plus events cover campaigns and the audit trail. `campaignCount` plus `campaigns(i)` reads list campaigns without log indexing.
- Evidence is deterministic from public inputs, and committed snapshots and demo evidence JSON cover availability.
- **Revisit only if** user-generated off-chain content becomes a requirement, which is not planned.

## 7. Technology choices (latest versions observed on npm 2026-10-19; pin exact in Phase 1)

| Layer | Choice | Observed latest | Notes |
|---|---|---|---|
| Framework | Next.js App Router | next 16.4.2, react 19.3.1 | Deploy on Vercel (Node runtime) |
| Language | TypeScript | typescript 7.0.2 | **UNVERIFIED** whether Next 16.4 tooling supports TS 7. Use the version `create-next-app` pins. |
| Styling | Tailwind CSS + shadcn/ui | tailwindcss 4.3.3, shadcn 4.22.1 | Use only the components we need |
| Fonts | Geist (`geist` package / `next/font`) | geist 1.8.1 | |
| Chain | viem + wagmi + TanStack Query | viem 2.57.7, wagmi 3.7.7, @tanstack/react-query 5.104.4 | Injected wallet connector only (MetaMask / Rabby / Coinbase) |
| Charts | Recharts | recharts 3.10.1 | Installed Phase 3 |
| E2E | Playwright | @playwright/test 1.64.1 | Added Phase 3 (approved), Chromium only |
| Map | **Static SVG locator** (Natural Earth admin-0, public domain) **instead of MapLibre** | maplibre-gl 6.15.0 | **Proposed simplification:** one point and two grid cells don't justify a tile-server dependency. MapLibre is a stretch goal. |
| Canonical JSON | `canonicalize` (RFC 8785) | canonicalize 5.1.0 | Or a 30-line audited implementation with tests |
| Hashing | viem `keccak256` | — | |
| Tests (TS) | Vitest | vitest 5.0.5 | Golden values, typed-data parity |
| Contracts | Hardhat 3.19.0 + OpenZeppelin 5.6.1 + Ignition | see CONTRACTS.md §1 | Foundry not used |

## 8. Repository layout (as of Phase 2)

```
/app                 Next.js routes (see DESIGN.md §5)
/components          UI components (site, climate, chain, campaign, verify, ui)
/lib/app             Phase 3 view logic (pure, tested)
/lib/climate         SRPN-v1, evidence, canonicalization (pure) + source.ts (I/O)
/lib/contracts       generated ABI, EIP-712 typed data, spec→terms, read/write helpers, config
/contracts           RilvaEscrow.sol (+ contracts/test/ receivers used only by tests)
/ignition/modules    Hardhat Ignition deployment module
/public/snapshots    raw Open-Meteo responses + manifest.json (Yabelo, era5)
/public/evidence     demo evidence JSON by hash
/tests/climate, /tests/lib   Vitest (pnpm test)
/tests/e2e           Playwright journeys (pnpm test:e2e; chain journeys need E2E_CHAIN=local)
/public/vendor       pixel-scene.js (pixel-meadow-ui skill, vendored)
/tests/contracts     Hardhat node:test suites (pnpm contracts:test), incl. real-evidence integration
hardhat.config.ts    solc 0.8.37, optimizer off, baseSepolia network
PRODUCT.md CLIMATE_DATA.md ARCHITECTURE.md CONTRACTS.md DESIGN.md ROADMAP.md CLAUDE.md README.md
```

## 9. Threat model (system level)

The contract-level table is in CONTRACTS.md §8. Additional system boundaries:

| Boundary | Threat | Control |
|---|---|---|
| Browser ↔ Open-Meteo | MITM / spoofed data | HTTPS. The verifier can cross-check saved snapshots and CHIRPS. Any deviation shows as a hash mismatch. |
| UI ↔ wallet | Blind signing | EIP-712 with named fields. The UI repeats the fields and hash in readable form. |
| Repo / secrets | Key leakage | `.env*` in `.gitignore`. No keys on the server. Pre-commit grep for `PRIVATE_KEY=0x` (CLAUDE.md). |
| Dependencies | Malicious update | Exact version pins and a committed lockfile. No postinstall scripts from unknown packages. |
| Presentation | Misleading claims | Mandatory replay banner, limitation copy, and "illustrative threshold" labels (DESIGN.md §7) |

## 10. Deployment

- Contracts: `pnpm contracts:preflight:base-sepolia` (read-only) → `pnpm contracts:deploy:base-sepolia` (Hardhat Ignition, production compiler profile pinned to the tested settings) → `pnpm contracts:smoke:base-sepolia` → `pnpm contracts:verify:base-sepolia`. The deployer key comes from the Hardhat keystore. See DEPLOYMENT.md. **Status: pending credentials and approval.**
- App: Vercel (needs the human's account). Public env vars only: `NEXT_PUBLIC_RILVA_ESCROW_ADDRESS`, `NEXT_PUBLIC_RILVA_DEPLOY_BLOCK`, optional `NEXT_PUBLIC_RPC_URL`, and `NEXT_PUBLIC_RILVA_CHAIN` (`base-sepolia` default, or `local` for a Hardhat node on 31337; there is no mainnet option).
- Local development chain (Phase 3): `pnpm chain:node`, `pnpm chain:deploy:local`, `pnpm chain:seed:local` (refuses any chain but 31337; the node's dev accounts sign over JSON-RPC, so no keys are stored). Every view labels it "Local Hardhat chain · development only".
- Demo campaigns:
  - A: OND 2021, triggers.
  - B: OND 2023, does not trigger.
  - Both are created on testnet before recording, and kept in `public/evidence`.
