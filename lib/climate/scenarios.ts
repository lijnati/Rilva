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

/**
 * Regional demo scenarios outside Ethiopia (Decision 2026-10-24, CLIMATE_DATA.md §3.4). Each uses its
 * local timezone. Brazil 2012 and India 2015 lie inside 1991–2020, so they use the 1981–2010 normal.
 */
export const MARSABIT = { label: "Marsabit, Marsabit County, Kenya", latitude: 2.33, longitude: 37.99, timezone: "Africa/Nairobi" } as const;
export const PETROLINA = { label: "Petrolina, Pernambuco, Brazil", latitude: -9.39, longitude: -40.5, timezone: "America/Bahia" } as const;
export const BEED = { label: "Beed, Marathwada, Maharashtra, India", latitude: 18.99, longitude: 75.76, timezone: "Asia/Kolkata" } as const;

function regional(place: typeof MARSABIT | typeof PETROLINA | typeof BEED, start: IsoDate, end: IsoDate, baselineStartYear: number): ClimateSpec {
  return makeSeasonSpec({
    ...place,
    start,
    end,
    baselineStartYear,
    baselineEndYear: baselineStartYear + 29,
    thresholdBps: ILLUSTRATIVE_THRESHOLD_BPS,
    replay: true,
  });
}

export const REGIONAL_SCENARIOS = {
  "marsabit-ond-2021": { title: "Marsabit OND 2021 — northern Kenya short rains", spec: regional(MARSABIT, "2021-10-01", "2021-12-31", 1991) },
  "petrolina-mam-2012": { title: "Petrolina MAM 2012 — Brazilian Sertão drought", spec: regional(PETROLINA, "2012-03-01", "2012-05-31", 1981) },
  "beed-jjas-2015": { title: "Beed JJAS 2015 — Marathwada monsoon", spec: regional(BEED, "2015-06-01", "2015-09-30", 1981) },
} as const satisfies Record<string, { title: string; spec: ClimateSpec }>;

export type RegionalScenarioId = keyof typeof REGIONAL_SCENARIOS;

/** Every demo scenario, Yabelo first. */
export const ALL_SCENARIOS = { ...SCENARIOS, ...REGIONAL_SCENARIOS } as const;
export type AnyScenarioId = keyof typeof ALL_SCENARIOS;

export function isAnyScenarioId(v: string): v is AnyScenarioId {
  return Object.hasOwn(ALL_SCENARIOS, v);
}

/** Snapshot folders under public/snapshots/open-meteo/era5/, keyed by exact location and timezone. */
const SNAPSHOT_LOCATIONS = [
  { slug: "yabelo", latitude: YABELO.latitude, longitude: YABELO.longitude, timezone: DEFAULT_TIMEZONE },
  { slug: "marsabit", ...MARSABIT },
  { slug: "petrolina", ...PETROLINA },
  { slug: "beed", ...BEED },
] as const;

export type SnapshotSlug = (typeof SNAPSHOT_LOCATIONS)[number]["slug"];
export const SNAPSHOT_SLUGS: readonly SnapshotSlug[] = SNAPSHOT_LOCATIONS.map((l) => l.slug);

/** The snapshot folder for a spec; throws SNAPSHOT_MISSING for any location the app has no saved data for. */
export function snapshotSlug(spec: ClimateSpec): SnapshotSlug {
  const hit = SNAPSHOT_LOCATIONS.find(
    (l) => l.latitude === spec.location.latitude && l.longitude === spec.location.longitude && l.timezone === spec.source.timezone,
  );
  if (!hit) {
    throw new ClimateError("SNAPSHOT_MISSING", `no saved snapshots for ${spec.location.latitude},${spec.location.longitude} (${spec.source.timezone})`);
  }
  return hit.slug;
}
