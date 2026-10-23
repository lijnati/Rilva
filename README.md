# Rilva

**Climate evidence. Verifiable relief.** A hackathon demo (IEEE ClimateChain Global Hackathon, Climate Data & Environmental Monitoring track):
- a reproducible rainfall index from public ERA5 data;
- cryptographic evidence digests;
- in Phase 2, a testnet-only escrow on Base Sepolia.

All scenarios are **retrospective replays**, not live drought alerts. Specs and research: [PRODUCT.md](PRODUCT.md), [CLIMATE_DATA.md](CLIMATE_DATA.md), [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRACTS.md](CONTRACTS.md), [DESIGN.md](DESIGN.md), [ROADMAP.md](ROADMAP.md), [CLAUDE.md](CLAUDE.md).

## Status

**Phase 1 is complete:**
- Next.js foundation.
- SRPN-v1 climate engine.
- Authentic ERA5 snapshots.
- Offline evidence verification.

**Phase 2 is complete, except the Base Sepolia broadcast:**
- `RilvaEscrow` is implemented and tested with Hardhat 3 (CONTRACTS.md).
- The `lib/contracts` integration surface is ready.
- Deployed to **Base Sepolia** (testnet) at `0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E` (DEPLOYMENT.md).

Not yet built: wallet UI flows and the full UI (Phase 3).

## Setup

Requirements: Node ≥ 24 and pnpm 11.13.1 (pinned in `package.json` → `packageManager`).

```bash
pnpm install          # pnpm-workspace.yaml allow-lists build scripts for esbuild + unrs-resolver only
pnpm dev              # http://localhost:3000
```

No environment variables are needed in Phase 1 (see `.env.example`).

## Commands

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint (flat config, `eslint-config-next` core-web-vitals + typescript) |
| `pnpm typecheck` | `tsc --noEmit`, strict + `noUncheckedIndexedAccess` |
| `pnpm test` | Vitest. Offline and deterministic; golden tests read committed snapshots. |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm climate:verify [all\|yabelo-ond-2021\|yabelo-ond-2022\|yabelo-ond-2023] [--live]` | Offline verification of snapshots, SRPN-v1, digests and committed evidence. `--live` also re-fetches from Open-Meteo and checks the digest is identical. |
| `pnpm climate:evidence` | Regenerates `public/evidence/*.json` from the snapshots (offline) |
| `pnpm climate:snapshot` | **Network.** Re-downloads the raw ERA5 responses and rewrites `manifest.json` |
| `pnpm contracts:compile` | Hardhat 3 compile (solc 0.8.37, optimizer off) |
| `pnpm contracts:test` | Hardhat node:test suites in `tests/contracts/` (62 tests, incl. real-evidence integration) |
| `pnpm contracts:gas` / `pnpm contracts:coverage` | Gas statistics / coverage report (`coverage/html`) |
| `pnpm contracts:abi` | Regenerates `lib/contracts/abi.ts` from the artifact |
| `pnpm contracts:deploy:local` | Ignition deployment to the in-process Hardhat network |
| `pnpm contracts:deploy:base-sepolia` | **Broadcasts.** Requires a keystore key and human approval (DEPLOYMENT.md) |

## Pinned versions (exact; no ranges)

| Package | Version | Note |
|---|---|---|
| next | 16.4.2 | |
| react, react-dom | 19.3.1 | |
| typescript | 5.9.3 | Latest 5.x. TypeScript 7 exists but the brief requires 5.x. |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | |
| geist | 1.8.1 | |
| clsx | 2.1.1 | |
| tailwind-merge | 3.7.0 | shadcn/ui `cn()` infrastructure (`components.json`, `lib/utils.ts`) |
| viem | 2.57.7 | keccak256/sha256 now; chain client in Phase 2 |
| eslint | 10.12.0 | ESLint 9 is end-of-life. `eslint-config-next`'s bundled plugins declare peers up to ^9; they run correctly on 10 (verified), but `pnpm install` prints a peer warning. |
| eslint-config-next | 16.4.2 | |
| vitest | 4.1.12 | Mature line; 5.x is very new |
| hardhat | 3.19.0 | With toolbox-viem 5.0.7, hardhat-viem 3.0.10, ignition 3.1.9 (+ ignition-core 3.1.8, ignition-viem 3.1.6), node-test-runner 3.1.1, network-helpers 3.0.12, viem-assertions 3.1.4, verify 3.1.3, keystore 3.1.2 |
| @openzeppelin/contracts | 5.6.1 | EIP712, ECDSA, ReentrancyGuard |
| solc | 0.8.37 | Downloaded by Hardhat; optimizer disabled |
| tsx | 4.23.15 | Runs the TypeScript scripts |
| @types/node | 24.19.2 | |
| @types/react, @types/react-dom | 19.3.0 | |

No database, no zod, no canonicalization library. JCS is implemented in `lib/climate/canonical.ts` and tested against the RFC 8785 examples.

## Climate engine (`lib/climate/`)

```
types.ts      units glossary, ClimateError codes, spec / result / provenance types
dates.ts      civil dates in UTC only; inclusive ranges; season windows (no year crossing, no 29 Feb)
validate.ts   untrusted Open-Meteo JSON → DailySeries (unit, tz, dup/missing/unexpected dates, null, negative, precision)
srpn.ts       pure SRPN-v1 in BigInt + display-only formatters
canonical.ts  RFC 8785 JCS
evidence.ts   specHash, seriesDigest, evidenceDigest, buildEvidence, verifyEvidenceArtifact
source.ts     the only network code: pinned URL, timeout, retry/backoff, 4xx vs 5xx handling
snapshots.ts  manifest + SHA-256 verification of saved raw responses
scenarios.ts  the three Yabelo OND demo specs + the MAM 2021 reference case (inputs only, never expected outputs)
index.ts      app-facing API: getClimateEvidence(spec, { mode })
node.ts       disk readers for scripts, tests and server components
```

### Algorithm and precision (SRPN-v1)

| Stage | Representation |
|---|---|
| Raw | Open-Meteo `precipitation_sum`, mm, reported at 0.1 mm resolution |
| Normalized | `dmm = round(mm × 10)`. A value finer than 0.1 mm is rejected (`PRECISION_EXCEEDED`), never rounded silently. |
| Intermediate | `T` = Σ observed dmm. `B_y` = Σ dmm for each baseline season, 1991–2020. `S` = Σ `B_y`. `N` = 30. Integers / BigInt. |
| Index | **`indexBps = floor(T × 10000 × N / S)`**. 10000 = 100 % of normal and 6000 = 60 %. The mean `S/N` is never rounded. |
| Decision | **`triggered = indexBps ≤ thresholdBps`**. Equality triggers. Floor rounding can trigger a true ratio up to < 1 bps above the threshold; the contract will apply the same `<=`. |
| Deficit | `deficitBps = 10000 − indexBps` (negative means surplus) |
| Presentation only | Percent `indexBps/100` (2 dp), mm (1 dp), baseline mean rounded half-up, z-score (float, informational) |

Inputs are validated as follows:
- Every expected day must be present exactly once and be non-null and non-negative.
- All chunks must resolve to the same grid cell.
- `S = 0`, invalid thresholds, observed years inside the baseline, and any model other than `era5` are rejected.
- The `best_match` model is never requested.

### Evidence and hashes

There are three kinds of hash, and they are never interchangeable:

1. **Raw snapshot integrity:** `sha256(raw bytes)` of each Open-Meteo response, kept in `manifest.json` and in provenance. Live bytes differ on every call (`generationtime_ms`), so this hash is **not** part of the evidence digest.
2. **`seriesDigest`:** `keccak256(JCS({schema:"rilva.series.v1", grid, variable, unit:"dmm", days:[[date,dmm],…]}))` over exactly the observed and baseline days used.
3. **`evidenceDigest`:** `keccak256(UTF-8(JCS(core)))`. The core contains:
   - schema, algorithm, `specHash`, spec;
   - source (provider, endpoint, model, variable, units, timezone);
   - requested and resolved location;
   - periods;
   - `seriesDigest`, observed daily dmm, baseline season totals;
   - the integer result, threshold and decision.

   This is the `bytes32` the Phase 2 EIP-712 attestation will sign. Solidity `keccak256(bytes(canonicalJson))` over the same UTF-8 bytes yields the same value.

Also, `specHash = keccak256(UTF-8(JCS(spec)))`, which matches CONTRACTS.md (`keccak256(bytes(spec))`).

A matching digest proves **integrity and reproducibility**. It does not prove that ERA5 is ground truth, that drought impact occurred, or that anyone suffered loss.

**Canonicalization rules (RFC 8785):**
- UTF-8 output with no whitespace.
- Object keys sorted by UTF-16 code units.
- Strings and numbers serialized as in ECMAScript JSON (e.g. `5.0 → 5`, `1e21 → 1e+21`).
- `undefined`, NaN/Infinity, BigInt, non-plain objects and lone surrogates throw an error.

## Snapshots (`public/snapshots/open-meteo/era5/yabelo/`)

These are genuine responses fetched by `pnpm climate:snapshot` on **2026-10-19 (08:14 UTC)**:

| File | Request |
|---|---|
| `1991-01-01_2000-12-31.json`, `2001-01-01_2010-12-31.json`, `2011-01-01_2020-12-31.json` | Baseline |
| `2021-10-01_2021-12-31.json`, `2022-…`, `2023-…` | Observed seasons |
| `2021-03-01_2021-05-31.json` | MAM 2021 reference case, fetched 2026-10-19 08:29 UTC |

All requests use `latitude=4.88&longitude=38.08&daily=precipitation_sum&timezone=Africa/Addis_Ababa&models=era5`.

How they were validated:
- Each file is the exact byte stream received. `manifest.json` records the canonical URL, `retrievedAt`, byte length and SHA-256.
- `.gitattributes` marks the directory `-text`, so git never rewrites line endings.
- All 11,234 overlapping days were cross-checked against independent `curl` downloads made during Phase 0: there were **0 differences**.
- `pnpm climate:verify --live` re-fetched all requests on 2026-10-19 and reproduced all three evidence digests exactly.
- Running `climate:verify` with `fetch` disabled passes, which shows it is truly offline.

Attribution, as required by CC BY 4.0: *Weather data by Open-Meteo.com (CC BY 4.0), based on ERA5 — Copernicus Climate Change Service information.* The app footer carries the same credit.

CHIRPS data is **not** committed or redistributed: its licence is unconfirmed, and it is a research cross-check only.

To regenerate:
1. `pnpm climate:snapshot`. This is incremental: verified files are kept and only missing ones are fetched. `--refresh` re-downloads everything.
2. `pnpm climate:evidence`
3. `pnpm climate:verify all`

Review the diff afterwards. Only `retrievedAt`, the SHA-256 values and `generationtime_ms` should change, while the evidence digests stay the same. If the digests change, upstream data changed, and that must be investigated before committing.

## Verified results (offline, from the committed snapshots)

Grid cell 5.0° N, 38.0° E (elevation 1891 m); baseline mean 234.0 mm (S = 70193 dmm, N = 30).

| Scenario | Rainfall | % of normal | indexBps | Rule ≤ 6000 | evidenceDigest |
|---|---|---|---|---|---|
| OND 2021 | 78.7 mm | 33.63 % | 3363 | Trigger | `0xde7fdf48a6a608f3702848d95643440ceac87c4f411ccd64fc7776653be94f50` |
| OND 2022 | 104.4 mm | 44.61 % | 4461 | Trigger | `0x8f4751b9ad2039b4b3544dafc8d29d2d45c3f29aba898a37994c11911599d19a` |
| OND 2023 | 498.9 mm | 213.22 % | 21322 | No trigger | `0x5c28852cf7b8533214308ad12ce4b04a32f8d429b65484d56364f6b8169b253e` |

These match the Phase 0 values exactly.

Reference case (golden test only, not a demo campaign): **MAM 2021 = 5468 bps (54.68 %)**, T = 2265 dmm, S = 124257 dmm. This is the season where ERA5 and CHIRPS v3 disagree (CLIMATE_DATA.md §3).

## Phase 2 handoff

```ts
import { getClimateEvidence, SCENARIOS } from "@/lib/climate";
const r = await getClimateEvidence(SCENARIOS["yabelo-ond-2021"].spec, {
  mode: "live-with-snapshot-fallback",   // or "live" | "snapshot"
  manifest, readSnapshotFile,            // required for snapshot / fallback
});
r.artifact.evidenceDigest       // bytes32 → Attestation.evidenceHash
r.artifact.core.specHash        // bytes32 → Campaign.specHash / Attestation.specHash
r.artifact.core.result.indexBps // uint32 → Attestation.indexBps
r.provenance.mode               // "live" | "snapshot"; show it, never hide a fallback
```

Notes:
- `canonicalSpec(spec)` gives the exact string to pass as `spec` to `createCampaign`.
- `periodStart` / `periodEnd` are `YYYYMMDD` integers derived from `spec.period`.
- A browser snapshot reader can `fetch("/snapshots/open-meteo/era5/yabelo/<file>")`, since the files are served from `public/`.

**Phase 2 (done):** `RilvaEscrow` (Hardhat 3) consumes these values through `lib/contracts`: `campaignTermsFromSpec(spec)` and `buildAttestation({ evidence, campaignId, expiresAt })`. See CONTRACTS.md and DEPLOYMENT.md.

## Limitations

- ERA5 is a reanalysis model estimate for a ~28 km cell. It is not a rain gauge and not regional.
- ERA5 and CHIRPS v3 disagree materially in some seasons (CLIMATE_DATA.md §3).
- The 60 % threshold is illustrative.
- SRPN-v1 measures meteorological rainfall only: not drought impact, crop loss, or financial loss.
- The attestor remains a trusted oracle and could equivocate (CONTRACTS.md §8). Reproducibility makes its claims auditable, not automatically true.
- MVP seasons must lie within one calendar year and must not contain 29 February.
