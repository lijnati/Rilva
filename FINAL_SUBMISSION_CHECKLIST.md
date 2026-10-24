# FINAL_SUBMISSION_CHECKLIST.md

Official deadline **Sun 2026-10-25 17:00 EAT** (Devpost form: "Oct 25, 2026 @ 5:00pm GMT+3"). Internal target: **12:00 EAT**.
Legend: ✅ done and verified · ⏳ in progress · 👤 human action.

## Product and evidence
- ✅ Production app https://rilva.xylolabs.space serves the build of `main` (Vercel READY). 7 routes have no horizontal overflow at 1440/390/360 px, light and dark, with no page errors (2026-10-24).
- ✅ `RilvaEscrow` `0x8c27…DB0E` has bytecode on Base Sepolia.
- ✅ Campaign #1 Released, #2 Refunded (rule not met), #3 Active. Receipts have status `0x1` (DEPLOYMENT.md).
- ✅ `/verify/1` and `/verify/2`: every applicable check passed in a no-wallet browser; `/verify/3`: 2/2 applicable.
- ✅ Try to break it on production: `InvalidSigner`, `SettlementWindowOpen` and `CampaignNotActive` all reproduced.
- ✅ Upstream ERA5 revision found, documented (CLIMATE_DATA.md §2.4), and handled by snapshot pinning.
- ⬜ Optional: Basescan/Blockscout source verification (`pnpm contracts:verify:base-sepolia`). Needs an Etherscan key; Blockscout needs none.

## Quality gates (2026-10-24)
- ✅ lint, typecheck, Vitest 238/238, `climate:verify all` ALL CHECKS PASSED, build.
- ✅ Hardhat 79 passing; `RilvaEscrow.sol` 100 % lines.
- ✅ Playwright e2e: journeys, misconfigured and responsive specs, 18 passed. The local-chain journeys (`chain.spec.ts`) are skipped without `pnpm chain:node`. One earlier failure came from a stale second `next dev` server, not from the app.

## Repository
- ✅ https://github.com/lijnati/Rilva is **public** (anonymous HTTP 200).
- ✅ Secret audit of tracked files and full history: no keys, mnemonics or `.env` files ever committed. Every 64-hex value is a digest, hash or constant.
- ✅ MIT licence; data attribution in README and app footer.
- ✅ README, JUDGE_GUIDE, JUDGING_STRATEGY, DEVPOST_SUBMISSION, VIDEO_SCRIPT, STORYBOARD, RECORDING_PLAN.
- 👤 Optional: set the repo description and website (`gh repo edit --description … --homepage https://rilva.xylolabs.space`).

## Video
- ✅ Silent picture lock: 4:15, 1920×1080, H.264 at 30 fps, captions burned in, real production footage only. QA'd with a frame every 10 s.
- 👤 Record narration from VIDEO_SCRIPT.md (7 short takes).
- ⏳ Mux, captions, export 1080p MP4, QA (3–5 min, readable, no private data).
- 👤 Upload to YouTube (Public or Unlisted) and confirm it plays signed-out.
- ⬜ Paste the URL into README, DEVPOST_SUBMISSION.md and the Devpost form.

## Devpost (draft 1238428)
- ✅ Form fields read: name (60), pitch (200), thumbnail 3:2, About (Markdown), Built with (≤ 25), Try-it links, gallery (≤ 15, 3:2, 5 MB), video (YouTube/Vimeo, required), additional file (required, ≤ 35 MB). No track dropdown.
- ✅ Copy ready in DEVPOST_SUBMISSION.md; images in `docs/media/`.
- ✅ Judge-pack zip (JUDGE_GUIDE.pdf + README.pdf, 2.7 MB) for "Upload a File" (scratchpad `pack/rilva-judge-pack.zip`).
- ⬜ Fill the draft and preview (after the video URL exists).
- 👤 **Final approval, then Submit.** Then confirm the status and project URL.

## Eligibility
- ✅ Confirmed by the participant (2026-10-24). The rules list open categories, including independent developers. Team or individual is set in "Manage team" (step already done).
