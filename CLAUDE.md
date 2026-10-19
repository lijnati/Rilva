# CLAUDE.md — Rilva development instructions

Rilva is a hackathon demo: drought-trigger escrow on Base Sepolia, with an evidence-based rainfall index.
Source-of-truth docs (read the relevant one before changing anything in its area):
- [PRODUCT.md](PRODUCT.md) — scope, non-goals, demo story, allowed and forbidden claims
- [CLIMATE_DATA.md](CLIMATE_DATA.md) — SRPN-v1 formula, missing-data rules, golden values, evidence hashing
- [ARCHITECTURE.md](ARCHITECTURE.md) — components, data flows, trust boundaries
- [CONTRACTS.md](CONTRACTS.md) — `RilvaEscrow` interface, EIP-712 struct, invariants, test list
- [DESIGN.md](DESIGN.md) — tokens, typography, components, required copy
- [ROADMAP.md](ROADMAP.md) — phases, gates, fallback order, acceptance tests

If code and docs disagree, stop and reconcile. Update the doc in the same change, or ask.

## Phase discipline

- Work only inside the currently approved phase (ROADMAP.md). Phase 0 is docs only.
- Do not start a phase until the human approves the previous gate.
- Make small, verifiable changes: one concern per change, each leaving the repo green.
- Do not add features, dependencies, or abstractions that are not in the docs. Propose them first.

## Test-first rules

- `lib/climate`, `lib/contracts` and `contracts/` are **test-first**: write the failing test, then the code. Contract tests live in `tests/contracts/` (Hardhat node:test); app tests live in `tests/climate` and `tests/lib` (Vitest).
- Golden values in CLIMATE_DATA.md §4 (3363 / 4461 / 21322 / 5468 bps) must stay as tests and **must never be edited to make a test pass**. If the data changes, stop and report.
- Every revert path in CONTRACTS.md §9 has a test that asserts the exact custom error selector.
- The typed-data digest parity test (viem vs Solidity) must pass before any UI signing work.

## Checks before declaring any change done

Run, and report actual output (never claim a pass you did not see):

```
pnpm lint && pnpm typecheck && pnpm test && pnpm climate:verify all && pnpm build   # app
pnpm contracts:compile && pnpm contracts:test && pnpm contracts:coverage           # contracts (Hardhat 3)
```

The package manager is **pnpm 11.13.1** (pinned in `package.json`). Keep dependency versions exact, with no `^` or `~`.
If a change touches `lib/climate` or `public/snapshots`, `pnpm climate:verify all` must print `ALL CHECKS PASSED`.

## UI changes

- Before marking any UI task done, open the page in the browser and take screenshots at **1440 px and 390 px, in light and dark mode**. Compare them with DESIGN.md: tokens, type scale, banned patterns, required copy, and states.
- Check the loading, empty, error and success states, as well as wallet states.
- No horizontal scroll at 360 px. Keyboard focus is visible.

## Climate data rules

- Always request Open-Meteo with `models=era5`, `daily=precipitation_sum`, `timezone=Africa/Addis_Ababa`. **Never use `best_match`.** It switches models in 2017 (CLIMATE_DATA.md §2.1).
- Integer math only (BigInt) for the index. No floats in the decision path.
- Any null, missing day or API error → `INVALID`. Never gap-fill.
- CHIRPS is informational only and never feeds eligibility.
- Never invent or "round off" data, thresholds, sources or results. Every number in the UI must trace to a saved snapshot, a live response, or a cited doc. Never edit files under `public/snapshots/` by hand: regenerate them with `pnpm climate:snapshot`.
- Label replays as **retrospective replay**, and label the threshold as **illustrative**.

## Contract conventions (Phase 2)

- Hardhat 3 only. Do not add Foundry, Forge or forge-std.
- The EIP-712 type is defined **once** in `lib/contracts/typedData.ts`. After any ABI change, run `pnpm contracts:abi`; the drift test fails otherwise. Never hand-edit `lib/contracts/abi.ts`.
- Build on-chain arguments only via `campaignTermsFromSpec()` and `buildAttestation()`. Never hardcode percentages or indices in integration code.
- `lib/contracts` uses relative imports, not `@/`, so the Hardhat test runner can load it.
- Never broadcast to Base Sepolia without explicit human approval. Never deploy to mainnet. Never invent an address or tx hash.

## Security rules (fund release is security-critical)

- Never commit secrets. `.env*` (except `.env.example`) stays in `.gitignore`. Before each commit, grep the staged diff for `PRIVATE_KEY`, `0x` + 64 hex characters, and `mnemonic`.
- No private keys on the server or in Vercel env. Attestor signing happens in the attestor's wallet.
- The contract stays ownerless, non-upgradeable, and free of arbitrary calls. Any change to `RilvaEscrow` needs an updated CONTRACTS.md, updated tests, and an explicit human review.
- Use checks-effects-interactions and `nonReentrant` on every function that moves value.
- Testnet only. Never deploy to mainnet or handle real funds.
- Pin exact dependency versions and commit the lockfile. Verify docs (context7 or official) before using an API you are unsure about.

## Source verification

- When citing an external fact in docs or UI, include the URL and access date. Mark anything unconfirmed **UNVERIFIED**.
- Keep project decisions ("Decision") distinct from verified facts.

## AI usage in the product

- AI may only produce labelled, grounded summaries of already-computed evidence.
- It must never decide eligibility, compute the index, or trigger a transaction.
- It is not in the MVP.

## Stop and ask the human when

- An action is destructive: deleting files, force-pushing, or rewriting history.
- An action spends money, needs credentials or keys, deploys, broadcasts transactions, or posts publicly (Devpost, GitHub visibility, Vercel production).
- Golden values, source data, or contract invariants would change.
- A doc and the code conflict and the right answer isn't obvious.
- A gate in ROADMAP.md is red and a fallback must be chosen.
- A tool or browser action fails 2–3 times in the same way.
