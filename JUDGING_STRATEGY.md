# JUDGING_STRATEGY.md — internal

Criteria come from the official rules page (read 2026-10-24). No weights are published, so we treat them as equal. Every claim below has an artefact behind it. If it doesn't, it isn't claimed.

## Positioning in one line
Not a new kind of drought finance. Parametric triggers and drought-index funding already exist. Rilva's contribution is to put **reproducible climate evidence, a transparent attestation, immutable settlement conditions and public no-wallet verification** into one working flow that a non-specialist can check.

## Per criterion

| Criterion | Strongest evidence | Emphasise | Don't overreach |
|---|---|---|---|
| **Climate Impact** | Real ERA5 data for a documented drought (Borena OND 2021; FEWS NET 45–75 % of average). The ERA5 vs CHIRPS disagreement is shown openly. The upstream ERA5 revision was found and disclosed (CLIMATE_DATA.md §2.4). | Accountability and verifiability of climate-triggered decisions, not delivered impact. | No people or livestock counts, no "saves lives", no impact claims. A rainfall index is not drought impact. |
| **Innovation & Creativity** | `/verify/[id]`: a stranger recomputes evidence, recovers the signer and checks the payout, with each check labelled by kind (authentic, reproducible, attested, contract) and an explicit "not claimed" list. Snapshot pinning plus an "upstream revised" note. | The combination, and honesty as a design feature. | Don't claim to have invented parametric insurance or oracles. |
| **Technical Execution** | 79 Hardhat tests (every revert path, invariants, reentrancy, cross-chain/campaign replay, viem↔Solidity EIP-712 parity), 100 % line coverage of `RilvaEscrow`; 238 Vitest tests, golden values, `climate:verify` offline. A real Base Sepolia lifecycle: release (#1), refund (#2), active (#3). Two real-world bugs found and fixed test-first during release (data revision; smart-account calldata). | The data → hash → signature → contract → verification chain, end to end on a public testnet. | "Not professionally audited." No "trustless". The attestor is trusted. |
| **Practical Usefulness** | No-wallet judge path; reads straight from the chain with no backend; cheap on an L2; plain-language rule review before signing. | Users: anticipatory-action funds, adaptation grants, NGOs that already pre-agree triggers. | No partnerships or pilots exist. "What's next" stays clearly future. |
| **Presentation & Storytelling** | A 4:15 video built on three moments (evidence, rule-bound payment, anyone verifies), real footage only, and a judge guide that takes 5 minutes. | Open the product within 25 s. Make the verify page the memorable beat. | No slideshow padding, no fake UI, no stock "impact" footage. |

## What the product demonstrates today
- One location (Yabelo), one method (SRPN-v1), one source (ERA5 via Open-Meteo), three historical seasons.
- Create, attest, settle (release or refund), timeout refund, rejection simulations and public verification, all live on Base Sepolia.

## Why it's distinctive
1. Verification is the product, not an afterthought. Every check states what it proves and what it doesn't.
2. Evidence is content-addressed, and the system survived a real upstream data revision without breaking past attestations.
3. AI is deliberately **not** in the decision path. For a fund-release trigger, a deterministic, reproducible method is the stronger trust story. The hackathon theme mentions AI, so we say why we kept it out instead of bolting it on.

## Limitations and open questions (say them before a judge does)
- Single trusted attestor; no multi-sig or dispute window.
- ERA5 cell ≈ 28 km and drier than FEWS NET's range for OND 2021; CHIRPS disagrees in some seasons.
- The 60 % threshold is illustrative and not calibrated with any programme.
- Testnet only, no audit, no legal review. Rainfall ≠ impact ≠ loss.

## Emphasis for video and description
- Hook with the real 2021 context (cited), then the three "hard to check" questions.
- Spend the most screen time on `/verify/1` turning green with no wallet.
- Show the refund case (#2) to prove the rule cuts both ways.
- Close on the honest revision finding and the realistic path (multi-attestor, validation, audit, pilot).
