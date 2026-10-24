# VIDEO_SCRIPT.md — Rilva demo video (target 4:15)

> Supersedes the timings in VIDEO.md. VIDEO.md stays the source for the "three moments" and the do-not-show list.
> Every number below is traceable: SRPN-v1 values come from the committed snapshots (README "Verified results", CLIMATE_DATA.md §4), transactions come from DEPLOYMENT.md "Demo campaigns", and the FEWS NET wording comes from CLIMATE_DATA.md §3.3.
> Narration runs at about 150 words per minute: 4:15 is roughly 600 spoken words. The person who records it should speak plainly, in their own voice.

## Facts the narration relies on (do not change without re-checking)

| Fact | Value | Source |
|---|---|---|
| Location | Yabelo, Borena Zone, Oromia, Ethiopia. ERA5 grid cell 5.0° N, 38.0° E | snapshots, `/explore` |
| OND 2021 | 78.7 mm, **33.63 %** of the 1991–2020 normal (3363 bps) | golden test, `/verify/1` |
| OND 2023 | 498.9 mm, **213.22 %** (21322 bps) | golden test, `/verify/2` |
| Normal | 234.0 mm (1991–2020 OND mean) | snapshots |
| Threshold | ≤ 60 % of normal, **illustrative** | spec, contract |
| FEWS NET, Dec 2021 | deyr/hagaya rainfall "45–75 percent of average" in southern pastoral areas | CLIMATE_DATA.md §3.3 |
| Campaign #1 | Released 0.001 test ETH, tx `0xd5e77248…d95c` | DEPLOYMENT.md |
| Campaign #2 | Refunded, rule not met, tx `0xb5d6d551…b019` | DEPLOYMENT.md |
| Upstream revision | Open-Meteo revised ERA5 after our 19 Oct snapshot; live OND 2021 = 3362 bps, same decision | CLIMATE_DATA.md §2.4 |

## Script

| Time | Section | Narration (spoken) | On-screen caption (burned in) |
|---|---|---|---|
| 0:00–0:22 | **Hook** | "In late 2021 the short rains failed across southern Ethiopia. FEWS NET reported 45 to 75 percent of average in the pastoral south, including Borena. When a fund promises money if the rains fail, outsiders can rarely check three things: which data was used, how the number was computed, and who decided." | *Yabelo, Borena · OND 2021 · FEWS NET: 45–75 % of average* |
| 0:22–0:52 | **The solution** | "Rilva makes that chain checkable. A public rule is hashed on-chain before any money moves. The rainfall index is computed the same way every time, from public ERA5 data. A named attestor signs the result. A contract applies the rule and pays once. And anyone can verify every step from a browser, with no wallet." | *Rule → evidence → signed attestation → contract → public verification* |
| 0:52–1:40 | **Real climate evidence** | "This is the climate explorer. It shows thirty-three October-to-December seasons for one ERA5 grid cell over Yabelo, against the 1991–2020 normal of 234 millimetres. OND 2021 brought 78.7 millimetres: 33.63 percent of normal. The 60 percent line is an illustrative rule, not an official drought threshold. The app also shows where datasets disagree. CHIRPS puts this season at 52.5 percent, so the source is part of the rule and is fixed before funding. Press recompute, and your browser rebuilds the index and the evidence hash from the saved ERA5 files. Same inputs, same number, same hash." | *Retrospective replay · ERA5 via Open-Meteo · 60 % is illustrative* |
| 1:40–2:35 | **Blockchain execution** | "Here is a real campaign on Base Sepolia, a public testnet. A funder locked test ETH. The beneficiary and the attestor were fixed at creation, along with the season, the data source and the threshold, all hashed into the spec. The attestor recomputed the evidence, reviewed every field of an EIP-712 message, and signed it in their own wallet. The contract checked the signer, the spec and the period. It compared 3363 basis points with the 6000 threshold itself, and released the funds to the fixed beneficiary, once. Every step in the audit trail links to its public transaction on the block explorer." | *Base Sepolia testnet · test ETH only · tx 0xd5e7…d95c* |
| 2:35–3:15 | **Public verification** | "Now the part that matters most. A stranger opens the public report. There's no wallet and no account. The browser reads the contract and decodes the signed attestation from the transaction. It recovers the signer, re-downloads the pinned ERA5 files, checks their SHA-256 hashes, and recomputes the index and the evidence hash. Seven checks, and each one says what it proves. It also says what it can't prove: whether ERA5 is accurate at this place, and whether anyone was helped." | *No wallet needed · 7 of 7 checks passed* |
| 3:15–3:45 | **Contrast and security** | "Same rule, wetter year. OND 2023 was 213 percent of normal, so the contract refunded the funder. Nothing went to the beneficiary. And attacks fail. A stranger's signature, a second settlement, or an early refund are each rejected by the deployed contract. These are simulations, so nothing is sent. Our Hardhat suite covers altered numbers and swapped evidence: 79 tests, with full line coverage of the escrow." | *Refunded · rule not met · simulated against the deployed contract (eth_call)* |
| 3:45–4:15 | **Honesty and close** | "One honest finding: while we built this, Open-Meteo revised its ERA5 archive. Today's live value is 33.62 percent, not 33.63. Rilva pins the evidence to hashed files, so verification still holds, and the revision is shown, not hidden. This is a testnet demonstration using historical data. Real use needs more than one attestor, triggers agreed with the people a programme serves, and an audit. What stays the same is a public rule, evidence anyone can recompute, and a contract that enforces it. Rilva. Climate evidence. Verifiable relief." | *rilva-six.vercel.app · github.com/lijnati/Rilva · Testnet only · retrospective replays* |

Approximate spoken length: 600 words (≈ 4:00–4:20 at a calm pace).

## Words that must not be added
Do not add: "insurance", "guaranteed", "real-time", "live alert", "ground truth", "official threshold", "helped / saved / delivered aid", any count of people or livestock, "audited", or "trustless truth" (PRODUCT.md §9).
