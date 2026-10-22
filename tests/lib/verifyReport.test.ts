import { describe, expect, it } from "vitest";
import { buildVerificationReport } from "@/lib/app/verifyReport";
import type { Check } from "@/lib/app/verifyChecks";

const checks: Check[] = [
  { id: "spec-hash", kind: "authentic", title: "Spec hash matches", status: "pass", detail: "ok", howTo: "x" },
  { id: "signer", kind: "attested", title: "Signer", status: "pass", detail: "ok", howTo: "y" },
];

describe("buildVerificationReport", () => {
  const report = buildVerificationReport({
    campaignId: 7n,
    chainId: 84532,
    chainLabel: "Base Sepolia · testnet",
    escrow: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    url: "https://example.org/verify/7",
    summary: "all-passed",
    checks,
    amountWei: 10_000_000_000_000_000n,
    status: "Released",
    specHash: `0x${"11".repeat(32)}`,
    evidenceHash: `0x${"22".repeat(32)}`,
    attestedIndexBps: 3363,
    thresholdBps: 6000,
    recomputation: { mode: "live", evidenceDigest: `0x${"22".repeat(32)}` },
    generatedAt: "2026-10-22T12:00:00.000Z",
  });

  it("is plain JSON with a schema, bigints as strings and every check", () => {
    const parsed = JSON.parse(report);
    expect(parsed.schema).toBe("rilva.verification-report.v1");
    expect(parsed.campaign).toMatchObject({ id: "7", amountWei: "10000000000000000", status: "Released", attestedIndexBps: 3363 });
    expect(parsed.checks).toHaveLength(2);
    expect(parsed.checks[0]).toEqual({ id: "spec-hash", kind: "authentic", title: "Spec hash matches", status: "pass", detail: "ok" });
    expect(parsed.chain).toEqual({ id: 84532, label: "Base Sepolia · testnet", escrow: "0x5FbDB2315678afecb367f032d93F642f64180aa3" });
  });

  it("states its own limits", () => {
    const parsed = JSON.parse(report);
    expect(parsed.notClaimed.join(" ")).toMatch(/not a rain gauge/);
    expect(parsed.notClaimed.join(" ")).toMatch(/attestor/);
  });
});
