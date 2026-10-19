/**
 * Validation of untrusted Open-Meteo archive responses into normalised DailySeries.
 * Nothing here fills gaps or guesses: any anomaly is a ClimateError.
 */
import { enumerateDates, parseIsoDate } from "./dates";
import { ClimateError, type DailySeries, type IsoDate, type ResolvedGrid } from "./types";

/** mm → integer tenths of mm. Open-Meteo precipitation is reported at 0.1 mm resolution. */
export function normalizeMm(value: unknown, date: string): number {
  if (value === null) throw new ClimateError("NULL_VALUE", `precipitation is null on ${date}`, { date });
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ClimateError("INVALID_VALUE", `precipitation is not a finite number on ${date}`, { date, value });
  }
  if (value < 0) throw new ClimateError("NEGATIVE_VALUE", `precipitation ${value} mm on ${date}`, { date, value });
  const scaled = value * 10;
  const dmm = Math.round(scaled);
  if (Math.abs(scaled - dmm) > 1e-6 || !Number.isSafeInteger(dmm)) {
    throw new ClimateError("PRECISION_EXCEEDED", `precipitation ${value} mm on ${date} is finer than 0.1 mm`, { date, value });
  }
  return dmm;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finite(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ClimateError("MALFORMED_RESPONSE", `field ${field} is missing or not a finite number`);
  }
  return v;
}

export interface ExpectedRange {
  start: IsoDate;
  end: IsoDate;
  timezone: string;
}

/** Validates one archive response that must cover exactly `[start, end]` with no gaps. */
export function parseOpenMeteoDaily(body: unknown, expected: ExpectedRange): DailySeries {
  if (!isRecord(body)) throw new ClimateError("MALFORMED_RESPONSE", "response is not a JSON object");
  if (body.error === true) {
    const reason = typeof body.reason === "string" ? body.reason : "unspecified";
    throw new ClimateError("UPSTREAM_ERROR", `Open-Meteo reported an error: ${reason}`);
  }

  const units = body.daily_units;
  if (!isRecord(units) || units.precipitation_sum !== "mm") {
    throw new ClimateError("UNEXPECTED_UNIT", `daily_units.precipitation_sum must be "mm"`, {
      got: isRecord(units) ? units.precipitation_sum : undefined,
    });
  }
  if (body.timezone !== expected.timezone) {
    throw new ClimateError("UNEXPECTED_TIMEZONE", `expected timezone ${expected.timezone}, got ${String(body.timezone)}`);
  }

  const grid: ResolvedGrid = {
    latitude: finite(body.latitude, "latitude"),
    longitude: finite(body.longitude, "longitude"),
    elevation: finite(body.elevation, "elevation"),
    utcOffsetSeconds: finite(body.utc_offset_seconds, "utc_offset_seconds"),
    timezone: expected.timezone,
  };

  const daily = body.daily;
  if (!isRecord(daily) || !Array.isArray(daily.time) || !Array.isArray(daily.precipitation_sum)) {
    throw new ClimateError("MALFORMED_RESPONSE", "daily.time and daily.precipitation_sum must be arrays");
  }
  const time: unknown[] = daily.time;
  const values: unknown[] = daily.precipitation_sum;
  if (time.length !== values.length) {
    throw new ClimateError("LENGTH_MISMATCH", `daily.time has ${time.length} entries, precipitation_sum has ${values.length}`);
  }

  const byDate = new Map<IsoDate, unknown>();
  time.forEach((t, i) => {
    if (typeof t !== "string") throw new ClimateError("INVALID_DATE", `daily.time[${i}] is not a string`);
    parseIsoDate(t);
    if (byDate.has(t)) throw new ClimateError("DUPLICATE_DATE", `date ${t} appears more than once`, { date: t });
    byDate.set(t, values[i]);
  });

  const dates = enumerateDates(expected.start, expected.end);
  const expectedSet = new Set(dates);
  for (const t of byDate.keys()) {
    if (!expectedSet.has(t)) throw new ClimateError("UNEXPECTED_DATE", `date ${t} is outside ${expected.start}..${expected.end}`, { date: t });
  }
  const dmm = dates.map((d) => {
    if (!byDate.has(d)) throw new ClimateError("MISSING_DATE", `no observation for ${d}`, { date: d });
    return normalizeMm(byDate.get(d), d);
  });

  return { grid, dates, dmm };
}

function sameGrid(a: ResolvedGrid, b: ResolvedGrid): boolean {
  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.elevation === b.elevation &&
    a.utcOffsetSeconds === b.utcOffsetSeconds &&
    a.timezone === b.timezone
  );
}

/** Merges validated chunks from the same grid cell. Chunks may be non-contiguous but must not overlap. */
export function mergeSeries(parts: DailySeries[]): DailySeries {
  const first = parts[0];
  if (!first) throw new ClimateError("MALFORMED_RESPONSE", "no series to merge");
  const map = new Map<IsoDate, number>();
  for (const p of parts) {
    if (!sameGrid(first.grid, p.grid)) {
      throw new ClimateError("GRID_MISMATCH", "chunks resolved to different grid cells", { a: first.grid, b: p.grid });
    }
    p.dates.forEach((d, i) => {
      if (map.has(d)) throw new ClimateError("DUPLICATE_DATE", `date ${d} appears in more than one chunk`, { date: d });
      map.set(d, p.dmm[i]!);
    });
  }
  const dates = [...map.keys()].sort();
  return { grid: { ...first.grid }, dates, dmm: dates.map((d) => map.get(d)!) };
}

/** Values for exactly these dates; any absent date is an error, never a zero. */
export function valuesForDates(series: DailySeries, dates: IsoDate[]): number[] {
  const index = new Map<IsoDate, number>();
  series.dates.forEach((d, i) => index.set(d, series.dmm[i]!));
  return dates.map((d) => {
    const v = index.get(d);
    if (v === undefined) throw new ClimateError("MISSING_DATE", `no observation for ${d}`, { date: d });
    return v;
  });
}
