# STORYBOARD.md — shot list for the 4:15 demo

All footage is a real screen recording of the **deployed** app (https://rilva.xylolabs.space) or of Basescan. Nothing is mocked. Format: 1920×1080, 30 fps, light mode, 100 % zoom, no browser chrome (Playwright capture), no wallet extension visible. Timings match VIDEO_SCRIPT.md.

Transitions are hard cuts or 300 ms crossfades. There are no wipes or zoom-blurs. Zooms are slow 1.0 → 1.25 pushes on a static frame, used only where text must be read.

| # | Time | Screen / URL | Action on screen | Zoom / emphasis | Transition in |
|---|---|---|---|---|---|
| 1 | 0:00–0:08 | Title card (HTML, pixel-meadow style) | "Rilva" wordmark, "Climate evidence. Verifiable relief.", then "Yabelo, Borena · OND 2021" | none | fade from black |
| 2 | 0:08–0:22 | `/` landing hero | Hold on the pixel highlands hero, then a slow scroll to the problem line | none | crossfade |
| 3 | 0:22–0:52 | `/` "How it works" / judge cards | Scroll through the rule → evidence → attestation → contract → verify sequence | none | cut |
| 4 | 0:52–1:15 | `/explore` | OND 2021 selected: chart with 33 seasons, 60 % line, 33.63 % numeral | push-in on the numeral and the threshold label | cut |
| 5 | 1:15–1:28 | `/explore`, ERA5 vs CHIRPS section | Scroll to "Two datasets…" (CHIRPS 52.5 %) | none | cut |
| 6 | 1:28–1:40 | `/explore`, Recompute box | Click **Recompute** → "Matches the saved evidence digest." + "Upstream revised" note | push-in on the ✓ line | cut |
| 7 | 1:40–2:05 | `/campaigns/1` | Status **Released to beneficiary**; plain-language rule sentence; roles panel (funder, beneficiary fixed, attestor), spec hash | push-in on the roles panel | cut |
| 8 | 2:05–2:22 | `/campaigns/1` audit trail | Created and funded → Settled → Released, with block numbers | none | cut |
| 9 | 2:22–2:35 | `/campaigns/1` audit trail (continued) | Hold on "Settled · rule met → Released" with block 49484594 and the "View transaction ↗" link; caption carries the tx hash | push-in on the settled entry | none |
| 10 | 2:35–3:15 | `/verify/1`, fresh context, no wallet | Checks animate in one by one → "Every applicable check passed"; scroll to "Not checked, and not claimed" | push-in on the check list | cut |
| 11 | 3:15–3:27 | `/verify/2` | **Refunded to funder · rule not met**; 21322 bps; 7/7 checks | none | cut |
| 12 | 3:27–3:45 | `/campaigns/3` → "Try to break it" | Click "Sign with a stranger's key" → rejected (InvalidSigner); "Refund before the deadline" → SettlementWindowOpen. Then `/campaigns/1` "Settle the same campaign twice" → CampaignNotActive | push-in on each rejection line | cut |
| 13 | 3:45–4:02 | `/explore` Recompute "Upstream revised" note, then `/methodology` limitations | Hold on the revision note, then scroll the limitations list | push-in on the note | cut |
| 14 | 4:02–4:15 | End card (HTML) | "Rilva. Climate evidence. Verifiable relief." + URL + repo + "Testnet only · retrospective replays" | none | crossfade, fade to black |

Captions: one line at a time, bottom-centred, 40 px DM Sans on a 70 % ink panel, ≤ 64 characters. The text comes from the "On-screen caption" column of VIDEO_SCRIPT.md, plus short subtitles of the narration once it is recorded.

Block-explorer pages are **not** filmed (decision 2026-10-24). Basescan served a bot check, and Blockscout showed a third-party advertising banner plus the wallet's `DelegationManager.redeemDelegations` wrapper call, which would confuse viewers. The tx hash is captioned, and judges can open it from JUDGE_GUIDE.md.

Not shown (VIDEO.md "Do not show"): wallet extension windows, seed phrases or keys, terminals, the local-chain banner, the Next.js dev indicator, the Devpost dashboard.
