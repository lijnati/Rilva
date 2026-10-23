# CONTRACTS.md — RilvaEscrow (as implemented, Phase 2)

> Source: `contracts/RilvaEscrow.sol`. Tests: `tests/contracts/` (62 passing, 100 % line and statement coverage of `RilvaEscrow.sol`). Deployment: [DEPLOYMENT.md](DEPLOYMENT.md), deployed to Base Sepolia at `0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E` (2026-10-23).
> Chain: **Base Sepolia, chain ID 84532** (Verified 2026-10-19: `eth_chainId` on `https://sepolia.base.org` returned `0x14a34`). **Testnet ETH only. Never mainnet.**
> **This contract has not been audited.** Passing tests and the review in §9 are not a professional security audit.

## 1. Toolchain
| Item | Value |
|---|---|
| Framework | Hardhat **3.19.0**, Node test runner, viem 2.57.7 (`@nomicfoundation/hardhat-toolbox-viem` 5.0.7) |
| Deployment | Hardhat Ignition 3.1.9 |
| Library | OpenZeppelin Contracts **5.6.1**: `EIP712`, `ECDSA`, `ReentrancyGuard` |
| Compiler | solc **0.8.37**, optimizer **disabled**, `evmVersion: cancun` |

Why the optimizer is off: the only known bug in 0.8.37 (`YulOptimizerKnowledgeBaseStaleBookkeeping`, low severity) requires the Yul optimizer. On an L2 testnet, the extra gas costs almost nothing.

Foundry is **not** used (Phase 2 brief). The Phase 0 Foundry plan is superseded.

## 2. Responsibilities
`RilvaEscrow` is a single ownerless, non-upgradeable contract. It holds many independent campaigns in native ETH.

It **does**:
- Fund and fix campaign terms in one transaction.
- Verify an EIP-712 attestation from the campaign's designated attestor.
- Decide the outcome **on-chain** from the signed integer index (`indexBps ≤ thresholdBps`).
- Pay exactly the escrowed amount once, to the fixed beneficiary or the fixed funder.
- Provide a permissionless timeout refund to the funder.
- Emit every fact needed to rebuild the history without a database.

It **does not**:
- Fetch or judge climate data.
- Accept a caller-supplied `triggered` flag.
- Have any owner, admin, pause, upgrade, `delegatecall`, arbitrary call, token, receive or fallback function, or withdrawal function.

## 3. Public interface
```solidity
enum Status { None, Active, Released, Refunded }
enum RefundReason { NotTriggered, Timeout }

struct Campaign {
  address funder; address beneficiary; address attestor; uint96 amount; uint64 settlementDeadline;
  uint32 observationStart; uint32 observationEnd; uint32 thresholdBps; Status status;
  uint32 indexBps; bytes32 specHash; bytes32 evidenceHash;
}
struct Attestation {
  uint256 campaignId; bytes32 specHash; bytes32 evidenceHash; uint32 indexBps;
  uint32 observationStart; uint32 observationEnd; uint64 expiresAt;
}

function createCampaign(address beneficiary, address attestor, uint32 observationStart, uint32 observationEnd,
                        uint32 thresholdBps, uint64 settlementDeadline, string calldata spec)
    external payable returns (uint256 campaignId);
function settle(Attestation calldata attestation, bytes calldata signature) external;   // nonReentrant
function refundAfterDeadline(uint256 campaignId) external;                              // nonReentrant
function getCampaign(uint256 campaignId) external view returns (Campaign memory);
function hashAttestation(Attestation calldata attestation) external view returns (bytes32);
function campaignCount() external view returns (uint256);
function eip712Domain() external view returns (...);          // EIP-5267 (OpenZeppelin)
bytes32 public constant ATTESTATION_TYPEHASH;
uint32 public constant MAX_BPS = 10000;
uint64 public constant MIN_SETTLEMENT_WINDOW = 10 minutes;
uint64 public constant MAX_SETTLEMENT_WINDOW = 366 days;
uint256 public constant MAX_SPEC_LENGTH = 4096;
```
Campaign IDs are sequential and start at **1**. ID 0 never exists.

### createCampaign rules (custom error on failure)
| Rule | Error |
|---|---|
| `msg.value > 0` | `ZeroValue` |
| `msg.value ≤ type(uint96).max` | `AmountTooLarge` |
| beneficiary and attestor are not `address(0)` | `ZeroAddress` |
| attestor ∉ {funder, beneficiary} and funder ≠ beneficiary | `RoleConflict` |
| `1 ≤ thresholdBps ≤ 10000` | `InvalidThreshold` |
| Both dates are valid `YYYYMMDD` calendar dates (Gregorian leap rules, years 1940–2100) and start ≤ end. **They are never compared with block time:** historical replays are allowed, and observation dates are separate from the settlement deadline. | `InvalidObservationPeriod` |
| `now + 10 min ≤ settlementDeadline ≤ now + 366 days` | `InvalidSettlementDeadline` |
| `1 ≤ bytes(spec).length ≤ 4096` | `InvalidSpec` |

`specHash = keccak256(bytes(spec))` is computed on-chain, so it is always non-zero and always matches the emitted `spec`.

The spec is the Phase 1 canonical `rilva.spec.v1` JSON (RFC 8785, from `canonicalSpec()`). It binds:
- requested coordinates and location label;
- provider, model `era5`, variable `precipitation_sum`, timezone;
- observation period;
- baseline years;
- `method: "SRPN-v1"`, which fixes the normalisation (0.1 mm → integer dmm) and the index rule `floor(T×10000×N/S)`;
- `thresholdBps`;
- the `replay` flag.

The contract cannot parse JSON. The UI and verifier must check that the spec agrees with the numeric arguments. `campaignTermsFromSpec()` derives the arguments *from* the spec, so they cannot disagree when used.

## 4. State machine
```
None ──createCampaign (payable, terms fixed)──▶ Active
Active ──settle: valid sig, indexBps ≤ thresholdBps──▶ Released   (beneficiary receives amount)
Active ──settle: valid sig, indexBps > thresholdBps──▶ Refunded   (funder receives amount, reason NotTriggered)
Active ──refundAfterDeadline, now ≥ settlementDeadline──▶ Refunded (funder receives amount, reason Timeout)
```
`Released` and `Refunded` are terminal. Nothing leaves them, and every later `settle` or `refundAfterDeadline` reverts with `CampaignNotActive`.

**Deadline boundary (tested at −1, 0 and +1 second):**
- `settle` requires `block.timestamp < settlementDeadline`; at the deadline it fails with `SettlementWindowClosed`.
- `refundAfterDeadline` requires `block.timestamp ≥ settlementDeadline`; before it, the call fails with `SettlementWindowOpen`.

The two are disjoint, with no gap and no overlap.

### settle checks, in order
1. Campaign exists → else `CampaignNotFound(id)`.
2. Status is `Active` → else `CampaignNotActive(id)`.
3. `now < settlementDeadline` → else `SettlementWindowClosed(id)`.
4. `now ≤ expiresAt` → else `AttestationExpired`.
5. `specHash` equals the campaign's → else `SpecMismatch`.
6. Observation start and end equal the campaign's → else `ObservationPeriodMismatch`.
7. `ECDSA.recover(_hashTypedDataV4(structHash), signature) == attestor` → else `InvalidSigner(recovered)`. OpenZeppelin reverts first on malformed signatures:
   - `ECDSAInvalidSignatureLength`;
   - high-s → `ECDSAInvalidSignatureS`;
   - zero address → `ECDSAInvalidSignature`.
8. **Effects:**
   - `triggered = indexBps ≤ thresholdBps`;
   - status, `indexBps` and `evidenceHash` are written;
   - events are emitted.
9. **Interaction:** a single `call{value: amount}` to the fixed recipient. If it fails: `TransferFailed(recipient, amount)` and the whole transaction reverts, so the state stays `Active`.

## 5. EIP-712
- **Domain:** `name = "RilvaEscrow"`, `version = "1"`, `chainId = block.chainid`, `verifyingContract = address(this)`. These come from OZ `EIP712`, which rebuilds the separator if the chain ID changes, and are exposed via `eip712Domain()`.
- **Type string:** shared byte-for-byte with `lib/contracts/typedData.ts` (`ATTESTATION_TYPE_STRING`) and checked by a test:
  ```
  Attestation(uint256 campaignId,bytes32 specHash,bytes32 evidenceHash,uint32 indexBps,uint32 observationStart,uint32 observationEnd,uint64 expiresAt)
  ```
- **Field sources** (from `buildAttestation()`):

  | Field | Source |
  |---|---|
  | `specHash` | `evidence.core.specHash` |
  | `evidenceHash` | `evidence.evidenceDigest` = keccak256(JCS(core)) |
  | `indexBps` | `evidence.core.result.indexBps`, checked to fit uint32 |
  | dates | `evidence.core.periods.observed`, converted to `YYYYMMDD` |

  `buildAttestation()` refuses any artifact that fails `verifyEvidenceArtifact()`.
- **Nonce: deliberately not used.** Each attestation is bound to `campaignId` and `specHash`, and through the domain to `chainId` and the contract address. A campaign can only be settled once. A nonce would add a second replay mechanism with no extra protection.
- **Expiry:** `expiresAt` limits how long a signature stays usable. The UI default is now + 1 hour. Equality (`now == expiresAt`) is accepted.

## 6. Events (audit trail, no database needed)
```solidity
event CampaignCreated(uint256 indexed campaignId, address indexed funder, address indexed beneficiary, address attestor,
    uint256 amount, bytes32 specHash, uint32 observationStart, uint32 observationEnd, uint32 thresholdBps,
    uint64 settlementDeadline, string spec);
event CampaignSettled(uint256 indexed campaignId, bytes32 indexed evidenceHash, uint32 indexBps, uint32 thresholdBps,
    bool triggered, address recipient, uint256 amount, bytes32 digest);
event CampaignRefunded(uint256 indexed campaignId, address indexed funder, uint256 amount, RefundReason reason);
```
- A non-triggered settlement emits `CampaignSettled(triggered=false, recipient=funder)` **and** `CampaignRefunded(NotTriggered)`.
- A timeout emits only `CampaignRefunded(Timeout)`.
- Rejected attempts revert and emit nothing. The UI shows them by simulating the call (Phase 3).

## 7. Invariants and the tests that check them
| ID | Invariant | Evidence |
|---|---|---|
| I1 | Contract balance = Σ `amount` of `Active` campaigns | Seeded randomized lifecycle test (40 steps), balance checks in each payout test |
| I2 | At most one transfer per campaign, of exactly `amount` | Double-payout / double-refund / replay tests, `balancesHaveChanged` |
| I3 | Value only goes to the recorded beneficiary (Released) or funder (Refunded); never to the caller | Third-party relayer test, timeout-by-other test |
| I4 | Terms are immutable after creation | ABI test: the only mutating functions are `createCampaign`, `settle`, `refundAfterDeadline`; no receive/fallback |
| I5 | `Released` ⇒ valid attestor signature over matching campaign, spec and period, with `indexBps ≤ threshold`, decided on-chain | Attack suite and boundary test (6000 → Released, 6001 → Refunded) |
| I6 | Monotonic status: None→Active→{Released, Refunded} | Randomized model comparison, terminal-state tests |
| I7 | Settlement and timeout refund are disjoint in time | Deadline boundary tests |
| I8 | One campaign's actions never move another's funds | Isolation test, reentrancy test |

**Attack tests (all rejected):**
- wrong signer;
- modified index, evidence hash, expiry, start date, end date or spec hash;
- signature for another campaign;
- signature for another RilvaEscrow deployment;
- signature for chain ID 84532 replayed on the local chain;
- expired attestation;
- 64-byte, empty, zero and garbage signatures;
- high-s malleated signature;
- replay after settlement;
- non-existent campaign;
- reentrant beneficiary trying to refund another campaign;
- rejecting beneficiary;
- rejecting funder.

**Cross-language:**
- viem `hashTypedData` equals `hashAttestation()` on-chain for edge values (`2^255` id, `uint32` max index, `uint64` max expiry).
- `ATTESTATION_TYPEHASH` equals keccak256 of the shared type string.
- viem-signed attestations settle on-chain.
- The generated `lib/contracts/abi.ts` deep-equals the compiled artifact.

## 8. Trust model
| Actor | Trusted for | Can do if malicious | Mitigation / residual risk |
|---|---|---|---|
| **Attestor** (oracle) | Computing SRPN-v1 honestly from the declared source and signing the true index | Sign a false index (wrongful release or wrongful refund). **Equivocate:** sign conflicting attestations (different index or evidence) for the same active campaign. **Whichever valid one is submitted first becomes final; the contract does not and cannot prevent equivocation.** Refuse to sign (liveness). | Funds can only reach the fixed beneficiary or the fixed funder. Every accepted `evidenceHash` and the full spec are public, so anyone can recompute and **detect** a lie or equivocation. That is detection, not prevention. Refusal → timeout refund. Future work: m-of-n attestors or a challenge window. **This is the central residual trust assumption.** |
| Funder | Funding | Pick a misleading spec or threshold | The spec is public and immutable. The funder cannot be the attestor and cannot refund before the deadline. |
| Beneficiary | Receiving | Reject ETH to grief | The settle reverts atomically and the state stays Active. After the deadline, the funder recovers the funds with the timeout refund (tested). |
| Funder that is a contract rejecting ETH | — | Its own refunds fail | **Liveness limit:** non-trigger settlements and timeout refunds revert (tested) and the funds stay locked in that campaign. Only the funder's own campaign is affected, never other campaigns. Accepted for the MVP instead of a pull-payment architecture. EOAs, the expected funders, are unaffected. |
| Relayer / anyone | Nothing | Replay, alter fields, reorder, front-run | Domain separation, struct binding, one-shot state, expiry, fixed recipients. Front-running a valid settle only lets someone else pay the gas. |
| Rilva server / UI | Nothing | Show wrong data | The browser recomputes the evidence and verifies the hash. No server keys. |
| Chain (Base Sepolia) | Ordering and timestamps | Validators shift timestamps by seconds | Windows are minutes to days long. Testnet only. |

**What the contract guarantees:** it enforces immutable conditions over an authorised attestation. **What it cannot guarantee:** that ERA5 rainfall is accurate, that drought impacts occurred, or that the attestor is honest.

## 9. Security review notes (focused self-review, not an audit)
- **Funds flow:**
  - There is exactly one inflow (`createCampaign`) and one outflow (`_send`), reached only from `settle` and `refundAfterDeadline`, after the terminal state is written.
  - No receive, fallback or `selfdestruct`. Forced ETH, e.g. from another contract's `selfdestruct`, would only make balance > liabilities, which harms nobody.
- **Reentrancy:**
  - Checks-effects-interactions, plus `nonReentrant` on both value-moving functions.
  - The test proves a reentrant beneficiary cannot trigger another campaign's refund.
- **Signatures:**
  - OZ `ECDSA.recover` (rejects malleable high-s, bad lengths and the zero address) over OZ `_hashTypedDataV4`. No custom cryptography.
  - EIP-1271 contract signatures are deliberately not supported: the attestor is an EOA.
- **Replay:** domain (chain ID, contract) + struct (campaign ID, spec hash, dates, expiry) + one-shot status.
- **Time:** only `settlementDeadline` and `expiresAt` use `block.timestamp`; observation dates are calendar integers. The boundaries are tested.
- **Arithmetic:**
  - Solidity 0.8 checked math.
  - `amount` is range-checked before narrowing to uint96.
  - `campaignCount` uses `++` (overflow is impossible in practice).
  - Date validation uses only division and modulo on uint32.
- **DoS:** there are no loops; the spec is bounded to 4096 bytes. `getCampaign` is a single SLOAD set.
- **Known non-issues and accepted limits:** attestor equivocation (§8), rejecting-funder liveness (§8), and the trusted oracle.
- **Compiler warnings:** only OpenZeppelin's own forward-compatibility notices ("`error` will be promoted to keyword") in `ECDSA.sol`. They have no safety impact, and our sources produce no warnings.

## 10. Gas (Hardhat `--gas-stats`, local EDR, optimizer off, 2026-10-19)
| Operation | Gas |
|---|---|
| Deployment | 2,653,742 (bytecode 11,837 bytes) |
| `createCampaign` with the real ~400-byte spec | median 180,672 (min 163,572, max 271,604 with the 4 KB spec) |
| `settle` | median 87,944 (min 85,533, max 111,457) |
| `refundAfterDeadline` | 46,727 |
| `getCampaign` (call) | 38,147 |

## 11. Integration surface (`lib/contracts/`)
| File | Contents |
|---|---|
| `abi.ts` | Generated by `pnpm contracts:abi` (`as const`); drift test |
| `typedData.ts` | Domain, types, `buildAttestation`, `hashAttestation`, `signAttestation`, `recoverAttestationSigner`, `verifyAttestation` |
| `spec.ts` | `campaignTermsFromSpec`, `isoToYyyymmdd` / `yyyymmddToIso`, `toUint32` |
| `campaign.ts` | Status/reason enums, `readCampaign(Count)`, `prepareCreateCampaign` / `prepareSettle` / `prepareRefundAfterDeadline`, `parseRilvaEvents`, `campaignIdFromReceipt`, `decodeRilvaError` |
| `config.ts` | `RILVA_CHAIN` (Base Sepolia), `readEscrowConfig` (`NEXT_PUBLIC_RILVA_ESCROW_ADDRESS`, `NEXT_PUBLIC_RILVA_DEPLOY_BLOCK`), Basescan links |

Sources:
- https://eips.ethereum.org/EIPS/eip-712
- https://eips.ethereum.org/EIPS/eip-5267
- https://docs.openzeppelin.com/contracts/5.x/
- https://hardhat.org/docs
- https://docs.base.org/base-chain/quickstart/connecting-to-base
