import { describe, expect, it } from "vitest";
import {
  baselineMeanDmmRounded,
  computeSrpn,
  formatBpsAsPercent,
  formatDmmAsMm,
  deficitDmmRational,
  sumDmm,
} from "@/lib/climate/srpn";

// All inputs here are SYNTHETIC integers chosen to exercise the arithmetic.
const flat = (n: number, v: number) => Array.from({ length: n }, () => v);

describe("sumDmm", () => {
  it("adds integer dmm values", () => {
    expect(sumDmm([16, 24, 0, 108])).toBe(148);
    expect(sumDmm([])).toBe(0);
  });

  it("rejects non-integers and negatives", () => {
    expect(() => sumDmm([1.5])).toThrow(/INVALID_VALUE/);
    expect(() => sumDmm([-1])).toThrow(/NEGATIVE_VALUE/);
  });
});

describe("computeSrpn", () => {
  it("computes the index against a 30-year baseline", () => {
    const r = computeSrpn({ observedTotalDmm: 1000, baselineSeasonTotalsDmm: flat(30, 2000), thresholdBps: 6000 });
    expect(r.baselineSumDmm).toBe(60000);
    expect(r.baselineYears).toBe(30);
    expect(r.indexBps).toBe(5000);
    expect(r.deficitBps).toBe(5000);
    expect(r.triggered).toBe(true);
  });

  it("uses floor rounding with no intermediate mean rounding", () => {
    // T/mean = 1 / (2/3) → 15000 bps exactly; 2/3 mean is never rounded.
    expect(computeSrpn({ observedTotalDmm: 2, baselineSeasonTotalsDmm: [1, 1, 1], thresholdBps: 6000 }).indexBps).toBe(20000);
    // 1 * 10000 * 3 / 7 = 4285.71… → 4285
    expect(computeSrpn({ observedTotalDmm: 1, baselineSeasonTotalsDmm: [3, 2, 2], thresholdBps: 6000 }).indexBps).toBe(4285);
  });

  it("triggers at exactly the threshold and not one basis point above", () => {
    // mean = 1000 dmm; T = 600 → 6000 bps
    const atThreshold = computeSrpn({ observedTotalDmm: 600, baselineSeasonTotalsDmm: flat(30, 1000), thresholdBps: 6000 });
    expect(atThreshold.indexBps).toBe(6000);
    expect(atThreshold.triggered).toBe(true);
    // T = 601 → 6010 bps; with threshold 6009 → not triggered
    const above = computeSrpn({ observedTotalDmm: 601, baselineSeasonTotalsDmm: flat(30, 1000), thresholdBps: 6009 });
    expect(above.indexBps).toBe(6010);
    expect(above.triggered).toBe(false);
  });

  it("reports surplus as a negative deficit", () => {
    const r = computeSrpn({ observedTotalDmm: 3000, baselineSeasonTotalsDmm: flat(30, 1000), thresholdBps: 6000 });
    expect(r.indexBps).toBe(30000);
    expect(r.deficitBps).toBe(-20000);
    expect(r.triggered).toBe(false);
  });

  it("is exact for large totals (BigInt arithmetic)", () => {
    const r = computeSrpn({ observedTotalDmm: 900_000_001, baselineSeasonTotalsDmm: flat(30, 900_000_000), thresholdBps: 10000 });
    expect(r.indexBps).toBe(10000); // 10000.0000111 → floor 10000
  });

  it("rejects zero, empty and invalid baselines", () => {
    expect(() => computeSrpn({ observedTotalDmm: 1, baselineSeasonTotalsDmm: flat(30, 0), thresholdBps: 6000 })).toThrow(/ZERO_BASELINE/);
    expect(() => computeSrpn({ observedTotalDmm: 1, baselineSeasonTotalsDmm: [], thresholdBps: 6000 })).toThrow(/INVALID_BASELINE/);
    expect(() => computeSrpn({ observedTotalDmm: 1, baselineSeasonTotalsDmm: [1.5], thresholdBps: 6000 })).toThrow(/INVALID_VALUE/);
    expect(() => computeSrpn({ observedTotalDmm: -1, baselineSeasonTotalsDmm: [1], thresholdBps: 6000 })).toThrow(/NEGATIVE_VALUE/);
  });

  it.each([0, -1, 10001, 60.5, Number.NaN])("rejects threshold %s", (t) => {
    expect(() => computeSrpn({ observedTotalDmm: 1, baselineSeasonTotalsDmm: [1], thresholdBps: t })).toThrow(/INVALID_THRESHOLD/);
  });

  it("is deterministic", () => {
    const input = { observedTotalDmm: 787, baselineSeasonTotalsDmm: [2000, 2500, 1700], thresholdBps: 6000 };
    expect(computeSrpn(input)).toEqual(computeSrpn(structuredClone(input)));
  });
});

describe("presentation helpers (display only, never decisions)", () => {
  it("formats basis points as a 2-decimal percent", () => {
    expect(formatBpsAsPercent(3363)).toBe("33.63");
    expect(formatBpsAsPercent(21322)).toBe("213.22");
    expect(formatBpsAsPercent(5)).toBe("0.05");
    expect(formatBpsAsPercent(-1250)).toBe("-12.50");
  });

  it("formats dmm as 1-decimal mm", () => {
    expect(formatDmmAsMm(787)).toBe("78.7");
    expect(formatDmmAsMm(0)).toBe("0.0");
    expect(formatDmmAsMm(-15)).toBe("-1.5");
  });

  it("rounds the baseline mean half-up to whole dmm", () => {
    expect(baselineMeanDmmRounded(70193, 30)).toBe(2340); // 2339.77 → 2340 (234.0 mm)
    expect(baselineMeanDmmRounded(45, 30)).toBe(2); // 1.5 → 2
    expect(baselineMeanDmmRounded(44, 30)).toBe(1); // 1.47 → 1
  });

  it("expresses the deficit as an exact rational in dmm", () => {
    expect(deficitDmmRational(787, 70193, 30)).toEqual({ numerator: 70193 - 30 * 787, denominator: 30 });
  });
});
