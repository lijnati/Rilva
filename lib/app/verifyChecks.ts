/**
 * Public verification checklist (ARCHITECTURE.md §4.3). Pure: it only compares facts already read from
 * the chain with a recomputation done in the viewer's browser. Each check states which KIND of guarantee
 * it gives; none of them says the rainfall estimate is accurate or that anyone was helped.
 */
import { keccak256, stringToBytes, type Address, type Hex } from "viem";
import { canonicalSpec, type ClimateSpec } from "../climate";
import { campaignTermsFromSpec, CampaignStatus, type Attestation, type Campaign } from "../contracts";

export type CheckKind = "authentic" | "reproducible" | "attested" | "contract";
export type CheckStatus = "pass" | "fail" | "na" | "error" | "pending";

export interface Check {
  id: "spec-hash" | "spec-terms" | "index" | "evidence-hash" | "signer" | "outcome" | "funds";
  kind: CheckKind;
  title: string;
  status: CheckStatus;
  detail: string;
  howTo: string;
}

export interface VerificationInput {
  campaign: Campaign;
  /** The exact spec string emitted in CampaignCreated. */
  spec: string | null;
  settled: { indexBps: number; thresholdBps: number; triggered: boolean; recipient: Address; amount: bigint; evidenceHash: Hex } | null;
  refundReason: "NotTriggered" | "Timeout" | null;
  refund?: { recipient: Address; amount: bigint } | null;
  /** Attestation decoded from the settle() transaction calldata. */
  submitted: Attestation | null;
  /** Signer recovered from that attestation + signature under this contract's EIP-712 domain. */
  recoveredSigner: Address | null;
  recomputed: { ok: true; indexBps: number; evidenceDigest: Hex; mode: "live" | "snapshot" } | { ok: false; error: string } | null;
  /** Work still running in the browser: those checks are "pending", never "error" or "pass". */
  pending?: { recompute?: boolean; signer?: boolean };
}

export interface Verification {
  checks: Check[];
  summary: "all-passed" | "failed" | "incomplete" | "not-settled" | "checking";
}

const eq = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function buildVerification(v: VerificationInput): Verification {
  const c = v.campaign;
  const checks: Check[] = [];
  const settledOnRule = !!v.settled;
  const timeout = v.refundReason === "Timeout";
  const active = c.status === CampaignStatus.Active;

  // 1 — the published spec is the one whose hash is stored
  const specHashOk = v.spec !== null && keccak256(stringToBytes(v.spec)) === c.specHash;
  checks.push({
    id: "spec-hash",
    kind: "authentic",
    title: "Spec hash matches the published spec",
    status: v.spec === null ? "error" : specHashOk ? "pass" : "fail",
    detail: v.spec === null ? "The CampaignCreated event could not be read." : specHashOk ? "keccak256(spec) equals the on-chain specHash." : "The spec text does not hash to the on-chain specHash.",
    howTo: "Hash the spec string from the CampaignCreated event with keccak256 and compare it with getCampaign(id).specHash.",
  });

  // 2 — the spec agrees with the numeric on-chain terms
  let termsStatus: CheckStatus = "error";
  let termsDetail = "The spec could not be parsed.";
  if (v.spec !== null) {
    try {
      const parsed = JSON.parse(v.spec) as ClimateSpec;
      const t = campaignTermsFromSpec(parsed);
      const canonical = canonicalSpec(parsed) === v.spec;
      const match = t.observationStart === c.observationStart && t.observationEnd === c.observationEnd && t.thresholdBps === c.thresholdBps;
      termsStatus = canonical && match ? "pass" : "fail";
      termsDetail = !canonical
        ? "The spec is not in canonical (RFC 8785) form."
        : match
          ? `Period ${c.observationStart}–${c.observationEnd} and threshold ${c.thresholdBps} bps match the contract.`
          : "The spec's period or threshold differs from the contract's stored terms.";
    } catch (e) {
      termsStatus = "fail";
      termsDetail = `The spec is not a valid rilva.spec.v1 document (${e instanceof Error ? e.message : String(e)}).`;
    }
  }
  checks.push({
    id: "spec-terms",
    kind: "authentic",
    title: "Spec agrees with the on-chain terms",
    status: termsStatus,
    detail: termsDetail,
    howTo: "Derive the observation dates and threshold from the spec and compare them with the campaign fields.",
  });

  // 3, 4 — recomputation (only meaningful once an attestation was accepted)
  const naReason = active ? "Not settled yet: no attested index exists." : "Timeout refund: no attestation was ever accepted.";
  const attested = settledOnRule ? v.settled! : null;
  const rc = v.recomputed;
  checks.push({
    id: "index",
    kind: "reproducible",
    title: "Index recomputes from ERA5",
    status: !attested ? "na" : !rc ? (v.pending?.recompute ? "pending" : "error") : !rc.ok ? "error" : rc.indexBps === attested.indexBps ? "pass" : "fail",
    detail: !attested
      ? naReason
      : !rc
        ? v.pending?.recompute
          ? "Recomputing from ERA5 in your browser…"
          : "Recomputation has not run."
        : !rc.ok
          ? `Could not recompute: ${rc.error}`
          : `Recomputed ${rc.indexBps} bps from ${rc.mode === "live" ? "a live Open-Meteo response" : "the saved ERA5 snapshot"}; attested ${attested.indexBps} bps.`,
    howTo: "Fetch the spec's ERA5 series from Open-Meteo (models=era5) and apply floor(T × 10000 × N / S).",
  });
  checks.push({
    id: "evidence-hash",
    kind: "reproducible",
    title: "Evidence hash recomputes",
    status: !attested ? "na" : !rc ? (v.pending?.recompute ? "pending" : "error") : !rc.ok ? "error" : eq(rc.evidenceDigest, c.evidenceHash) ? "pass" : "fail",
    detail: !attested
      ? naReason
      : !rc && v.pending?.recompute
        ? "Rebuilding the evidence core and hashing it…"
        : !rc || !rc.ok
        ? "No recomputed digest to compare."
        : eq(rc.evidenceDigest, c.evidenceHash)
          ? "keccak256(JCS(evidence core)) equals the on-chain evidenceHash."
          : "The recomputed evidence digest differs from the on-chain evidenceHash.",
    howTo: "Build the rilva.evidence.v1 core, canonicalise it (RFC 8785) and hash it with keccak256.",
  });

  // 5 — signature
  const signerOk = eq(v.recoveredSigner, c.attestor);
  const submittedMatches =
    !!v.submitted && v.submitted.indexBps === attested?.indexBps && eq(v.submitted.evidenceHash, c.evidenceHash) && eq(v.submitted.specHash, c.specHash);
  checks.push({
    id: "signer",
    kind: "attested",
    title: "Signed by the campaign's attestor",
    status: !attested ? "na" : !v.submitted || !v.recoveredSigner ? (v.pending?.signer ? "pending" : "error") : signerOk && submittedMatches ? "pass" : "fail",
    detail: !attested
      ? naReason
      : (!v.submitted || !v.recoveredSigner) && v.pending?.signer
        ? "Decoding the settle transaction and recovering the signer…"
        : !v.submitted || !v.recoveredSigner
        ? "The settle transaction could not be decoded."
        : signerOk && submittedMatches
          ? "The EIP-712 signature in the settle transaction recovers to the designated attestor."
          : signerOk
            ? "The submitted attestation does not match the stored result."
            : "The signature recovers to a different address than the attestor.",
    howTo: "Decode settle() calldata and run ecrecover over the EIP-712 digest for this contract and chain.",
  });

  // 6 — outcome follows the rule
  let outcomeStatus: CheckStatus = "na";
  let outcomeDetail = "Not settled yet.";
  if (attested) {
    const expected = attested.indexBps <= c.thresholdBps;
    const statusOk = expected ? c.status === CampaignStatus.Released : c.status === CampaignStatus.Refunded && v.refundReason === "NotTriggered";
    outcomeStatus = attested.triggered === expected && statusOk ? "pass" : "fail";
    outcomeDetail = `${attested.indexBps} bps ${expected ? "≤" : ">"} ${c.thresholdBps} bps → ${expected ? "Released to the beneficiary" : "Refunded to the funder (not triggered)"}.`;
  } else if (timeout) {
    outcomeStatus = c.status === CampaignStatus.Refunded ? "pass" : "fail";
    outcomeDetail = "No attestation before the deadline → timeout refund to the funder.";
  }
  checks.push({
    id: "outcome",
    kind: "contract",
    title: "Outcome follows the rule",
    status: outcomeStatus,
    detail: outcomeDetail,
    howTo: "Compare indexBps with thresholdBps (≤ releases) and check the final status and events.",
  });

  // 7 — money went to the fixed recipient, exactly once
  let fundsStatus: CheckStatus = "na";
  let fundsDetail = "Funds are still in escrow.";
  if (attested) {
    const expectedRecipient = attested.indexBps <= c.thresholdBps ? c.beneficiary : c.funder;
    fundsStatus = eq(attested.recipient, expectedRecipient) && attested.amount === c.amount ? "pass" : "fail";
    fundsDetail = fundsStatus === "pass" ? "The full escrowed amount went to the recipient fixed at creation." : "The payout recipient or amount differs from the campaign terms.";
  } else if (timeout && v.refund) {
    fundsStatus = eq(v.refund.recipient, c.funder) && v.refund.amount === c.amount ? "pass" : "fail";
    fundsDetail = fundsStatus === "pass" ? "The full escrowed amount returned to the funder." : "The refund recipient or amount differs from the campaign terms.";
  } else if (timeout) {
    fundsStatus = "error";
    fundsDetail = "The refund event could not be read.";
  }
  checks.push({
    id: "funds",
    kind: "contract",
    title: "Funds went to the right address",
    status: fundsStatus,
    detail: fundsDetail,
    howTo: "Read the CampaignSettled / CampaignRefunded event and compare recipient and amount with getCampaign(id).",
  });

  const applicable = checks.filter((x) => x.status !== "na");
  const summary: Verification["summary"] = applicable.some((x) => x.status === "fail")
    ? "failed"
    : applicable.some((x) => x.status === "pending")
      ? "checking"
    : applicable.some((x) => x.status === "error")
      ? "incomplete"
      : active
        ? "not-settled"
        : "all-passed";
  return { checks, summary };
}
