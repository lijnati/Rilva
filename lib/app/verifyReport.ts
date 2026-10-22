/**
 * Shareable verification report ("rilva.verification-report.v1"): what this browser checked, with its
 * own limits stated. It records a result; anyone should re-run /verify rather than trust the file.
 */
import type { Check, Verification } from "./verifyChecks";

export interface VerificationReportInput {
  campaignId: bigint;
  chainId: number;
  chainLabel: string;
  escrow: string;
  url: string;
  summary: Verification["summary"];
  checks: Check[];
  amountWei: bigint;
  status: string;
  specHash: string;
  evidenceHash: string | null;
  attestedIndexBps: number | null;
  thresholdBps: number;
  recomputation: { mode: "live" | "snapshot"; evidenceDigest: string } | null;
  generatedAt: string;
}

export function buildVerificationReport(r: VerificationReportInput): string {
  return JSON.stringify(
    {
      schema: "rilva.verification-report.v1",
      generatedAt: r.generatedAt,
      reproduceAt: r.url,
      chain: { id: r.chainId, label: r.chainLabel, escrow: r.escrow },
      campaign: {
        id: r.campaignId.toString(),
        status: r.status,
        amountWei: r.amountWei.toString(),
        specHash: r.specHash,
        evidenceHash: r.evidenceHash,
        attestedIndexBps: r.attestedIndexBps,
        thresholdBps: r.thresholdBps,
      },
      recomputation: r.recomputation,
      summary: r.summary,
      checks: r.checks.map(({ id, kind, title, status, detail }) => ({ id, kind, title, status, detail })),
      notClaimed: [
        "ERA5 is a reanalysis model estimate for one ~28 km grid cell, not a rain gauge; it does not measure drought impact or financial loss.",
        "The attestor is trusted to sign honestly; these checks make the attestation checkable, not automatically true.",
        "The threshold is an illustrative hackathon rule, not an official drought definition. Testnet only.",
      ],
    },
    null,
    2,
  );
}
