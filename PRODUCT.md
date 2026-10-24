# PRODUCT.md — Rilva

**Climate evidence. Verifiable relief.**

> Hackathon: IEEE ClimateChain Global Hackathon (https://ieee-climatechain-hack.devpost.com/). Track: **Climate Data & Environmental Monitoring**.
> Deadline (Verified on Devpost, accessed 2026-10-19): **Oct 25, 2026 @ 5:00pm +03** (17:00 Africa/Addis_Ababa = 14:00 UTC).

## 1. Problem

Drought-relief funding often runs on pre-agreed triggers ("if the rains fail, release funds"). For outside observers, three questions are hard to answer:
- **Which data** was used?
- **How** was the number computed?
- **Who** decided the condition was met, and did the money go where it was promised?

Rainfall data is fragmented across products that disagree. Calculations live in spreadsheets, and the audit trail is often an email. This matches the track's stated problem: "Environmental data is fragmented and difficult to verify" (Devpost, Verified 2026-10-19).

## 2. Solution

Rilva turns a drought-trigger rule into a public, reproducible, and enforceable artefact.
1. A **campaign spec** fixes the location, data source and model, season, baseline and threshold. It is hashed and stored on-chain before funds are locked.
2. A **deterministic indicator** (SRPN-v1, seasonal rainfall percent of normal) is computed from public ERA5 data via Open-Meteo. The computation is integer-only and unit-tested.
3. A designated **attestor** signs an EIP-712 statement of the result and the evidence hash.
4. A **smart contract** checks the signature, applies the threshold itself, and releases the fixed amount to the fixed beneficiary **once**. Otherwise the funder can recover the funds.
5. **Anyone can verify** each step from a browser: they re-download the SHA-256-pinned ERA5 data, recompute the index and the hash, and compare with the on-chain record. A live re-fetch is shown alongside as information (CLIMATE_DATA.md §2.4).

## 3. Users

| User | Need | In the demo |
|---|---|---|
| **Funder**: a donor or programme officer at an NGO or anticipatory-action fund | Commit funds to a transparent, pre-agreed rule; get them back if the rule isn't met | Testnet wallet A |
| **Attestor**: an independent data steward, e.g. a met-service or university partner | Sign only what they have reproduced; minimal tooling | Testnet wallet B |
| **Beneficiary**: an implementing partner or cooperative | Know exactly when and why funds are released | Testnet address C (no real recipient) |
| **Auditor / public / judge** | Check the claim without trusting Rilva | No wallet needed |

## 4. Value proposition

- **For funders:** the trigger rule is public before money moves, and enforcement is mechanical.
- **For auditors:** "show me the math" takes one click, with reproducible numbers and a public trail.
- **For the climate-data ecosystem:** it shows source provenance concretely. The same season can look different in ERA5 and CHIRPS, and Rilva shows that openly rather than hiding it.

## 5. Scope (MVP)

In scope:
- One study location: Yabelo, Borena, Oromia, Ethiopia (4.88° N, 38.08° E).
- One method (SRPN-v1) and one source (Open-Meteo ERA5), with CHIRPS v3 shown as an informational cross-check.
- Campaign creation and funding with Base Sepolia testnet ETH.
- Evidence computation and attestation by the attestor's wallet in the browser.
- Settlement: trigger or non-trigger, and refund.
- A public verification page and audit trail.
- Readable rejection demos (unauthorized, altered, duplicate).
- A climate explorer with real historical seasonal totals, 1991–2023.
- A premium landing page and a methodology/limitations page.

## 6. Non-goals

- Tokens, DAOs, NFTs, governance, staking, or any speculative crypto mechanics.
- Mainnet, real money, insurance products, or claims of actual relief delivery or humanitarian impact.
- Multiple regions or seasons beyond the Yabelo OND replays (and no MAM toggle), polygons, multiple indicators, SPI, or ML forecasting. These appear only as roadmap items in "From replay to real use".
- Accounts, enterprise auth, a database, or notifications.
- Live drought alerts. Every demo season is a labelled retrospective replay.
- Any AI: no AI deciding eligibility or payouts, and no AI summaries (removed from scope 2026-10-22).
- A server-side rainfall proxy (`/api/rainfall`): removed from scope 2026-10-22; the browser reads Open-Meteo directly with a snapshot fallback.

## 7. User journeys

1. **Explore:**
   - Land on `/` and open `/explore`.
   - See 33 OND seasons at Yabelo against the 1991–2020 normal.
   - OND 2021 is highlighted (33.6 % of normal) beside the CHIRPS v3 value (52.5 %), with an explanation of why they differ.
2. **Create:**
   - The funder connects a wallet, chooses OND 2021 (replay) and sees the spec JSON and the illustrative 60 % threshold.
   - They set the beneficiary, attestor and amount (e.g. 0.01 testnet ETH) and fund the campaign.
3. **Attest:**
   - The attestor connects. The page recomputes from source: 92/92 days, 1991–2020 baseline complete, index 3363 bps, hash `0x…`.
   - The attestor signs, then submits.
   - The result is **Released**, and the beneficiary balance increases.
4. **Non-trigger:** the same flow for OND 2023 gives 21322 bps → **NotTriggered**, and the funder refunds.
5. **Break it:** an unauthorized signature, an altered index, or a duplicate submission each produce a plain-language rejection.
6. **Verify:** open `/verify/[id]` with no wallet. The checklist shows green ticks with links to Basescan.

## 8. Demo story (3–5 min video; Devpost requires 3–5 minutes)

> Superseded in detail by [VIDEO.md](VIDEO.md) (2026-10-22): the video is built around three moments — the evidence (with source disagreement), money moving only on the rule, and anyone verifying while attacks are refused. The table below remains the high-level beat sheet.

| t | Beat | Judging criterion served |
|---|---|---|
| 0:00–0:35 | The problem. Borena's 2021 Hagaya rains failed (FEWS NET: deyr/hagaya 45–75 % of average in southern pastoral areas). Relief triggers are opaque. "Rilva makes the rule and the evidence public and enforceable." | Climate Impact, Presentation |
| 0:35–1:20 | The explorer shows real ERA5 data: 33 seasons, the normal, OND 2021 at 33.6 %, and CHIRPS at 52.5 %. Honest uncertainty. | Climate Impact, Technical Execution |
| 1:20–2:20 | Create a campaign (spec hashed on-chain), then attestor recompute → sign → settle → Released on Basescan. | Technical Execution, Innovation |
| 2:20–3:00 | Non-trigger replay (OND 2023, 213 %) → NotTriggered → refund. | Practical Usefulness |
| 3:00–3:40 | Break it: unauthorized, altered, duplicate, all rejected. | Technical Execution |
| 3:40–4:20 | Public verification with no wallet. Trust model in one slide: the attestor is trusted, but the attestation is checkable. | Innovation, Practical Usefulness |
| 4:20–4:50 | Limits and next steps (multi-attestor, more regions, SPI, partner pilots). Retrospective replay disclaimer. | Presentation |

## 9. Measurable claims (only these may be claimed publicly)

Each claim must be backed by an artefact before it appears in the video or README.

1. "The OND 2021 index at the Yabelo ERA5 grid cell is **3363 bps (33.63 % of the 1991–2020 normal)**, reproducible from public data." → Golden test + verify page.
2. "OND 2023 at the same cell is **21322 bps (213.22 %)** and does not trigger the illustrative 60 % rule." → Golden test + testnet tx.
3. "Funds can only be released once, only to the pre-set beneficiary, and only with the designated attestor's EIP-712 signature." → Foundry tests (CONTRACTS.md §9) + coverage report.
4. "Unauthorized, altered, and duplicate attestations are rejected." → Foundry tests + demo panel.
5. "Anyone can re-derive the evidence hash without trusting Rilva's server." → Verify page with direct fetch.

**Forbidden claims:**
- Any people or livestock helped, money delivered, or losses prevented.
- "Real-time" or "live" drought detection.
- "Insurance" or "guaranteed payout".
- That ERA5 or CHIRPS is "ground truth".
- That 60 % is an official drought threshold.

## 10. Hackathon fit and eligibility (accessed 2026-10-19)

Sources: https://ieee-climatechain-hack.devpost.com/ and https://ieee-climatechain-hack.devpost.com/rules

**Submission requirements (Verified):**
- Track alignment statement.
- Project description covering the problem, solution, target users, how it can scale, and ease of adoption.
- **Demo video, 3–5 min.**
- **Public GitHub (or equivalent) repo** with source and documentation.
- Working prototype, mockup, or proof of concept.
- Submit before the deadline.

**Judging criteria (Verified; no weights published, so treat as equal — UNVERIFIED):**
1. Climate Impact
2. Innovation & Creativity
3. Technical Execution
4. Practical Usefulness
5. Presentation & Communication. The rules page titles this "Presentation & Storytelling".

**Eligibility: the human participant must confirm each item.**
- ⚠️ **Conflict, UNVERIFIED:** the overview sidebar says "**Students only**", while the rules page lists open categories including "Independent developers and startups" and "Environmental professionals". Ask the organisers, via "Email the hackathon manager" on Devpost, if you are not a student.
- Must be "Above legal age of majority in country of residence".
- "Companies/professional organizations excluded from participation".
- Excluded territory per the Devpost tooltip: "Korea Democratic People's Republic of".
- Teams of 2–5, or individual. One person per team. Organisers, judges and their immediate family cannot compete. Previous grand-prize winners can only compete for smaller awards.
- The Devpost **registration** status of the participant is unknown to Rilva (human to confirm).

**Prizes (Verified):** $1,500 / $1,000 / $500 plus IEEE certificates. The rules page also says "Prizes TBD". Not relevant to the build.
