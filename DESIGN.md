# DESIGN.md — Rilva design direction

> Phase 0. No UI is implemented yet. All items are **Decisions**. Contrast ratios below were computed with the WCAG 2.x relative-luminance formula on 2026-10-19.

## 1. Brand

- **Name:** Rilva. **Tagline:** *Climate evidence. Verifiable relief.*
- **Personality:** a calm, exact, editorial research instrument. It should feel like a climate-science publication merged with a financial audit statement, not a crypto dashboard.
- **Voice:**
  - Plain and precise. Numbers always carry units and a source.
  - Hedges are explicit ("estimate", "replay", "illustrative") and never marketing.
  - The UI never says "AI-powered", "revolutionary", "real-time", or "guaranteed".
- **Wordmark:** "Rilva" set in Geist Sans 600 with −0.02em tracking. An optional mark is a single horizontal hairline with a short drop: a rain gauge reading or a ledger rule. This is a Phase 2 nice-to-have. A text-only wordmark is fine.

## 2. Anti-patterns (explicitly banned)

- Gradient hero backgrounds, glowing orbs, or 3D blobs and globes.
- Glassmorphism, neon, and "web3" purple.
- Stat tiles with invented numbers ("10k+ farmers"), and fake logos or testimonials.
- Pill or badge overload. Use at most one status pill per object.
- Dashboard noise such as six charts on one screen, or sparklines without axes.
- Emoji in the UI.
- Decorative charts. Every chart shows real data with a source line.

## 3. Color tokens

These go in `:root` and `[data-theme="dark"]`, as Tailwind v4 `@theme` variables.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--paper` | Page background (warm off-white / near-black) | `#F6F4EE` | `#0E1012` |
| `--surface` | Cards, panels | `#FFFFFF` | `#16191C` |
| `--ink` | Primary text | `#15171A` (16.3:1 on paper) | `#ECE9E2` (15.7:1) |
| `--ink-2` | Secondary text | `#4B5058` (7.4:1) | `#B4B0A7` (8.8:1) |
| `--ink-3` | Captions, axis labels (min 4.5:1) | `#6B7078` (4.5:1) | `#8C8981` (5.5:1) |
| `--rule` | Hairlines, gridlines | `#E2DED4` | `#2A2E33` |
| `--deficit` | **Below-normal rainfall** (data) | `#A8471F` burnt ochre (5.3:1) | `#E38B5F` (7.4:1) |
| `--normal` | **The normal / at-or-above** (data) | `#2C6A6E` deep teal (5.6:1) | `#72B6B8` (8.3:1) |
| `--baseline` | Baseline-year bars (non-text, ≥3:1) | `#8F8A7E` (3.1:1) | `#6E7277` (3.9:1) |
| `--ok` | Check passed | `#2F6B45` | `#79C08F` |
| `--fail` | Check failed / rejected | `#A2322A` | `#EE8A80` |
| `--warn` | Replay / uncertainty notice | `#8A5A0B` | `#E0B25A` |

Rules:
- **Data color ≠ state color.** Ochre and teal describe rainfall. Green and red describe verification. Never use green for "wet" or red for "dry".
- Ochre against teal is a blue–orange pair, which is safe for common colour-vision deficiencies. Status is also carried by an icon and a word (`Passed` / `Rejected`), never by colour alone.
- The only accent is the data. Buttons are ink-on-paper: primary = `--ink` background with `--paper` text; secondary = outlined with `--rule`.

## 4. Typography and spacing

- **Geist Sans** for all text. **Geist Mono** for hashes, addresses, tx IDs, spec JSON, and tabular numbers in evidence tables. Load both via the `geist` package or `next/font`.
- Numerals: `font-variant-numeric: tabular-nums` in tables, charts and amounts.

**Type scale (px / line-height / weight):**

| Use | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Display | 56/60 (mobile 40/44) | 600 | −0.025em |
| H1 | 40/44 | 600 | |
| H2 | 28/34 | 600 | |
| H3 | 20/28 | 600 | |
| Body | 16/26 | 400 | |
| Small | 14/22 | | |
| Caption | 12/18, uppercase only for overlines | | +0.06em |

- Readable measure: 64–72ch for prose.
- **Hero numeral** (the evidence page's key number, e.g. "33.6 % of normal"): Geist Sans 600, 96/96 on desktop and 64 on mobile, `--deficit` or `--normal` by outcome, with a caption beneath giving the source and period.
- **Spacing:** a 4 px base. Use the scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Sections are separated by 96–128 px on desktop and 64 px on mobile.
- **Grid:** 12 columns, max width 1200 px, 24 px gutters on desktop and a 16 px side gutter on mobile. Editorial pages use a 7/5 split: narrative on the left, evidence on the right.
- **Radius:** 6 px for controls and 10 px for cards. Hairline borders (1 px `--rule`) instead of shadows. One soft shadow is reserved for overlays.
- **Motion:**
  - 150–200 ms ease-out for state changes.
  - Checklist items reveal sequentially (60 ms stagger) when verification runs.
  - No looping animation. Respect `prefers-reduced-motion`.

## 5. Information architecture

| Route | Purpose | Key content |
|---|---|---|
| `/` | Landing | Headline, a one-paragraph problem statement, a 4-step "how it works" (Spec → Evidence → Attestation → Settlement), a real OND chart preview, a trust-model summary, links to the explorer and the live demo campaigns, and limitations in a footer section |
| `/explore` | Climate explorer | Static locator map (Ethiopia, Borena, ERA5 cell square, CHIRPS cell), season toggle (OND / MAM), 1991–2023 bar chart, a year detail panel (ERA5 total, % of normal, z, CHIRPS v3 %), and a "Why sources disagree" note |
| `/campaigns` | List | Campaigns read from the chain: status, period, amount, outcome |
| `/campaigns/new` | Create and fund | Stepped form → spec preview (mono JSON, hash) → review → fund (wallet) |
| `/campaigns/[id]` | Status + evidence + attest/settle + refund + "Try to break it" | Role-aware: the connected wallet's role (funder / attestor / beneficiary / visitor) changes which actions are shown |
| `/verify/[id]` | Public verification | Checklist, evidence table, tx timeline with Basescan links. No wallet needed. |
| `/methodology` | Formula, data sources, limitations, trust model | Text and tables mirroring CLIMATE_DATA.md §4 and §7, with source links |

Navigation: wordmark · Explore · Campaigns · Methodology · Verify, plus `Connect wallet` on the right. A persistent **network badge** reads "Base Sepolia · testnet".

## 6. Components (meaningful only)

- **ReplayBanner:**
  - A full-width thin bar in `--warn`: "Retrospective replay of OND 2021. Not a live drought alert. Testnet funds only."
  - It appears on every campaign, evidence and verify view whose spec has `replay: true`, and it cannot be dismissed.
- **SeasonChart:**
  - Vertical bars, one per year 1991–2023. Baseline years use `--baseline`.
  - Seasons after the baseline are outlined. The selected year is filled `--deficit` if below normal, otherwise `--normal`.
  - The 100 % normal line is a solid `--normal` hairline, labelled "1991–2020 normal · 234.0 mm".
  - The threshold line is dashed `--deficit`, labelled "60 % — illustrative threshold".
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
- **VerificationChecklist:** an ordered list of checks (see ARCHITECTURE.md §4.3). Each check shows pending (spinner) → passed or failed, with a one-line reason and a "how to check yourself" disclosure.
- **AuditTimeline:** a vertical rule with nodes for Created → Attested (signer) → Settled (Released / NotTriggered) → Refunded. Each node shows the time, the actor's address (mono), and a Basescan link.
- **AttestationReview:** shown to the attestor before signing. It lists every EIP-712 field in plain words next to its raw value, plus the locally recomputed hash and the predicted outcome. The button reads "Sign attestation".
- **RejectionCard:** "Try to break it". There are three buttons. Each result shows the attempted action, the contract's answer (decoded custom error), and the reason in one sentence ("The signature does not come from this campaign's attestor."). Styled with `--fail` and an icon. No alarmist visuals.
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
- The chart scrolls horizontally inside its own container on mobile with fixed y-axis labels, or reduces to 2001–2023 with a toggle for all years.

## 9. Accessibility

- WCAG 2.2 AA. Text ≥ 4.5:1 (tokens above comply) and non-text marks ≥ 3:1.
- Visible focus ring: a 2 px `--ink` outline with 2 px offset.
- Every chart has an accessible table alternative and an `aria-describedby` summary ("OND 2021: 78.7 mm, 33.6 % of normal").
- Errors are announced through a polite `aria-live` region.

## 10. UI review protocol

See CLAUDE.md. Each page is screenshot-reviewed in the browser at 1440 px and 390 px, in light and dark mode, against this document before it is marked done.
