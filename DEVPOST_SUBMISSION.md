# DEVPOST_SUBMISSION.md — ready-to-paste entry

Form read on 2026-10-24 from the draft at devpost.com (submission 1238428). The steps are: Manage team ✓ → Project overview → Project details → Additional info → Submit. **There is no track dropdown**, so the track is stated at the top of "About the project".

Deadline shown on the form: **Oct 25, 2026 @ 5:00 pm GMT+3**.

---

## Step 2 — Project overview

**Project name** (60 chars max)
```
Rilva — Climate Evidence. Verifiable Relief.
```

**Elevator pitch** (200 chars max)
```
Drought-relief triggers anyone can check: a reproducible ERA5 rainfall index, a signed attestation, and a testnet escrow that pays only on a public rule. Verifiable in a browser.
```

**Thumbnail** (3:2, ≤ 5 MB): `docs/media/devpost-cover.png`

---

## Step 3 — Project details

### About the project (Markdown)

```markdown
**Track: Climate Data & Environmental Monitoring.** Rilva tackles a problem this track names directly: environmental data is fragmented and hard to verify. We turn a rainfall-based funding rule into evidence that anyone can recompute, and a payment that only a public rule can trigger.

> Testnet demonstration with historical data. No real funds, no insurance, no relief delivered. The 60 % threshold is illustrative.

## Inspiration

Anticipatory climate finance often runs on a simple promise: *if the rains fail, release the funds.* In late 2021 the October–December rains failed across southern Ethiopia. FEWS NET reported rainfall at 45–75 % of average in the southern pastoral areas, including Borena.

When a decision like that is made, an outsider can rarely answer three questions. Which data was used? How was the number computed? Who decided, and did the money go where it was promised? Often the answer sits in a spreadsheet and an email thread. We wanted to see how far a small, honest system could go in making that chain checkable by anyone, without asking them to trust us.

## What it does

Rilva is a working demo for one place and one rule: **seasonal rainfall at Yabelo, Borena (Ethiopia), compared with the 1991–2020 normal.**

1. **A public rule, fixed before money moves.** A funder chooses a season. The spec (location, data source and model, season, baseline, threshold) is hashed and stored in a smart contract together with the locked test ETH, the beneficiary and the attestor.
2. **Reproducible evidence.** SRPN-v1 (seasonal rainfall percent of normal) is computed from ERA5 reanalysis via Open-Meteo, using integers only. OND 2021 comes out at **33.63 %** of normal, OND 2022 at 44.61 %, and OND 2023 at 213.22 %. The inputs and result are canonicalised (RFC 8785) and hashed into a single evidence digest.
3. **A named attestor signs exactly what they checked.** The attestor recomputes the evidence in their browser, reviews a readable EIP-712 message, and signs it in their own wallet.
4. **The contract applies the rule itself.** `RilvaEscrow` checks the signer, spec, period and expiry, compares the index with the threshold, and either releases the funds to the fixed beneficiary once or refunds the funder. If nobody settles, anyone can refund after the deadline.
5. **Anyone can verify, with no wallet.** `/verify/[id]` reads the chain and decodes the signed attestation. It recovers the signer, re-downloads the SHA-256-pinned ERA5 files, and recomputes the index and the hash. Seven checks each say what they prove, and the page says what it cannot prove.

**Real on-chain runs (Base Sepolia):**
- [Campaign #1](https://rilva.xylolabs.space/verify/1): OND 2021, 3363 bps ≤ 6000, **Released** ([tx](https://sepolia.basescan.org/tx/0xd5e77248c989878540c6c082b2b6c877c4aa5fb3c38eba3bc6c8f5d0e807d95c)).
- [Campaign #2](https://rilva.xylolabs.space/verify/2): OND 2023, 21322 bps, **Refunded, rule not met** ([tx](https://sepolia.basescan.org/tx/0xb5d6d551bfc49b13a211fe5bdad028a153c75f916ccc47e50e1c4f0f62bab019)).
- [Campaign #3](https://rilva.xylolabs.space/campaigns/3): OND 2022, active. Try to break it: forged signatures and early refunds are rejected by the deployed contract (simulated with `eth_call`, nothing sent).

## How we built it

- **Climate engine (TypeScript):** strict validation of untrusted Open-Meteo JSON (`models=era5`, `daily=precipitation_sum`, `timezone=Africa/Addis_Ababa`). Any missing day, null or error makes the result `INVALID`; we never gap-fill. Rainfall is normalised to tenths of a millimetre and the index uses BigInt (`floor(T × 10000 × N / S)`). Our own RFC 8785 JCS implementation feeds keccak256 evidence digests.
- **Evidence:** raw API responses are committed byte-for-byte with SHA-256 hashes in a manifest. Golden tests pin 3363 / 4461 / 21322 bps (and a 5468 bps reference case).
- **Smart contract:** Solidity 0.8.37 with OpenZeppelin `EIP712`, `ECDSA` and `ReentrancyGuard`. It is ownerless and non-upgradeable, makes no arbitrary calls, and follows checks-effects-interactions. It was built test-first with Hardhat 3: 79 tests covering every revert path with its exact custom error, a randomised invariant test, cross-language EIP-712 digest parity (viem vs Solidity), and real-evidence journeys. Line coverage of `RilvaEscrow.sol` is 100 %.
- **App:** Next.js 16, React 19, Tailwind CSS 4, viem and wagmi, TanStack Query and Recharts. There is no backend database: campaign history is read straight from the contract. Deployed on Vercel. 238 Vitest tests, plus Playwright journeys and a forbidden-claims copy audit that runs as a test.

## Challenges we ran into

- **Choosing a dataset that doesn't change under you.** Open-Meteo's default `best_match` switches models in 2017, which makes a 1991–2020 baseline meaningless, so we pin `models=era5`. ERA5 and CHIRPS also disagree: CHIRPS puts OND 2021 at 52.5 %, and in MAM 2021 one dataset meets the rule while the other doesn't. Rather than hide it, the explorer shows the disagreement, and the data source is part of the hashed rule.
- **Then the data changed anyway.** Two days before submission, our live check reported that Open-Meteo had revised its ERA5 archive in place. Hundreds of daily values had shifted slightly, and OND 2021 had moved from 3363 to 3362 bps. Every decision was the same, but a "re-fetch and compare" design would have turned every past attestation red. We now pin verification to the hashed snapshot files and show the live value next to it as an "upstream revised" note. That incident is now a core part of how we think about oracle honesty.
- **Integer math that matches Solidity.** No floats in the decision path. Equality triggers (`≤`), and floor rounding is documented and tested on both sides.
- **Real wallets are messier than test wallets.** Our testnet wallet submitted transactions through a smart-account relayer, so the `settle()` call was nested inside another call and the verify page couldn't decode it. We now find the nested call, while the signer and field checks stay as strict as before.
- **Public RPC limits.** Base Sepolia's public endpoint caps log queries at 200 blocks, so history is located by binary search over contract state instead of scanning.

## Accomplishments that we're proud of

- A full lifecycle on a public testnet: create → attest → **release**, and create → attest → **refund**, all verifiable by a stranger with 7/7 checks passing.
- Climate numbers anyone can reproduce byte for byte, with the honest caveats attached.
- Security tests for every way we could think of to move the funds wrongly: a stranger's signature, an altered index, a swapped evidence hash, replay, settling twice, early refund, and reentrancy.
- A product that says what it does **not** prove, on the same page as the green checks.

## What we learned

- A matching hash proves **integrity and reproducibility**, not truth. ERA5 is a ~28 km model estimate, not a rain gauge, and rainfall deficit is not drought impact or financial loss.
- The attestor stays a trusted party. Cryptography doesn't remove that trust, but it makes every claim checkable and every lie attributable.
- Live climate APIs are not immutable records. Reproducibility needs content-addressed inputs plus a deterministic method.

## What's next

These are possibilities, not features we have built:
- **Multiple attestors** (k-of-n), so no single data steward decides alone.
- **Independent data-source validation**, such as CHIRPS and station data as co-signed cross-checks, and published snapshot archives (for example on IPFS).
- **More places and seasons**, and indicators such as SPI, calibrated with the programmes and communities they would serve.
- **Field verification** and partnerships with anticipatory-action and adaptation-finance practitioners, then a controlled, audited pilot.

## Practical use and scalability

The pattern suits any programme that already pre-agrees a climate trigger: anticipatory-action funds, adaptation grants, or NGO cash programmes. Rilva doesn't replace their judgement. It gives their rule, their data and their decision a public, checkable record. Running costs are small: a few hundred thousand gas per campaign on an L2, and static hosting for evidence. Verification costs nothing to the person checking. Before any real money, it would need methodology validation with domain experts, multi-attestor governance, a professional contract audit and legal review. None of these exist today.
```

**Built with** (≤ 25 tags)
```
typescript, next.js, react, tailwindcss, solidity, hardhat, openzeppelin, eip-712, viem, wagmi, base-sepolia, ethereum, open-meteo, era5, vercel, vitest, playwright, recharts, tanstack-query, keccak256, rfc-8785
```

**"Try it out" links**
```
https://rilva.xylolabs.space
https://rilva.xylolabs.space/verify/1
https://github.com/lijnati/Rilva
```

**Image gallery** (3:2, ≤ 5 MB each, up to 15), upload in this order from `docs/media/`:
1. `devpost-cover.png`: title card
2. `gallery-1-explore.png`: Climate explorer, OND 2021 at 33.63 %
3. `gallery-2-campaign.png`: Campaign #1, Released
4. `gallery-3-verify.png`: Public verification, 7/7 checks
5. `gallery-4-refund.png`: Campaign #2, Refunded, rule not met
6. `gallery-5-architecture.png`: Architecture diagram

**Video demo link** (required, YouTube or Vimeo)
```
[VIDEO URL — pending upload; see RECORDING_PLAN.md]
```

---

## Step 4 — Additional info (judges only)

**Upload a File** (required, ≤ 35 MB): `rilva-judge-pack.zip`, containing:
- `JUDGE_GUIDE.pdf`: the 5-minute no-wallet walkthrough with deep links.
- `README.pdf`: an export of README.md.

No source code is included; it is on GitHub.

---

## Submission integrity checklist
- [x] All URLs, addresses and hashes copied from DEPLOYMENT.md (checked against chain receipts 2026-10-24).
- [x] Numbers match golden tests (3363 / 4461 / 21322 bps).
- [x] No forbidden claims (PRODUCT.md §9): no insurance, real-time, ground truth, official threshold, impact counts or audit claims.
- [ ] Video URL inserted and plays signed-out.
- [ ] Final human read-through, then **Submit** (human approval required).
