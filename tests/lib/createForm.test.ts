import { describe, expect, it } from "vitest";
import { MAX_DEADLINE_SECONDS, MIN_DEADLINE_SECONDS, validateCreateForm } from "@/lib/app/createForm";
import { campaignTermsFromSpec } from "@/lib/contracts";
import { SCENARIOS } from "@/lib/climate";

const FUNDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ATTESTOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const BENEFICIARY = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const base = {
  scenarioId: "yabelo-ond-2021",
  beneficiary: BENEFICIARY,
  attestor: ATTESTOR,
  amountEth: "0.01",
  deadlineSeconds: 7 * 86400,
};
const ctx = { now: 1_800_000_000n, funder: FUNDER as `0x${string}`, balance: 10n ** 18n };

describe("validateCreateForm", () => {
  it("builds contract arguments from the spec, never from hand-typed percentages", () => {
    const r = validateCreateForm(base, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.terms).toEqual(campaignTermsFromSpec(SCENARIOS["yabelo-ond-2021"].spec));
    expect(r.value.value).toBe(10_000_000_000_000_000n);
    expect(r.value.settlementDeadline).toBe(ctx.now + 7n * 86400n);
    expect(r.value.beneficiary).toBe(BENEFICIARY);
  });

  it("parses ETH amounts exactly, without floating point", () => {
    const r = validateCreateForm({ ...base, amountEth: "0.000000000000000001" }, ctx);
    expect(r.ok && r.value.value).toBe(1n);
    const r2 = validateCreateForm({ ...base, amountEth: "0.3" }, ctx);
    expect(r2.ok && r2.value.value).toBe(300_000_000_000_000_000n);
  });

  it.each([["0"], [""], ["-1"], ["1e-3"], ["0.1.2"], ["abc"], ["0.0000000000000000001"], ["80000000000"]])("rejects amount %s", (amountEth) => {
    const r = validateCreateForm({ ...base, amountEth }, { ...ctx, balance: 10n ** 30n });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.amountEth).toBeTruthy();
  });

  it("flags an amount above the connected balance", () => {
    const r = validateCreateForm({ ...base, amountEth: "2" }, ctx);
    expect(!r.ok && r.errors.amountEth).toMatch(/balance/i);
  });

  it("rejects invalid, zero and conflicting addresses (mirrors ZeroAddress / RoleConflict)", () => {
    expect(!validateCreateForm({ ...base, beneficiary: "0x123" }, ctx).ok).toBe(true);
    const zero = validateCreateForm({ ...base, attestor: "0x0000000000000000000000000000000000000000" }, ctx);
    expect(!zero.ok && zero.errors.attestor).toBeTruthy();
    const same = validateCreateForm({ ...base, attestor: BENEFICIARY }, ctx);
    expect(!same.ok && same.errors.attestor).toMatch(/different/i);
    const self = validateCreateForm({ ...base, beneficiary: FUNDER }, ctx);
    expect(!self.ok && self.errors.beneficiary).toMatch(/your/i);
    const selfAttest = validateCreateForm({ ...base, attestor: FUNDER.toLowerCase() }, ctx);
    expect(!selfAttest.ok && selfAttest.errors.attestor).toMatch(/your/i);
  });

  it("keeps the settlement deadline inside the contract window with a safety margin", () => {
    expect(validateCreateForm({ ...base, deadlineSeconds: MIN_DEADLINE_SECONDS }, ctx).ok).toBe(true);
    expect(validateCreateForm({ ...base, deadlineSeconds: MAX_DEADLINE_SECONDS }, ctx).ok).toBe(true);
    expect(validateCreateForm({ ...base, deadlineSeconds: MIN_DEADLINE_SECONDS - 1 }, ctx).ok).toBe(false);
    expect(validateCreateForm({ ...base, deadlineSeconds: MAX_DEADLINE_SECONDS + 1 }, ctx).ok).toBe(false);
    expect(MIN_DEADLINE_SECONDS).toBeGreaterThan(600);
    expect(MAX_DEADLINE_SECONDS).toBeLessThan(366 * 86400);
  });

  it("only allows the verified replay specs (Yabelo and the regional snapshots)", () => {
    const r = validateCreateForm({ ...base, scenarioId: "nairobi-mam-2022" }, ctx);
    expect(!r.ok && r.errors.scenarioId).toBeTruthy();
    const k = validateCreateForm({ ...base, scenarioId: "marsabit-ond-2021" }, ctx);
    expect(k.ok && k.value.spec.location.label).toBe("Marsabit, Marsabit County, Kenya");
  });
});
