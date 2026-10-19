/**
 * Campaign specs for the demo. These are INPUTS only — expected outcomes are never stored here.
 * All three are retrospective replays (CLIMATE_DATA.md §3).
 */
import { seasonWindowOf } from "./dates";
import { ClimateError, type ClimateSpec, type IsoDate } from "./types";

export const DEFAULT_TIMEZONE = "Africa/Addis_Ababa";

/** Illustrative hackathon rule (60 % of normal) — not an official drought definition. */
export const ILLUSTRATIVE_THRESHOLD_BPS = 6000;

export const YABELO = {
  label: "Yabelo, Borena, Oromia, Ethiopia",
  latitude: 4.88,
  longitude: 38.08,
} as const;

export interface SeasonSpecInput {
  label: string;
  latitude: number;
  longitude: number;
  start: IsoDate;
  end: IsoDate;
  baselineStartYear: number;
  baselineEndYear: number;
  thresholdBps: number;
  replay: boolean;
  timezone?: string;
}

export function makeSeasonSpec(i: SeasonSpecInput): ClimateSpec {
  return {
    schema: "rilva.spec.v1",
    method: "SRPN-v1",
    replay: i.replay,
    location: { label: i.label, latitude: i.latitude, longitude: i.longitude },
    source: {
      provider: "open-meteo",
      model: "era5",
      variable: "precipitation_sum",
      timezone: i.timezone ?? DEFAULT_TIMEZONE,
    },
    period: { start: i.start, end: i.end },
    baseline: { startYear: i.baselineStartYear, endYear: i.baselineEndYear },
    thresholdBps: i.thresholdBps,
  };
}

/** Structural checks on a spec; throws INVALID_SPEC / INVALID_SEASON / INVALID_THRESHOLD. */
export function assertValidSpec(spec: ClimateSpec): void {
  if (spec.schema !== "rilva.spec.v1" || spec.method !== "SRPN-v1") {
    throw new ClimateError("INVALID_SPEC", `unsupported schema/method ${spec.schema}/${spec.method}`);
  }
  if (spec.source.provider !== "open-meteo" || spec.source.variable !== "precipitation_sum") {
    throw new ClimateError("INVALID_SPEC", "only open-meteo precipitation_sum is supported");
  }
  if (spec.source.model !== "era5") {
    throw new ClimateError("INVALID_SPEC", `unsupported model ${String(spec.source.model)}; SRPN-v1 requires era5`);
  }
  const { latitude, longitude } = spec.location;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ClimateError("INVALID_SPEC", `invalid coordinates ${latitude},${longitude}`);
  }
  seasonWindowOf(spec.period.start, spec.period.end);
  const { startYear, endYear } = spec.baseline;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear || startYear < 1940) {
    throw new ClimateError("INVALID_SPEC", `invalid baseline ${startYear}-${endYear}`);
  }
  const observedYear = Number(spec.period.start.slice(0, 4));
  if (observedYear >= startYear && observedYear <= endYear) {
    throw new ClimateError("INVALID_SPEC", `observed season ${observedYear} lies inside the baseline`);
  }
  if (!Number.isInteger(spec.thresholdBps) || spec.thresholdBps < 1 || spec.thresholdBps > 10000) {
    throw new ClimateError("INVALID_THRESHOLD", `thresholdBps must be 1..10000, got ${spec.thresholdBps}`);
  }
}

function yabeloOnd(year: number): ClimateSpec {
  return makeSeasonSpec({
    ...YABELO,
    start: `${year}-10-01`,
    end: `${year}-12-31`,
    baselineStartYear: 1991,
    baselineEndYear: 2020,
    thresholdBps: ILLUSTRATIVE_THRESHOLD_BPS,
    replay: true,
  });
}

export const SCENARIOS = {
  "yabelo-ond-2021": { title: "OND 2021 — primary replay", spec: yabeloOnd(2021) },
  "yabelo-ond-2022": { title: "OND 2022 — fallback replay", spec: yabeloOnd(2022) },
  "yabelo-ond-2023": { title: "OND 2023 — non-triggering replay", spec: yabeloOnd(2023) },
} as const satisfies Record<string, { title: string; spec: ClimateSpec }>;

export type ScenarioId = keyof typeof SCENARIOS;

/**
 * Reference cases that are not demo campaigns but must stay reproducible (CLIMATE_DATA.md §3–4).
 * MAM 2021 is the documented counter-example where ERA5 and CHIRPS v3 disagree.
 */
export const REFERENCE_CASES = {
  "yabelo-mam-2021": {
    title: "MAM 2021 — source-disagreement counter-example",
    spec: makeSeasonSpec({
      ...YABELO,
      start: "2021-03-01",
      end: "2021-05-31",
      baselineStartYear: 1991,
      baselineEndYear: 2020,
      thresholdBps: ILLUSTRATIVE_THRESHOLD_BPS,
      replay: true,
    }),
  },
} as const satisfies Record<string, { title: string; spec: ClimateSpec }>;

export function isScenarioId(v: string): v is ScenarioId {
  return Object.hasOwn(SCENARIOS, v);
}
