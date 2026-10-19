/**
 * Evidence artifact (rilva.evidence.v1).
 *
 * Two different hashes, never confused:
 *  - Raw snapshot integrity: SHA-256 of the exact bytes received from Open-Meteo. Lives in
 *    provenance only, because live bytes change on every request (generationtime_ms).
 *  - Evidence digest: keccak256(UTF-8(JCS(core))). The core holds only normalised inputs and
 *    integer results, so live and snapshot data with equal values yield the same digest. This is
 *    the bytes32 the future EIP-712 attestation signs; Solidity `keccak256(bytes(canonicalJson))`
 *    over the same UTF-8 bytes gives the same value.
 *
 * A valid digest proves the artifact was not altered. It does not prove the rainfall estimate is
 * correct or that drought impact occurred.
 */
import { keccak256, stringToBytes, type Hex } from "viem";
import { canonicalize } from "./canonical";
import { seasonDatesForYear, seasonWindowOf, enumerateDates } from "./dates";
import { assertValidSpec } from "./scenarios";
import { computeSrpn, sumDmm } from "./srpn";
import { OPEN_METEO_ARCHIVE_ENDPOINT } from "./source";
import { ClimateError, type ClimateSpec, type DailySeries, type IsoDate, type ResolvedGrid, type SrpnResult } from "./types";
import { valuesForDates } from "./validate";

export const EVIDENCE_SCHEMA = "rilva.evidence.v1" as const;
export const SERIES_SCHEMA = "rilva.series.v1" as const;

export interface EvidenceCore {
  schema: typeof EVIDENCE_SCHEMA;
  algorithm: "SRPN-v1";
  specHash: Hex;
  spec: ClimateSpec;
  source: {
    provider: "open-meteo";
    endpoint: string;
    model: "era5";
    variable: "precipitation_sum";
    unit: "mm";
    normalizedUnit: "dmm";
    timezone: string;
  };
  location: {
    requested: { latitude: number; longitude: number };
    resolved: { latitude: number; longitude: number; elevation: number; utcOffsetSeconds: number };
  };
  periods: {
    observed: { start: IsoDate; end: IsoDate; days: number };
    baseline: { startYear: number; endYear: number; years: number; daysPerSeason: number };
  };
  data: {
    /** keccak256 of the normalised [date, dmm] series actually used (observed + baseline seasons). */
    seriesDigest: Hex;
    observedDailyDmm: number[];
    baselineSeasonTotalsDmm: number[];
  };
  result: Omit<SrpnResult, "baselineSeasonTotalsDmm">;
}

export interface EvidenceArtifact {
  core: EvidenceCore;
  evidenceDigest: Hex;
}

const toHashBytes = (value: unknown) => stringToBytes(canonicalize(value));

export function canonicalSpec(spec: ClimateSpec): string {
  return canonicalize(spec);
}

/** keccak256 of the canonical spec string (stored on-chain as `specHash` in Phase 2). */
export function specHash(spec: ClimateSpec): Hex {
  return keccak256(toHashBytes(spec));
}

/** keccak256 over the normalised series; entries must be strictly increasing by date. */
export function seriesDigest(grid: ResolvedGrid, entries: Array<[IsoDate, number]>): Hex {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]![0] <= entries[i - 1]![0]) {
      throw new ClimateError("UNEXPECTED_DATE", `series entries out of order at ${entries[i]![0]}`);
    }
  }
  return keccak256(
    toHashBytes({
      schema: SERIES_SCHEMA,
      grid: {
        latitude: grid.latitude,
        longitude: grid.longitude,
        elevation: grid.elevation,
        utcOffsetSeconds: grid.utcOffsetSeconds,
        timezone: grid.timezone,
      },
      variable: "precipitation_sum",
      unit: "dmm",
      days: entries,
    }),
  );
}

export function evidenceDigest(core: EvidenceCore): Hex {
  return keccak256(toHashBytes(core));
}

export function buildEvidence(spec: ClimateSpec, series: DailySeries): EvidenceArtifact {
  assertValidSpec(spec);
  if (series.grid.timezone !== spec.source.timezone) {
    throw new ClimateError("UNEXPECTED_TIMEZONE", `series timezone ${series.grid.timezone} != spec ${spec.source.timezone}`);
  }

  const window = seasonWindowOf(spec.period.start, spec.period.end);
  const observedDates = enumerateDates(spec.period.start, spec.period.end);
  const observedDailyDmm = valuesForDates(series, observedDates);

  const entries: Array<[IsoDate, number]> = [];
  const baselineSeasonTotalsDmm: number[] = [];
  for (let y = spec.baseline.startYear; y <= spec.baseline.endYear; y++) {
    const dates = seasonDatesForYear(window, y);
    const values = valuesForDates(series, dates);
    dates.forEach((d, i) => entries.push([d, values[i]!]));
    baselineSeasonTotalsDmm.push(sumDmm(values));
  }
  observedDates.forEach((d, i) => entries.push([d, observedDailyDmm[i]!]));
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const srpn = computeSrpn({
    observedTotalDmm: sumDmm(observedDailyDmm),
    baselineSeasonTotalsDmm,
    thresholdBps: spec.thresholdBps,
  });
  const { baselineSeasonTotalsDmm: _omit, ...result } = srpn;
  void _omit;

  const core: EvidenceCore = {
    schema: EVIDENCE_SCHEMA,
    algorithm: "SRPN-v1",
    specHash: specHash(spec),
    spec,
    source: {
      provider: "open-meteo",
      endpoint: OPEN_METEO_ARCHIVE_ENDPOINT,
      model: "era5",
      variable: "precipitation_sum",
      unit: "mm",
      normalizedUnit: "dmm",
      timezone: spec.source.timezone,
    },
    location: {
      requested: { latitude: spec.location.latitude, longitude: spec.location.longitude },
      resolved: {
        latitude: series.grid.latitude,
        longitude: series.grid.longitude,
        elevation: series.grid.elevation,
        utcOffsetSeconds: series.grid.utcOffsetSeconds,
      },
    },
    periods: {
      observed: { start: spec.period.start, end: spec.period.end, days: observedDates.length },
      baseline: {
        startYear: spec.baseline.startYear,
        endYear: spec.baseline.endYear,
        years: baselineSeasonTotalsDmm.length,
        daysPerSeason: observedDates.length,
      },
    },
    data: {
      seriesDigest: seriesDigest(series.grid, entries),
      observedDailyDmm,
      baselineSeasonTotalsDmm,
    },
    result,
  };

  return { core, evidenceDigest: evidenceDigest(core) };
}

export interface ArtifactCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Offline self-consistency check of an artifact (e.g. a downloaded JSON file):
 * digest matches the core, spec hash matches the spec, and the result follows from the data.
 * It cannot re-check `seriesDigest` without the source series — use getClimateEvidence for that.
 */
export function verifyEvidenceArtifact(artifact: EvidenceArtifact): ArtifactCheck {
  const problems: string[] = [];
  try {
    if (evidenceDigest(artifact.core) !== artifact.evidenceDigest) problems.push("evidence digest does not match core");
    if (specHash(artifact.core.spec) !== artifact.core.specHash) problems.push("spec hash does not match spec");
    const r = artifact.core.result;
    const recomputed = computeSrpn({
      observedTotalDmm: sumDmm(artifact.core.data.observedDailyDmm),
      baselineSeasonTotalsDmm: artifact.core.data.baselineSeasonTotalsDmm,
      thresholdBps: artifact.core.spec.thresholdBps,
    });
    if (recomputed.observedTotalDmm !== r.observedTotalDmm) problems.push("observed total does not match daily values");
    if (recomputed.baselineSumDmm !== r.baselineSumDmm) problems.push("baseline sum does not match season totals");
    if (recomputed.indexBps !== r.indexBps) problems.push("indexBps does not follow from the data");
    if (recomputed.triggered !== r.triggered || r.thresholdBps !== artifact.core.spec.thresholdBps) {
      problems.push("trigger decision does not follow from the threshold");
    }
  } catch (e) {
    problems.push(e instanceof Error ? e.message : String(e));
  }
  return { ok: problems.length === 0, problems };
}
