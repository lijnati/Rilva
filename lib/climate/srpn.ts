/**
 * SRPN-v1 — Seasonal Rainfall Percent of Normal (CLIMATE_DATA.md §4). Pure, integer-only.
 *
 *   T = Σ observed-season dmm, B_y = Σ season dmm in baseline year y, S = Σ_y B_y, N = #years
 *   indexBps   = floor(T × 10000 × N / S)        (BigInt; the mean S/N is never rounded)
 *   deficitBps = 10000 − indexBps                (negative = surplus)
 *   triggered  = indexBps ≤ thresholdBps         (equality triggers)
 *
 * Floor rounding can make a true ratio up to <1 bps above the threshold trigger; this is the
 * documented, deterministic rule and the future contract applies the same `<=` comparison.
 */
import { ClimateError, type SrpnResult } from "./types";

export const BPS_PER_UNIT = 10_000;

function assertDmm(v: number, label: string): void {
  if (!Number.isSafeInteger(v)) throw new ClimateError("INVALID_VALUE", `${label} must be an integer dmm value, got ${v}`);
  if (v < 0) throw new ClimateError("NEGATIVE_VALUE", `${label} must be non-negative, got ${v}`);
}

export function sumDmm(values: readonly number[]): number {
  let total = 0n;
  values.forEach((v, i) => {
    assertDmm(v, `value[${i}]`);
    total += BigInt(v);
  });
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new ClimateError("INVALID_VALUE", "sum exceeds safe integer range");
  return Number(total);
}

export interface SrpnInput {
  observedTotalDmm: number;
  baselineSeasonTotalsDmm: readonly number[];
  thresholdBps: number;
}

export function computeSrpn(input: SrpnInput): SrpnResult {
  const { observedTotalDmm, baselineSeasonTotalsDmm, thresholdBps } = input;
  if (!Number.isSafeInteger(thresholdBps) || thresholdBps < 1 || thresholdBps > BPS_PER_UNIT) {
    throw new ClimateError("INVALID_THRESHOLD", `thresholdBps must be an integer in 1..10000, got ${thresholdBps}`);
  }
  assertDmm(observedTotalDmm, "observedTotalDmm");
  if (baselineSeasonTotalsDmm.length === 0) throw new ClimateError("INVALID_BASELINE", "baseline has no seasons");
  const baselineSumDmm = sumDmm(baselineSeasonTotalsDmm);
  if (baselineSumDmm === 0) throw new ClimateError("ZERO_BASELINE", "baseline total is zero; percent of normal is undefined");

  const n = baselineSeasonTotalsDmm.length;
  const indexBps = Number((BigInt(observedTotalDmm) * BigInt(BPS_PER_UNIT) * BigInt(n)) / BigInt(baselineSumDmm));

  return {
    observedTotalDmm,
    baselineSeasonTotalsDmm: [...baselineSeasonTotalsDmm],
    baselineSumDmm,
    baselineYears: n,
    indexBps,
    deficitBps: BPS_PER_UNIT - indexBps,
    thresholdBps,
    triggered: indexBps <= thresholdBps,
  };
}

// ---------------------------------------------------------------------------------------------
// Presentation helpers. Display only — never used for decisions or hashing.
// ---------------------------------------------------------------------------------------------

function formatFixed(value: number, divisor: number, decimals: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / divisor);
  const frac = String(abs % divisor).padStart(decimals, "0");
  return `${sign}${whole}.${frac}`;
}

/** 3363 → "33.63" (percent of normal). */
export function formatBpsAsPercent(bps: number): string {
  return formatFixed(bps, 100, 2);
}

/** 787 → "78.7" (mm). */
export function formatDmmAsMm(dmm: number): string {
  return formatFixed(dmm, 10, 1);
}

/** Baseline mean S/N rounded half-up to a whole dmm (display only). */
export function baselineMeanDmmRounded(baselineSumDmm: number, years: number): number {
  return Number((2n * BigInt(baselineSumDmm) + BigInt(years)) / (2n * BigInt(years)));
}

/** Exact deficit (mean − T) in dmm as a rational numerator/denominator. Positive = deficit. */
export function deficitDmmRational(observedTotalDmm: number, baselineSumDmm: number, years: number) {
  return { numerator: baselineSumDmm - years * observedTotalDmm, denominator: years };
}

/** Sample z-score of T against the baseline totals (informational only; floating point). */
export function zScore(observedTotalDmm: number, baselineSeasonTotalsDmm: readonly number[]): number | null {
  const n = baselineSeasonTotalsDmm.length;
  if (n < 2) return null;
  const mean = baselineSeasonTotalsDmm.reduce((a, b) => a + b, 0) / n;
  const variance = baselineSeasonTotalsDmm.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  if (variance === 0) return null;
  return (observedTotalDmm - mean) / Math.sqrt(variance);
}
