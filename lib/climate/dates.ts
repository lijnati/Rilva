/**
 * Civil-date utilities. Dates are plain `YYYY-MM-DD` strings; all arithmetic uses UTC midnights so
 * no local timezone or DST can shift a day. The Open-Meteo `timezone` parameter only decides which
 * hours belong to a day upstream — it never enters date arithmetic here.
 */
import { ClimateError, type IsoDate, type SeasonWindow } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function parseIsoDate(value: string): CivilDate {
  const m = ISO_DATE.exec(value);
  if (!m) throw new ClimateError("INVALID_DATE", `not a YYYY-MM-DD date: ${JSON.stringify(value)}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new ClimateError("INVALID_DATE", `not a calendar date: ${value}`);
  }
  return { year, month, day };
}

function toUtcMs(d: CivilDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** All dates from `start` to `end`, both inclusive. */
export function enumerateDates(start: IsoDate, end: IsoDate): IsoDate[] {
  const a = toUtcMs(parseIsoDate(start));
  const b = toUtcMs(parseIsoDate(end));
  if (b < a) throw new ClimateError("INVALID_DATE", `range end ${end} is before start ${start}`);
  const out: IsoDate[] = [];
  for (let t = a; t <= b; t += DAY_MS) out.push(fromUtcMs(t));
  return out;
}

/**
 * Month/day window for a single-year season. MVP rules (CLIMATE_DATA.md §4):
 * the period must not cross a calendar year and must not contain 29 February in any year,
 * so every baseline year has the same number of days as the observed season.
 */
export function seasonWindowOf(start: IsoDate, end: IsoDate): SeasonWindow {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  if (a.year !== b.year) throw new ClimateError("INVALID_SEASON", `season ${start}..${end} crosses a calendar year`);
  if (toUtcMs(b) < toUtcMs(a)) throw new ClimateError("INVALID_SEASON", `season end ${end} is before start ${start}`);
  const startMonthDay = start.slice(5);
  const endMonthDay = end.slice(5);
  if (startMonthDay <= "02-29" && endMonthDay >= "02-29") {
    throw new ClimateError("LEAP_DAY_UNSUPPORTED", `season ${start}..${end} spans 29 February`);
  }
  return { startMonthDay, endMonthDay };
}

export function seasonDatesForYear(window: SeasonWindow, year: number): IsoDate[] {
  const y = String(year).padStart(4, "0");
  return enumerateDates(`${y}-${window.startMonthDay}`, `${y}-${window.endMonthDay}`);
}
