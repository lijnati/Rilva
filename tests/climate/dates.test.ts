import { describe, expect, it } from "vitest";
import {
  enumerateDates,
  isLeapYear,
  parseIsoDate,
  seasonDatesForYear,
  seasonWindowOf,
} from "@/lib/climate/dates";

describe("parseIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(parseIsoDate("2021-10-01")).toEqual({ year: 2021, month: 10, day: 1 });
    expect(parseIsoDate("2020-02-29")).toEqual({ year: 2020, month: 2, day: 29 });
  });

  it.each(["2021-02-29", "2021-13-01", "2021-00-10", "2021-1-01", "21-10-01", "2021-10-01T00:00", "", "2021-04-31"])(
    "rejects %j",
    (s) => {
      expect(() => parseIsoDate(s)).toThrow(/INVALID_DATE/);
    },
  );
});

describe("isLeapYear", () => {
  it("follows the Gregorian rule", () => {
    expect([1900, 2000, 2020, 2021, 2024, 2100].map(isLeapYear)).toEqual([false, true, true, false, true, false]);
  });
});

describe("enumerateDates", () => {
  it("is inclusive on both ends", () => {
    expect(enumerateDates("2021-12-30", "2022-01-02")).toEqual(["2021-12-30", "2021-12-31", "2022-01-01", "2022-01-02"]);
  });

  it("handles leap days", () => {
    expect(enumerateDates("2020-02-28", "2020-03-01")).toEqual(["2020-02-28", "2020-02-29", "2020-03-01"]);
    expect(enumerateDates("2021-02-28", "2021-03-01")).toEqual(["2021-02-28", "2021-03-01"]);
  });

  it("returns a single day when start == end and rejects reversed ranges", () => {
    expect(enumerateDates("2021-10-01", "2021-10-01")).toEqual(["2021-10-01"]);
    expect(() => enumerateDates("2021-10-02", "2021-10-01")).toThrow(/INVALID_DATE/);
  });

  it("OND always has 92 days and a full year has 365/366", () => {
    expect(enumerateDates("2021-10-01", "2021-12-31")).toHaveLength(92);
    expect(enumerateDates("2020-01-01", "2020-12-31")).toHaveLength(366);
    expect(enumerateDates("2021-01-01", "2021-12-31")).toHaveLength(365);
  });
});

describe("season windows", () => {
  it("derives a month/day window from a single-year period", () => {
    expect(seasonWindowOf("2021-10-01", "2021-12-31")).toEqual({ startMonthDay: "10-01", endMonthDay: "12-31" });
  });

  it("rejects periods crossing a calendar year", () => {
    expect(() => seasonWindowOf("2021-12-01", "2022-02-28")).toThrow(/INVALID_SEASON/);
  });

  it("rejects windows that contain 29 February (MVP rule) in any year", () => {
    expect(() => seasonWindowOf("2021-02-01", "2021-03-31")).toThrow(/LEAP_DAY_UNSUPPORTED/);
    expect(() => seasonWindowOf("2020-02-01", "2020-03-31")).toThrow(/LEAP_DAY_UNSUPPORTED/);
  });

  it("accepts windows ending on 28 February or starting on 1 March", () => {
    expect(() => seasonWindowOf("2021-01-01", "2021-02-28")).not.toThrow();
    expect(() => seasonWindowOf("2020-03-01", "2020-05-31")).not.toThrow();
  });

  it("maps a window onto any year", () => {
    const w = seasonWindowOf("2021-10-01", "2021-12-31");
    const d1991 = seasonDatesForYear(w, 1991);
    expect(d1991[0]).toBe("1991-10-01");
    expect(d1991.at(-1)).toBe("1991-12-31");
    expect(d1991).toHaveLength(92);
  });
});
