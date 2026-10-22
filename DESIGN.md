# DESIGN.md — Rilva design direction

> Phase 0 decisions, **revised in Phase 3 (2026-10-22)** when the UI was built with the `pixel-meadow-ui` design skill (mandated by the human). Where pixel-meadow and the Phase 0 rules conflicted, the human chose: pixel-meadow "Paper" mode everywhere, pixel art only inside inset art frames, pills for every control, glass only on the nav over art; Rilva's data/state colours and required copy are kept unchanged. Contrast ratios for the Phase 0 tokens were computed with the WCAG 2.x formula on 2026-10-19; the Phase 3 paper/ink tokens come from the skill and were checked visually, not re-computed (**UNVERIFIED** exact ratios for `--ink-2`/`--ink-3` on `--paper`).

## 1. Brand

- **Name:** Rilva. **Tagline:** *Climate evidence. Verifiable relief.*
- **Personality:** warm, quiet confidence. A calm, exact research instrument (climate-science publication × audit statement) framed by 16-bit pixel landscapes of the Ethiopian highlands. The art does the emotional work; type and UI stay restrained and precise. It is not a crypto dashboard.
- **Voice:**
  - Plain and precise. Numbers always carry units and a source.
  - Headlines are two short parallel sentences ("Public rules. Checkable evidence."), at most one italic serif word.
  - Hedges are explicit ("estimate", "replay", "illustrative") and never marketing. No exclamation marks.
  - The UI never says "AI-powered", "revolutionary", "real-time", "seamless" or "guaranteed".
- **Wordmark:** lowercase "rilva", DM Sans 650, −0.04em, next to a round mark: a raindrop resting on a ledger rule (rain-gauge reading / audit line). Butter mark on art, accent mark on paper. `components/site/Brand.tsx`.

## 2. Anti-patterns (explicitly banned)

- Full-bleed art, or art outside an inset rounded frame. Pixel art is never blurred or smoothed (`image-rendering: pixelated`).
- Gradient/mesh hero backgrounds, glowing orbs, 3D blobs and globes, "web3" purple, neon.
- Glassmorphism anywhere except the nav over the art (the desktop link pill and the mobile menu sheet).
- Stat tiles with invented numbers ("10k+ farmers"), fake logos, testimonials or partnerships.
- More than one status pill per object. Pills are for *controls*; status uses one chip with an icon and a word.
- Dashboard noise: six charts on one screen, sparklines without axes, decorative charts. Every chart shows real data with a source line.
- Emoji in the UI. Display weights ≥ 700 (they go chunky against pixel art). Pure black text.
- Frontend-only financial states. Campaign status mirrors the contract enum (Active / Released / Refunded) only.

## 3. Color tokens (`app/globals.css`, Tailwind v4 `@theme`, light + dark)

| Token | Role | Light | Dark |
|---|---|---|---|
| `--paper` | Page background | `#F7F9F5` | `#0F1512` |
| `--paper-deep` | Tracks, quiet panels | `#EAF0E8` | `#18211C` |
| `--surface` | Cards | `#FFFFFF` | `#161F1A` |
| `--ink` | Primary text (deep green, never black) | `#183D32` | `#E6EEE8` |
| `--ink-2` / `--ink-3` | Secondary text / captions, axis labels | `#4C6158` / `#5C7067` | `#B3C2B9` / `#93A59B` |
| `--rule` / `--rule-strong` | Hairlines / control outlines | `#DCE4DA` / `#BDCABE` | `#26332C` / `#3A4A41` |
| `--accent` | Links, focus glow, selected cards | `#21634E` | `#8FD0B2` |
| `--butter` | **Primary action only** (one per view) | `#FFE46B` on `#313712` | same |
| `--mint` / `--cream` / `--ice` | Pastel card fills only, in that order | `#E8F1E5` / `#FCF0C9` / `#E7F0F6` | muted dark variants |
| `--deficit` | **Below-normal rainfall** (data) | `#A8471F` | `#E38B5F` |
| `--normal` | **The normal / at-or-above** (data) | `#2C6A6E` | `#72B6B8` |
| `--baseline` | Baseline-year bars (non-text) | `#8F8A7E` | `#6E7277` |
| `--ok` / `--fail` / `--warn` (+ `-soft`) | Check passed / failed / replay or uncertainty | `#2F6B45` / `#A2322A` / `#8A5A0B` | `#79C08F` / `#EE8A80` / `#E0B25A` |

Rules (unchanged from Phase 0):
- **Data colour ≠ state colour.** Ochre and teal describe rainfall; green and red describe verification. Never green for "wet" or red for "dry".
- State is always carried by an icon **and** a word (`Passed` / `Failed` / `Checking` / `Not applicable` / `Could not check`), never colour alone.
- Art frames keep their scene in dark mode; only the haze overlay darkens.

## 4. Typography, spacing, shape, motion

- **DM Sans** 500–650 for display and headings (`.display`, `.h2`, `.h3`), tracking −0.03 to −0.04em. **Instrument Serif italic** for at most one accent word per headline. **Geist Sans** for UI and body. **Geist Mono** for hashes, addresses, tx ids, spec JSON and `.meta` labels. All via `next/font`.
- Numerals: `tabular-nums` (`.tnum`) in tables, charts and amounts.

| Use | Size / line-height | Weight |
|---|---|---|
| Landing display | `clamp(38px, 4.6vw, 68px)` / 1.08 | 650 |
| Page-banner display | `clamp(34px, 4.6vw, 60px)` / 1.08 | 650 |
| H2 | `clamp(30px, 3.6vw, 47px)` / 1.12 | 600 |
| H3 | 21 / 1.3 | 600 |
| Hero numeral | 64–80 (decimals at .45em) | 600, `--deficit` or `--normal` by outcome |
| Body | 15 / 1.6–1.8 | 400 |
| Meta / labels | Geist Mono 10.5 uppercase, +0.04em | 500 |
| Eyebrow | 12 uppercase, +0.28em | 500 |

- **Layout:** 1160 px container (16 px side gutter < 640 px), 90 px section rhythm (64 px mobile), head rows with H2 left and a ≤ 46ch paragraph right. Grid tracks use `minmax(0, …)` so wide charts scroll inside their card, never the page.
- **Shape:** every control is a pill (999 px); cards 14 px; panels/art frames 18 px (12 px mobile), inset 20 px (10 px mobile) from the page edge. Hairline rings instead of grey shadows; one soft tinted shadow for raised cards.
- **Motion:** `cubic-bezier(.22,1,.36,1)`; blur-to-sharp `.reveal` (1.1 s), CSS split-word hero, nav fade-down, verification checks reveal with a 60 ms stagger. No bounce or spin, no scroll hijacking. `prefers-reduced-motion` disables all of it; the scene still renders (static art). `<noscript>` shows all revealed content.
- **Focus:** 2 px `--ink` outline, 2 px offset (white over art); inputs add a 4 px accent glow.

### 4a. Pixel-meadow implementation (Phase 3)
- `public/vendor/pixel-scene.js` is the skill's generator, vendored verbatim; `components/site/PixelScene.tsx` loads it once and mounts StrictMode-safely.
- Preset **`highland`** (table mountains, acacias, round huts, golden grass) for every frame, because the case study is southern Ethiopia. Seeds differ per instance (landing 11/4/23, explore 41, campaigns 57, new 73, detail 88, verify 101 with a dawn sky, methodology 131). The closing band uses a violet-dusk sky.
- Page banners add a left-weighted haze so copy stays readable over hills (strengthen haze, never shrink type). 1–2 pixel birds on the landing hero only, hidden on mobile.

## 5. Information architecture

| Route | Purpose | Key content |
|---|---|---|
| `/` | Landing | Headline, a one-paragraph problem statement, a 4-step "how it works" (Spec → Evidence → Attestation → Settlement), a real OND chart preview, a trust-model summary, links to the explorer and the live demo campaigns, and limitations in a footer section |
| `/explore` | Climate explorer | Static locator map (Ethiopia, Borena, ERA5 cell square, CHIRPS cell), replay season tabs (OND 2021–2023; no MAM toggle — MAM 2021 appears only as the documented counter-example in the ERA5 vs CHIRPS comparison), 1991–2023 bar chart, a year detail panel (ERA5 total, % of normal, z, CHIRPS v3 %), and a "Why sources disagree" note |
| `/campaigns` | List | Campaigns read from the chain: status, period, amount, outcome |
| `/campaigns/new` | Create and fund | Stepped form → spec preview (mono JSON, hash) → review → fund (wallet) |
| `/campaigns/[id]` | Status + evidence + attest/settle + refund + "Try to break it" | Role-aware: the connected wallet's role (funder / attestor / beneficiary / visitor) changes which actions are shown |
| `/verify/[id]` | Public verification | Checklist, evidence table, tx timeline with Basescan links. No wallet needed. |
| `/methodology` | Formula, data sources, limitations, trust model | Text and tables mirroring CLIMATE_DATA.md §4 and §7, with source links |

Navigation (implemented): wordmark · Explore · Campaigns · Methodology, then the network badge ("Base Sepolia · testnet" or "Local Hardhat chain · development only") and the wallet control. Verify pages are reached from each campaign (and by id), since they need an id. Below 1024 px the links collapse into a Menu sheet.

## 6. Components (meaningful only)

> Phase 3: implemented under `components/` (site, climate, chain, campaign, verify, ui). Differences from the Phase 0 sketch are noted inline.

- **ReplayBanner:**
  - A rounded `--warn-soft` note with a clock icon: "Retrospective replay of OND 2021. Not a live drought alert. Testnet funds only."
  - It appears on every campaign, evidence and verify view whose spec has `replay: true`, and it cannot be dismissed.
- **SeasonChart:**
  - Vertical bars, one per year 1991–2023. Baseline years use `--baseline`.
  - Seasons after the baseline are outlined. The selected year is filled `--deficit` if below normal, otherwise `--normal`.
  - The 100 % normal line is a solid `--normal` hairline and the threshold line is dashed `--deficit`; both are labelled in the legend row ("1991–2020 normal · 234.0 mm", "60 % of normal · illustrative threshold") because inline labels collided with bars. Lines draw above bars.
  - The y-axis is in mm. Source caption: "ERA5 via Open-Meteo (CC BY 4.0) · Copernicus C3S". Keyboard focusable bars with a tooltip showing year, mm, % of normal and CHIRPS %. A table fallback is available.
- **LocatorMap:** a static SVG of Ethiopia's admin-0 outline (Natural Earth, public domain). It shows a point for Yabelo, a 0.25° square for the ERA5 cell, and a 0.05° square for the CHIRPS cell, with a scale bar. It is not interactive in the MVP.
- **EvidencePanel:**
  - Hero numeral (% of normal) with an outcome line ("At or below 60 % → condition met").
  - Inputs table: period, days 92/92, baseline seasons 30/30, model, resolved grid.
  - Computation table: T, S, N, the formula, and indexBps.
  - `HashField` for the spec hash and evidence hash.
  - Cross-check row (CHIRPS v3).
  - "Download evidence JSON".
- **HashField:** Geist Mono with a middle-truncated value (`0x3f2a…9c1e`), a copy button, and a full value in a tooltip. Hashes being compared are shown side by side, with a match/mismatch icon and word.
- **VerificationChecklist** (`components/verify/VerifyReport.tsx`, logic in `lib/app/verifyChecks.ts`): seven ordered checks (ARCHITECTURE.md §4.3). Each shows Checking → Passed / Failed / Not applicable / Could not check, its **kind** (cryptographically authentic · data reproducible · attested by an authorised party · contract conditions satisfied), a one-line reason and a "how to check this yourself" disclosure. A "Not checked, and not claimed" box follows. Pending work is never shown as an error or a pass.
- **AuditTimeline:** a vertical rule with nodes for Created → Attested (signer) → Settled (Released / NotTriggered) → Refunded. Each node shows the time, the actor's address (mono), and a Basescan link.
- **AttestationReview:** shown to the attestor before signing. It lists every EIP-712 field in plain words next to its raw value, plus the locally recomputed hash and the predicted outcome. The button reads "Sign attestation".
- **BreakItPanel** (was RejectionCard): "Try to break it", five scenarios — stranger's signature, modified index, modified evidence hash, duplicate settlement, premature timeout refund. Each runs `eth_call` against the deployed contract (labelled "no transaction sent") and shows the decoded custom error with a one-sentence reason; a second tab lists the matching Hardhat tests ("local contract-test reproduction"). Expected rejections use `--ok-soft` (the guarantee held); anything unexpected is shown honestly. No alarmist visuals.
- **States:** every async element needs an empty, loading (skeleton matching the final layout), error (with retry and a cause, e.g. "Open-Meteo unreachable. Using committed fixture."), and success state. Wallet states: not connected, wrong network (with a one-click switch), insufficient funds, tx pending (with hash link), confirmed, failed.

## 7. Required copy and disclosures

- On the evidence and verify pages: "Rainfall estimate from ERA5 reanalysis (a model, not a rain gauge) for one ~28 km grid cell. It does not measure drought impact or financial loss."
- Next to any threshold: "60 % of normal is an illustrative hackathon rule, not an official drought definition."
- On the trust model: "The attestor is trusted to sign honestly; Rilva makes every attestation checkable, not automatically true."
- Footer: "Testnet demonstration. No real funds, no insurance, no relief delivered." Followed by the data attributions.
- On the explorer: "ERA5 and CHIRPS v3 disagree for some seasons (e.g. MAM 2021: 55 % vs 101 % of normal). Rilva shows both and uses ERA5 for the rule."

## 8. Responsive behaviour

- Breakpoints: 640, 1024, 1280. Every page works at 360 px wide with no horizontal scroll.
- On mobile the 7/5 grid stacks: evidence comes before narrative on evidence pages and after narrative on the landing page.
- The chart scrolls horizontally inside its own card on mobile, starting at the most recent (replay) seasons, with a "← Scroll for earlier seasons" hint. The table alternative lists all 33 seasons.
- Nav links collapse into a Menu sheet below 1024 px. Verified by Playwright: no horizontal scroll at 360 and 390 px on every route (`tests/e2e/responsive.spec.ts`).

## 9. Accessibility

- WCAG 2.2 AA. Text ≥ 4.5:1 (tokens above comply) and non-text marks ≥ 3:1.
- Visible focus ring: a 2 px `--ink` outline with 2 px offset.
- Every chart has an accessible table alternative and an `aria-describedby` summary ("OND 2021: 78.7 mm, 33.6 % of normal").
- Errors are announced through a polite `aria-live` region.

## 10. UI review protocol

See CLAUDE.md. Each page is screenshot-reviewed in the browser at 1440 px and 390 px, in light and dark mode, against this document before it is marked done.
