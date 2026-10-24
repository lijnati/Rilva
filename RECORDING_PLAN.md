# RECORDING_PLAN.md — how the demo video is captured and assembled

## Inputs (all verified 2026-10-24)

| Item | Value |
|---|---|
| App | https://rilva.xylolabs.space (production build of `main`) |
| Released campaign | `/campaigns/1`, `/verify/1` — OND 2021, settle tx [`0xd5e77248…d95c`](https://sepolia.basescan.org/tx/0xd5e77248c989878540c6c082b2b6c877c4aa5fb3c38eba3bc6c8f5d0e807d95c) |
| Refunded campaign | `/campaigns/2`, `/verify/2` — OND 2023, settle tx [`0xb5d6d551…b019`](https://sepolia.basescan.org/tx/0xb5d6d551bfc49b13a211fe5bdad028a153c75f916ccc47e50e1c4f0f62bab019) |
| Active campaign | `/campaigns/3` — OND 2022, open until 2026-11-23 04:47 UTC; "Try to break it" target |
| Contract | [`0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E`](https://sepolia.basescan.org/address/0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E) |

## Wallet-independent by design
- Every shot is read-only: no wallet, no transaction, no signature during recording. The attestation and settlement happened for real on 2026-10-24 and are shown as recorded results (campaign page, audit trail, verification report). They are never re-enacted.
- "Try to break it" uses `eth_call` simulations against the deployed contract. Nothing is broadcast.
- If the public RPC (`sepolia.base.org`) is rate-limited during capture, wait and re-take the shot. Never use footage that shows an error state as if it were success.

## Capture (screen footage)
1. Automated capture with Playwright and Chromium's CDP screencast (`Page.startScreencast`, JPEG quality 92). Viewport 1536×864 at device scale 1.25 gives 1920×1080 frames, so text renders at 125 %. Each clip uses a light colour scheme and a fresh context with no extensions or wallet. Frames carry their real timestamps, and ffmpeg's concat demuxer turns them into a constant 30 fps clip with the true timing. Each storyboard shot is its own clip. The scripts and raw frames live outside the repo (scratchpad).
2. Block explorers are not filmed. On 2026-10-24 Basescan served a bot check, which we did not attempt to bypass. Blockscout rendered the transaction with a third-party ad banner and the wallet's delegation wrapper call. Shot 9 therefore holds on the app's audit trail, with the tx hash in the caption.
3. Title and end cards are small HTML pages in the app's pixel-meadow style (DM Sans + Instrument Serif accent, paper/ink tokens), rendered by the same Chromium.

## Narration (human)
- The founder records VIDEO_SCRIPT.md in one take per section (7 files), in a quiet room, with the phone or headset close to the mouth.
- Save as WAV or high-bitrate M4A/MP3, named `vo-1-hook.wav` … `vo-7-close.wav`.
- Leave about 0.5 s of silence before and after each section. Re-record any section that runs more than 10 % over its slot.

## Assembly
- Portable ffmpeg (static build, kept in the scratchpad, not a repo dependency).
- Each clip is trimmed or slowed to its narration length (max 1.15× slow-down; otherwise hold the last frame).
- Captions are burned in from an SRT built from VIDEO_SCRIPT.md. Audio is loudness-normalised to −16 LUFS. There is no music.
- Export: H.264 High, 1920×1080, 30 fps, AAC 192 kbps, `rilva-demo.mp4`.

## QA before upload (must all pass)
- [ ] `ffprobe` duration between 3:00 and 5:00 (target 4:15).
- [ ] Frames sampled every 10 s: all text readable at 1080p, and hashes and URLs match DEPLOYMENT.md.
- [ ] No wallet, keys, email, notifications, or personal tabs anywhere.
- [ ] Every number spoken equals the on-screen number.
- [ ] Watched once end to end by a human.

## Upload
- YouTube, visibility **Public** or **Unlisted** (both embed on Devpost). Title: "Rilva — Climate evidence. Verifiable relief. (IEEE ClimateChain 2026 demo)".
- After upload, open the link in a private window to confirm it plays signed-out. Then paste it into Devpost "Video demo link" and README.
