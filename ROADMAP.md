# ROADMAP.md — Rilva delivery plan

> Today: **Mon 2026-10-19**. Hard deadline: **Sun 2026-10-25 17:00 EAT (14:00 UTC)** (Verified on Devpost, accessed 2026-10-19).
> **Internal submission target: Sun 2026-10-25 12:00 EAT**, which leaves a 5 h buffer.
> All times are EAT (UTC+3). Each phase ends with a **gate**. Do not start the next phase with a red gate. Use the fallback instead.

## 0. Priorities ranked by judging criteria

The five criteria (Climate Impact, Innovation & Creativity, Technical Execution, Practical Usefulness, Presentation) are treated as equal weight, since no weights are published (UNVERIFIED).

| Rank | Work item | Criteria it moves | Why |
|---|---|---|---|
| 1 | End-to-end testnet flow: create → attest → settle → verify | Tech, Innovation, Usefulness | Without it there is no demo |
| 2 | Correct, tested SRPN-v1 with golden values and fixtures | Climate, Tech | Scientific credibility |
| 3 | Contract security tests (CONTRACTS.md §9) | Tech | "Functions as intended" |
| 4 | Demo video 3–5 min + Devpost text | Presentation (and all others) | Required for judging |
| 5 | Verify page (no wallet) | Innovation, Usefulness | The core differentiator |
| 6 | Explorer chart with ERA5 vs CHIRPS honesty | Climate, Presentation | |
| 7 | Rejection demos (simulate) | Tech, Presentation | |
| 8 | Landing page polish | Presentation | |
| 9 | Locator map, dark mode, motion | Presentation | Cut first |

## 1. Milestones

### Phase 0: Research and documents (Mon 19 Oct) ✅ when approved
- The seven docs exist; the climate case is verified with real requests.
- **Gate G0:** human approval, plus the human actions in §4.

### Phase 1: Foundations (Tue 20 Oct) ✅ app + climate engine done 2026-10-19
> Status: everything below is done **except the contract items**. The Phase 1 brief scoped them out, and Foundry is not installed. They move to the start of Phase 2. Evidence: README.md "Verified results".

Test-first throughout.
- Scaffold Next.js (create-next-app, pinned versions), Tailwind, shadcn init, Geist. Create the Foundry project under `contracts/`.
- `lib/climate`:
  - Parser, validator (missing-data rules) and SRPN-v1 in BigInt.
  - JCS canonicalization and the evidence builder.
  - **Snapshots:** commit the raw Open-Meteo responses (Yabelo, era5) plus `manifest.json` with SHA-256 hashes. ✅
- `RilvaEscrow.sol` with the full test suite and invariants. → **done in Phase 2a with Hardhat 3** (Foundry dropped)
- Typed-data parity test between viem and Solidity. → **moved to Phase 2**
- **Gate G1:**
  - `vitest` green with golden values 3363 / 4461 / 21322 / 5468.
  - Contract tests green → done in Phase 2a with Hardhat (`pnpm contracts:test`).
  - Coverage ≥ 95 %.
  - Lint, typecheck and build pass.

### Phase 2a: Secure escrow contracts (Hardhat 3) ✅ done 2026-10-19; deployed to Base Sepolia 2026-10-23
- `RilvaEscrow` implemented test-first.
  - 62 Hardhat tests: creation, settlement, attacks, lifecycle, randomized invariant, cross-language EIP-712 parity, and real OND 2021/2022/2023 evidence.
  - 100 % line coverage. Gas recorded (CONTRACTS.md §10).
- `lib/contracts` integration surface; Ignition module deployed locally.
- Deployed to Base Sepolia 2026-10-23 with human approval: `0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E`, block 49094017. Smoke checks passed (DEPLOYMENT.md).

### Phase 2b → Phase 3: Chain + core flows (Wed 21 Oct)
> **Update 2026-10-24: Gate G2 is green.** Campaigns #1 (OND 2021 → Released), #2 (OND 2023 → Refunded, rule not met) and #3 (OND 2022, active) were created through the deployed app on Base Sepolia, and `/verify/1` and `/verify/2` pass every applicable check without a wallet (DEPLOYMENT.md). The app's Base Sepolia config is live on Vercel. Source verification is still optional.
>
> Status 2026-10-22: pages, wallet flows and verification are **built and tested on a local Hardhat chain** (Phase 3 below). Update 2026-10-23: `RilvaEscrow` is **deployed to Base Sepolia** (DEPLOYMENT.md). **Still pending:** source verification, the app's Base Sepolia config, and the testnet demo campaigns A/B. Gate G2 cannot be green until then.
- ~~Deploy to Base Sepolia~~ (done 2026-10-23, address and deploy block recorded in DEPLOYMENT.md); verify the contract on Basescan.
- Pages: `/campaigns/new` (create + fund), `/campaigns/[id]` (evidence, attest via the wallet's signTypedData, settle, refund), `/verify/[id]`.
- Create demo campaigns A (OND 2021) and B (OND 2023) on testnet.
- **Gate G2:**
  - A → Released; B → Refunded (NotTriggered), done on testnet through the UI.
  - The verify page shows all checks passing for A and B.
  - Rejection simulations return the expected errors.

### Phase 3: Premium application interface (Thu 22 Oct)
> Status 2026-10-22: **done locally** with the `pixel-meadow-ui` skill — `/`, `/explore`, `/campaigns`, `/campaigns/new`, `/campaigns/[id]` (recompute → EIP-712 review → sign → submit/export, timeout refund, Try to break it), `/verify/[id]`, `/methodology`. Gates: lint, typecheck, Vitest, `climate:verify`, build, Hardhat tests incl. `appFlow.test.ts`, Playwright (journeys, 360/390 px overflow, local-chain journeys). Screenshot review at 1440/390 px, light and dark. **Not done:** Vercel deploy (human account + approval) and the deployed-URL journey, so Gate G3 remains open. **Update 2026-10-24:** deployed at https://rilva-six.vercel.app (since 2026-10-24 served at https://rilva.xylolabs.space, same deployment); the full journey ran on the deployed URL, and the screenshot review at 1440/390/360 px (light and dark) passed. G3 is green.
- `/explore` (chart, year panel, CHIRPS cross-check table), `/` landing, `/methodology`.
- "Try to break it" panel, plus all loading, error and wallet states.
- Deploy to Vercel (preview → production).
- **Gate G3:**
  - Full journey works on the deployed URL in a clean browser profile.
  - Screenshot review passes at 1440 px and 390 px (DESIGN.md §10).

### Phase 4: Hardening + feature freeze (Fri 23 Oct, freeze 18:00)
- Integration test pass: the acceptance tests in §3, run on the deployed app.
- README with setup, reproduction recipe, trust model, limitations and attributions.
- Fix pass and copy review against PRODUCT.md §9 (forbidden claims).
- **Gate G4:** all acceptance tests pass. No P0/P1 bugs. **Feature freeze. Only fixes after this point.**

### Phase 5: Video + submission (Sat 24 Oct)
- Script (PRODUCT.md §8), recording at 1080p, edit to **≤ 4:50**, and upload (YouTube/Vimeo, public or unlisted).
- Devpost draft: track alignment, description (problem / solution / users / scale / adoption), repo link, demo link, video.
- **Gate G5:** the human has watched the video in full and the Devpost draft is saved.

### Phase 6: Buffer + submit (Sun 25 Oct)
- Submit by **12:00 EAT**. 12:00–17:00 is emergency-only.

## 2. Fallback scope (cut in this order)

1. Dark mode and motion polish.
2. Locator map → replace with a text location card (coordinates and grid cell).
3. Landing page → shrink to a single section that links to the explorer and demos.
4. Explorer CHIRPS column → keep it as a static table in `/methodology`, sourced from CLIMATE_DATA.md.
5. `/api/rainfall` proxy → the browser fetches Open-Meteo directly (CORS verified), with the saved snapshot as fallback. **Applied 2026-10-22: removed from scope.**
6. Live creation in the video → use pre-created campaigns A and B and show the create form only.
7. **Last resort:**
   - If Base Sepolia or the faucets are unusable, run the demo on a local Anvil chain and record it. State clearly that it is local.
   - Contract tests and verification still stand.

The following are **never cut**: the SRPN golden tests, contract security tests, the replay and limitation disclosures, and the verify page.

## 3. Acceptance tests (run in Phase 4 on the deployed app)

| ID | Test | Expected |
|---|---|---|
| AT-1 | Explorer loads OND series 1991–2023 for Yabelo | 33 bars. OND 2021 = 78.7 mm, 33.6 %. Source caption visible. |
| AT-2 | Open-Meteo blocked (devtools offline for that host) | Fixture fallback with a visible notice. Same numbers. |
| AT-3 | Create campaign A (OND 2021, 6000 bps, 0.01 ETH) | `CampaignCreated` emitted. The spec hash shown in the UI equals the one on-chain. |
| AT-4 | Attestor recomputes A | 92/92 days, 30/30 seasons, indexBps 3363, evidence hash identical to `public/evidence` |
| AT-5 | Settle A | Status Released. Beneficiary +0.01 ETH. Events shown in the timeline. |
| AT-6 | Campaign B (OND 2023) settle | indexBps 21322. Status Refunded (reason NotTriggered). Funder receives the amount in the same transaction; the beneficiary receives nothing. |
| AT-7 | Timeout refund on an unsettled campaign C after its deadline | Status Refunded (reason Timeout). Funder receives the amount. |
| AT-8 | Unauthorized signer (simulate) | "Rejected: InvalidSigner" with a plain-language reason |
| AT-9 | Altered indexBps (simulate) | "Rejected: InvalidSigner" |
| AT-10 | Duplicate settle on A (simulate) | "Rejected: CampaignNotActive" |
| AT-11 | `/verify/A` in a fresh browser without a wallet | All checks pass. Basescan links resolve. |
| AT-12 | Tampered evidence JSON uploaded or loaded into verify | The hash check fails visibly |
| AT-13 | Wrong network in the wallet | Switch-network prompt. No tx sent. |
| AT-14 | 390 px viewport on all routes | No horizontal scroll. All actions reachable. |
| AT-15 | Copy audit | No forbidden claims (PRODUCT.md §9). The replay banner is present on campaign, evidence and verify pages. |

## 4. Human actions required (blocking items marked ⛔)

- ⛔ **Before G0:** confirm eligibility (PRODUCT.md §10, especially "Students only"), confirm the Devpost registration, and decide team composition.
- ⛔ **By Tue 20 Oct:**
  - Create a **public GitHub repository**.
  - Create three testnet wallets (funder, attestor, beneficiary) and fund the funder and attestor with Base Sepolia ETH from a faucet.
  - Whether a faucet needs a mainnet balance or account is UNVERIFIED.
- ⛔ **By Wed 21 Oct:** a deployer key in an untracked `.env.local`, and a Basescan/Etherscan API key for source verification (optional; skip verification if unavailable).
- **By Thu 22 Oct:** a Vercel account linked to the repo.
- **Sat 24 Oct:** record the voice-over or approve a text-only video, and choose a video host.

## 5. Risk register

| # | Risk | Likelihood | Impact | Mitigation / contingency |
|---|---|---|---|---|
| R1 | **6-day schedule** | High | High | Strict gates, freeze on Fri 18:00, fallback list §2, video reserved for a full day |
| R2 | Eligibility conflict ("Students only") | Medium | Critical | Human emails the organisers on day 0 |
| R3 | Testnet faucet limits / no ETH | Medium | High | Get funds on day 1. Demo amounts are 0.01 ETH. Anvil fallback. |
| R4 | Open-Meteo outage or rate limit (observed flakiness) | Medium | Medium | Committed snapshots (done), retry with backoff (done); no proxy (removed from scope) |
| R5 | Typed-data mismatch between viem and Solidity | Medium | High | Golden digest parity test in Phase 1 |
| R6 | Dependency incompatibility (TS 7, Next 16.4, wagmi 3) | Medium | Medium | Use the versions create-next-app pins. Pin exact versions and lock. |
| R7 | Scientific credibility challenged (ERA5 vs CHIRPS disagreement) | Medium | Medium | Show both sources openly. The chosen OND season agrees (r = 0.90). Explicit limitations. |
| R8 | Misleading-impact perception | Low | High | Forbidden-claims audit (AT-15), replay banner |
| R9 | Public RPC rate limit | Low | Medium | Optional dedicated RPC URL via env |
| R10 | Video over 5 min or unclear | Medium | High | Script with timings. Target 4:30–4:50. Rehearse. |
| R11 | Wallet UX friction for judges | Medium | Medium | The verify page and pre-created campaigns need no wallet |
| R12 | Secret leakage | Low | Critical | No keys on the server, `.gitignore`, pre-commit grep (CLAUDE.md) |
