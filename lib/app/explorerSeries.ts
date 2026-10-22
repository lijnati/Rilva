/**
 * Climate Explorer data model: every OND season (baseline + observed replays) at one grid cell,
 * derived only from verified evidence cores. No new maths — per-season indices use SRPN-v1's
 * computeSrpn against the same 1991–2020 baseline, so they match the attested numbers exactly.
 */
import type { EvidenceArtifact, EvidenceCore } from "../climate";
import { baselineMeanDmmRounded, computeSrpn } from "../climate/srpn";

export interface SeasonPoint {
  year: number;
  totalDmm: number;
  /** floor(T·10000·N/S) against the shared baseline. For baseline years this is informational only. */
  indexBps: number;
  inBaseline: boolean;
}

export interface ObservedSeason {
  year: number;
  start: string;
  end: string;
  totalDmm: number;
  indexBps: number;
  deficitBps: number;
  triggered: boolean;
  observedDays: number;
  evidenceDigest: `0x${string}`;
  specHash: `0x${string}`;
}

export interface SeasonSeries {
  location: EvidenceCore["location"] & { label: string };
  source: EvidenceCore["source"];
  baseline: { startYear: number; endYear: number; years: number; sumDmm: number; meanDmm: number; totalsDmm: number[] };
  thresholdBps: number;
  points: SeasonPoint[];
  observed: ObservedSeason[];
}

function sameBaseline(a: EvidenceCore, b: EvidenceCore): boolean {
  const x = a.data.baselineSeasonTotalsDmm;
  const y = b.data.baselineSeasonTotalsDmm;
  return (
    a.periods.baseline.startYear === b.periods.baseline.startYear &&
    a.periods.baseline.endYear === b.periods.baseline.endYear &&
    x.length === y.length &&
    x.every((v, i) => v === y[i]) &&
    a.location.resolved.latitude === b.location.resolved.latitude &&
    a.location.resolved.longitude === b.location.resolved.longitude &&
    a.spec.thresholdBps === b.spec.thresholdBps &&
    a.source.model === b.source.model
  );
}

/**
 * Distance of a season total from the baseline mean S/N, rounded half-up to a whole dmm (display only;
 * exact integer arithmetic, never used for decisions).
 */
export function deficitVsNormal(totalDmm: number, baselineSumDmm: number, years: number): { kind: "deficit" | "surplus" | "normal"; dmm: number } {
  const num = BigInt(baselineSumDmm) - BigInt(years) * BigInt(totalDmm); // N·(mean − T)
  const den = BigInt(years);
  if (num === 0n) return { kind: "normal", dmm: 0 };
  const abs = num < 0n ? -num : num;
  return { kind: num > 0n ? "deficit" : "surplus", dmm: Number((2n * abs + den) / (2n * den)) };
}

export function buildSeasonSeries(artifacts: readonly EvidenceArtifact[]): SeasonSeries {
  const first = artifacts[0]?.core;
  if (!first) throw new Error("buildSeasonSeries needs at least one evidence artifact");
  for (const a of artifacts) {
    if (!sameBaseline(first, a.core)) throw new Error("evidence cores do not share one baseline, grid, model and threshold");
  }

  const { startYear, endYear } = first.periods.baseline;
  const totals = first.data.baselineSeasonTotalsDmm;
  const thresholdBps = first.spec.thresholdBps;
  const indexOf = (t: number) => computeSrpn({ observedTotalDmm: t, baselineSeasonTotalsDmm: totals, thresholdBps }).indexBps;

  const points: SeasonPoint[] = totals.map((t, i) => ({ year: startYear + i, totalDmm: t, indexBps: indexOf(t), inBaseline: true }));

  const observed: ObservedSeason[] = artifacts
    .map(({ core, evidenceDigest }) => ({
      year: Number(core.periods.observed.start.slice(0, 4)),
      start: core.periods.observed.start,
      end: core.periods.observed.end,
      totalDmm: core.result.observedTotalDmm,
      indexBps: core.result.indexBps,
      deficitBps: core.result.deficitBps,
      triggered: core.result.triggered,
      observedDays: core.periods.observed.days,
      evidenceDigest,
      specHash: core.specHash,
    }))
    .sort((a, b) => a.year - b.year);

  for (const o of observed) points.push({ year: o.year, totalDmm: o.totalDmm, indexBps: o.indexBps, inBaseline: false });
  points.sort((a, b) => a.year - b.year);

  const sumDmm = first.result.baselineSumDmm;
  return {
    location: { ...first.location, label: first.spec.location.label },
    source: first.source,
    baseline: { startYear, endYear, years: totals.length, sumDmm, meanDmm: baselineMeanDmmRounded(sumDmm, totals.length), totalsDmm: [...totals] },
    thresholdBps,
    points,
    observed,
  };
}
