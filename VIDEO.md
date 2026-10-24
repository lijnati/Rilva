# VIDEO.md — Rilva demo video (≤ 4:50)

> **2026-10-24:** the timed narration, shot list and capture plan now live in [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md), [STORYBOARD.md](STORYBOARD.md) and [RECORDING_PLAN.md](RECORDING_PLAN.md) and use the real Base Sepolia campaigns #1–#3. This file keeps the three moments and the do-not-show list.

> Devpost requires a 3–5 minute video (PRODUCT.md §10). Target **4:30–4:50**, recorded at 1080p. Built around **three moments**; everything else is setup or close. Every on-screen number must come from the deployed app, a saved snapshot or a cited source — never from this script. Re-read PRODUCT.md §9 (forbidden claims) before recording.

## The three moments

| # | Moment | What the judge should remember | Criteria served |
|---|---|---|---|
| 1 | **The evidence, honestly** | OND 2021 at Yabelo was 33.63 % of normal in ERA5 — and the app shows, unprompted, where CHIRPS disagrees (MAM 2021 meets the rule in one dataset and misses it in the other). | Climate Impact, Innovation |
| 2 | **Money moves only on the rule** | An attestor recomputes, reviews a readable EIP-712 payload, signs; the contract applies the rule itself and releases testnet ETH, visible on Basescan. A wetter season refunds instead. | Technical Execution, Practical Usefulness |
| 3 | **Anyone can check. Nobody can cheat.** | A stranger with no wallet watches seven checks turn green and shares the report; forged, altered and repeated settlements are refused by the contract. | Technical Execution, Presentation |

## Shot list and voice-over

| Time | Screen | Voice-over (plain, no hype) |
|---|---|---|
| 0:00–0:20 | Landing hero (pixel highlands), slow scroll to the one-line problem | "In late 2021 the October–December rains in southern Ethiopia's pastoral areas, including Borena, were well below average — 45 to 75 percent, according to FEWS NET. When a fund promises money if the rains fail, three questions are hard to answer from outside: which data, how it was computed, and who decided." |
| 0:20–0:35 | "See it work. No wallet needed." cards | "Rilva makes the rule, the evidence and the decision public, reproducible and enforced by a contract. Here is the whole path, in four clicks." |
| **0:35–1:35** | **Moment 1** — `/explore`: OND 2021 selected, hero numeral 33.63 %, the 60 % illustrative line, then scroll to "Two datasets. Same seasons. Different answers." Click **Recompute** and wait for "Matches the saved evidence digest." | "This is ERA5 rainfall for one grid cell over Yabelo: 33 short-rain seasons against the 1991–2020 normal. OND 2021 came in at 33.63 percent of normal. Our rule — 60 percent, an illustrative threshold, not an official one — is met. But data sources disagree. In March–May 2021, ERA5 says the rule is met; CHIRPS says it isn't. Rilva shows that instead of hiding it, and uses ERA5 because anyone can re-fetch it and get the same hash. Your browser can recompute it right now." |
| **1:35–2:55** | **Moment 2** — `/campaigns/new` Review step only (rule in plain words, spec hash). Cut to campaign A as the **attestor**: Recompute from ERA5 → the EIP-712 field table → Sign (wallet shows named fields) → Submit → Final outcome "Released" → Basescan tx. Quick cut: campaign B (OND 2023) final outcome "Refunded · rule not met". | "A funder locks testnet ETH to that rule. The spec — place, dataset, season, baseline, threshold — is hashed on-chain before any money moves. The attestor recomputes the evidence in the browser and sees every field they're about to sign, in plain words. The contract checks the signer, the spec and the period, compares the index with the threshold itself, and pays the fixed beneficiary, once. In a wetter season — OND 2023, 213 percent of normal — the same flow refunds the funder." |
| **2:55–4:00** | **Moment 3** — open `/verify/A` in a fresh window with no wallet: checks reveal one by one, each with its kind; click **Copy report link**. Then campaign C → "Try to break it": stranger's signature → InvalidSigner; changed index → InvalidSigner; campaign A "Settle twice" → CampaignNotActive. | "Now anyone — no wallet — can check it. The page reads the chain, decodes the signed attestation, re-fetches the rainfall and recomputes every hash. Each check says what it proves, and the page says what it can't: whether the estimate is accurate, or whether anyone was helped. Share the link and the next person re-runs it all. And if someone tries to cheat — a stranger's signature, a changed number, settling twice — the contract refuses. Nothing is sent; these are simulations against the deployed contract." |
| 4:00–4:35 | "From replay to real use" (landing, dark panel) | "This is a testnet demonstration with historical replays. To be used for real, it needs more than one attestor, triggers calibrated with the people a programme serves, more places and seasons, and an audit before any pilot. What stays the same: a public rule, evidence anyone can recompute, and a contract that enforces it." |
| 4:35–4:50 | Landing closing band + URL + repo | "Rilva. Climate evidence. Verifiable relief." (on screen: live URL, GitHub repo, "Testnet only · retrospective replays") |

## Do not show
- The "I already have a signed attestation" (paste) path — it works, but it is noise on screen.
- The local-chain banner, the Next.js dev indicator, or any terminal. Record against the **deployed** production build.
- Wallet seed phrases, private keys, keystore prompts or account settings.
- Any impact number (people, livestock, money delivered, losses prevented), "real-time", "insurance", "guaranteed", "ground truth", or "official threshold".

## Before recording (checklist)
- [ ] Contract deployed and verified on Base Sepolia; campaigns created through the UI: **A** OND 2021 (settled → Released), **B** OND 2023 (settled → Refunded, rule not met), **C** OND 2022 (Active, window open for "Try to break it"). For a live attestation in Moment 2, create A shortly before recording and settle it on camera.
- [ ] Vercel production URL loads in a clean browser profile; landing judge cards point at A, B and C.
- [ ] Two wallet profiles ready and labelled (funder, attestor), each with a little Base Sepolia ETH. Never show their keys.
- [ ] Light mode, 1920×1080 window, browser zoom 100 %, bookmarks bar hidden, notifications off.
- [ ] Open-Meteo reachable (otherwise the recompute will honestly say "used the committed snapshot" — acceptable, but say so in the voice-over).
- [ ] `pnpm test` copy audit green; watch the full video once against PRODUCT.md §9 before upload.

## Fallback (ROADMAP §2 #6–7)
- If live creation fails on the day: use pre-created A/B and show only the create form's Review step.
- If Base Sepolia is unusable: record on the local chain and say so on screen ("local development chain").

Sources for spoken facts: FEWS NET East Africa Seasonal Monitor, Dec 2021 — https://fews.net/east-africa/seasonal-monitor/december-2021 (accessed 2026-10-19; quoted in CLIMATE_DATA.md §3.3). All rainfall figures: CLIMATE_DATA.md §3.2/§4 and the app.
