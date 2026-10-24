# Rilva — 5-minute judge guide (no wallet needed)

**Live app:** https://rilva.xylolabs.space · **Code:** https://github.com/lijnati/Rilva · **Track:** Climate Data & Environmental Monitoring

Everything below runs in an ordinary browser. You do not need a wallet, an account or test ETH. All seasons are **historical (retrospective replays)**. All money is **Base Sepolia testnet ETH**. The 60 % threshold is **illustrative**.

## 1. The problem (30 s)
Open https://rilva.xylolabs.space.

Climate-relief funds often pre-agree a trigger, such as "pay if the rains fail". From outside it is hard to check which data was used, how the number was computed, and who decided. Rilva makes each of these public and checkable. The case study is **Yabelo, Borena Zone, Ethiopia**, October–December rains.

## 2. The evidence (1 min)
Open https://rilva.xylolabs.space/explore.

- The chart shows 33 OND seasons from ERA5 (via Open-Meteo) for one ~28 km grid cell, against the 1991–2020 normal (234.0 mm).
- **OND 2021: 78.7 mm = 33.63 % of normal.** The 60 % line is an illustrative rule.
- Scroll to the ERA5 vs CHIRPS comparison. The datasets disagree, which is why the data source is fixed inside the rule.
- Click **Recompute**. Your browser rebuilds the index and the evidence hash from the committed ERA5 files (SHA-256 checked). It should say "Matches the saved evidence digest."
- You will also see **"Upstream revised"**. Open-Meteo revised its ERA5 archive after our 2026-10-19 snapshot (live: 33.62 %, same decision). Rilva pins evidence to the hashed files and shows the revision openly (CLIMATE_DATA.md §2.4).

## 3. A real campaign (1 min)
Open https://rilva.xylolabs.space/campaigns/1.

- **Released to beneficiary.** A funder locked 0.001 test ETH. The beneficiary, the attestor, the season and the threshold were fixed at creation and hashed on-chain.
- The audit trail shows creation and settlement, with links to the transactions.
- Settlement tx on Basescan: https://sepolia.basescan.org/tx/0xd5e77248c989878540c6c082b2b6c877c4aa5fb3c38eba3bc6c8f5d0e807d95c

## 4. Verify it yourself (1.5 min) ← the core of Rilva
Open https://rilva.xylolabs.space/verify/1 (works best in a private window).

Within about 20 s, seven checks complete, and each says what it proves:
1. The spec hash matches the published rule.
2. The spec agrees with the on-chain terms.
3. The index recomputes from ERA5 (3363 bps).
4. The evidence hash recomputes.
5. The attestation was signed by the campaign's attestor (signature recovered from the settle transaction).
6. The outcome follows the rule (3363 ≤ 6000 → release).
7. The funds went to the address fixed at creation.

Then look at **"Not checked, and not claimed"**. Rilva does not claim ERA5 is accurate at this place, or that anyone was helped.

The contrasting case: https://rilva.xylolabs.space/verify/2. OND 2023 was 213.22 % of normal, so the contract **refunded the funder (rule not met)**.

## 5. Try to break it (1 min)
Open https://rilva.xylolabs.space/campaigns/3 (active) and scroll to **Try to break it**.

- **Sign with a stranger's key** → rejected (`InvalidSigner`).
- **Refund before the deadline** → rejected (`SettlementWindowOpen`).
- On https://rilva.xylolabs.space/campaigns/1, **Settle the same campaign twice** → rejected (`CampaignNotActive`).

These are `eth_call` simulations against the deployed contract. Nothing is sent. Altered-index and swapped-evidence attacks need the attestor's signature, so they are covered by the Hardhat suite (79 tests, including every revert path and reentrancy).

## Trust model and limits (read this)
- The **contract** enforces the rule, the beneficiary, single payment and refunds by itself.
- The **attestor is trusted** to sign honestly. Rilva makes the attestation checkable and attributable, not automatically true.
- **ERA5 is a reanalysis model estimate**, not a rain gauge. A rainfall index is **not** drought impact or financial loss.
- This is a hackathon demo: Base Sepolia testnet only, no professional audit, one location, one method.

## If something does not load
- The pages read the public Base Sepolia RPC (`sepolia.base.org`). If it is rate-limited, the page shows an error with **Try again**; wait a few seconds and retry. Results are never faked.
- Every transaction is independently visible on Basescan. The contract is [`0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E`](https://sepolia.basescan.org/address/0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E).
- To reproduce the numbers offline: `pnpm install && pnpm climate:verify all` (README).
