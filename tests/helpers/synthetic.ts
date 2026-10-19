/**
 * SYNTHETIC test data builders. Nothing produced here is real climate data and it must never be
 * shipped as evidence. Real observations live only in public/snapshots (see tests/climate/golden.test.ts).
 */
import { enumerateDates } from "@/lib/climate/dates";

export const SYNTHETIC_LABEL = "SYNTHETIC — test data, not an observation";

export interface SyntheticResponseOptions {
  start: string;
  end: string;
  /** mm value per date; default 1.0 mm every day. */
  value?: (date: string, index: number) => number | null;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  utcOffsetSeconds?: number;
  generationtimeMs?: number;
  unit?: string;
}

/** Builds an object shaped like an Open-Meteo archive response. */
export function syntheticResponse(o: SyntheticResponseOptions): Record<string, unknown> {
  const time = enumerateDates(o.start, o.end);
  const value = o.value ?? (() => 1.0);
  return {
    latitude: o.latitude ?? 5.0,
    longitude: o.longitude ?? 38.0,
    generationtime_ms: o.generationtimeMs ?? 0.5,
    utc_offset_seconds: o.utcOffsetSeconds ?? 10800,
    timezone: o.timezone ?? "Africa/Addis_Ababa",
    timezone_abbreviation: "GMT+3",
    elevation: o.elevation ?? 1891.0,
    daily_units: { time: "iso8601", precipitation_sum: o.unit ?? "mm" },
    daily: { time, precipitation_sum: time.map((d, i) => value(d, i)) },
  };
}

/** Serialises like the upstream API does (2-decimal numbers), so raw-byte hashing is realistic. */
export function syntheticBody(o: SyntheticResponseOptions): string {
  const r = syntheticResponse(o);
  const daily = r.daily as { time: string[]; precipitation_sum: Array<number | null> };
  const values = daily.precipitation_sum.map((v) => (v === null ? "null" : v.toFixed(2))).join(",");
  const json = JSON.stringify({ ...r, daily: { time: daily.time, precipitation_sum: "__V__" } });
  return json.replace('"__V__"', `[${values}]`);
}
