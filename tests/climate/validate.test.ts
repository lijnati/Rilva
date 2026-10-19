import { describe, expect, it } from "vitest";
import { mergeSeries, normalizeMm, parseOpenMeteoDaily, valuesForDates } from "@/lib/climate/validate";
import { syntheticResponse } from "../helpers/synthetic";

const TZ = "Africa/Addis_Ababa";
const expect3 = { start: "2021-10-01", end: "2021-10-03", timezone: TZ };

describe("normalizeMm", () => {
  it("converts 0.1 mm precision values to integer dmm exactly", () => {
    expect(normalizeMm(1.6, "d")).toBe(16);
    expect(normalizeMm(0, "d")).toBe(0);
    expect(normalizeMm(10.8, "d")).toBe(108);
    expect(normalizeMm(0.3, "d")).toBe(3); // 0.3*10 = 3.0000000000000004 in IEEE-754
    expect(normalizeMm(123.7, "d")).toBe(1237);
  });

  it("rejects null, negative, non-finite, non-number and over-precise values", () => {
    expect(() => normalizeMm(null, "d")).toThrow(/NULL_VALUE/);
    expect(() => normalizeMm(-0.1, "d")).toThrow(/NEGATIVE_VALUE/);
    expect(() => normalizeMm(Number.NaN, "d")).toThrow(/INVALID_VALUE/);
    expect(() => normalizeMm(Number.POSITIVE_INFINITY, "d")).toThrow(/INVALID_VALUE/);
    expect(() => normalizeMm("1.0", "d")).toThrow(/INVALID_VALUE/);
    expect(() => normalizeMm(1.25, "d")).toThrow(/PRECISION_EXCEEDED/);
  });
});

describe("parseOpenMeteoDaily", () => {
  it("parses a valid response and preserves the resolved grid", () => {
    const s = parseOpenMeteoDaily(syntheticResponse({ start: "2021-10-01", end: "2021-10-03", value: (_d, i) => [1.6, 0, 10.8][i]! }), expect3);
    expect(s.grid).toEqual({ latitude: 5, longitude: 38, elevation: 1891, utcOffsetSeconds: 10800, timezone: TZ });
    expect(s.dates).toEqual(["2021-10-01", "2021-10-02", "2021-10-03"]);
    expect(s.dmm).toEqual([16, 0, 108]);
  });

  it.each([null, 42, "x", [], {}, { daily: {} }])("rejects malformed body %j", (body) => {
    expect(() => parseOpenMeteoDaily(body, expect3)).toThrow(/MALFORMED_RESPONSE|UNEXPECTED_UNIT/);
  });

  it("surfaces upstream errors", () => {
    expect(() => parseOpenMeteoDaily({ error: true, reason: "out of range" }, expect3)).toThrow(/UPSTREAM_ERROR.*out of range/);
  });

  it("rejects wrong unit and timezone", () => {
    expect(() => parseOpenMeteoDaily(syntheticResponse({ ...expect3, unit: "inch" }), expect3)).toThrow(/UNEXPECTED_UNIT/);
    expect(() => parseOpenMeteoDaily(syntheticResponse({ ...expect3, timezone: "GMT" }), expect3)).toThrow(/UNEXPECTED_TIMEZONE/);
  });

  function withDaily(time: unknown, values: unknown) {
    const r = syntheticResponse(expect3);
    return { ...r, daily: { time, precipitation_sum: values } };
  }

  it("rejects inconsistent lengths", () => {
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-02", "2021-10-03"], [1, 2]), expect3)).toThrow(/LENGTH_MISMATCH/);
  });

  it("rejects duplicate dates", () => {
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-01", "2021-10-03"], [1, 2, 3]), expect3)).toThrow(/DUPLICATE_DATE/);
  });

  it("rejects missing dates", () => {
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-03"], [1, 3]), expect3)).toThrow(/MISSING_DATE.*2021-10-02/);
  });

  it("rejects dates outside the requested range and malformed dates", () => {
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-02", "2021-10-03", "2021-10-04"], [1, 2, 3, 4]), expect3)).toThrow(/UNEXPECTED_DATE/);
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-02", "2021-10-3"], [1, 2, 3]), expect3)).toThrow(/INVALID_DATE/);
  });

  it("rejects null and negative precipitation", () => {
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-02", "2021-10-03"], [1, null, 3]), expect3)).toThrow(/NULL_VALUE.*2021-10-02/);
    expect(() => parseOpenMeteoDaily(withDaily(["2021-10-01", "2021-10-02", "2021-10-03"], [1, -2, 3]), expect3)).toThrow(/NEGATIVE_VALUE/);
  });

  it("returns dates in calendar order even if upstream order differs", () => {
    const s = parseOpenMeteoDaily(withDaily(["2021-10-03", "2021-10-01", "2021-10-02"], [3, 1, 2]), expect3);
    expect(s.dates).toEqual(["2021-10-01", "2021-10-02", "2021-10-03"]);
    expect(s.dmm).toEqual([10, 20, 30]);
  });
});

describe("mergeSeries / valuesForDates", () => {
  const a = parseOpenMeteoDaily(syntheticResponse({ start: "2021-10-01", end: "2021-10-02" }), { start: "2021-10-01", end: "2021-10-02", timezone: TZ });
  const b = parseOpenMeteoDaily(syntheticResponse({ start: "2022-10-01", end: "2022-10-02", value: () => 2 }), { start: "2022-10-01", end: "2022-10-02", timezone: TZ });

  it("merges non-overlapping chunks from the same grid cell", () => {
    const m = mergeSeries([b, a]);
    expect(m.dates).toEqual(["2021-10-01", "2021-10-02", "2022-10-01", "2022-10-02"]);
    expect(valuesForDates(m, ["2022-10-02", "2021-10-01"])).toEqual([20, 10]);
  });

  it("rejects overlapping chunks and different grid cells", () => {
    expect(() => mergeSeries([a, a])).toThrow(/DUPLICATE_DATE/);
    const c = parseOpenMeteoDaily(syntheticResponse({ start: "2023-10-01", end: "2023-10-01", latitude: 5.25 }), { start: "2023-10-01", end: "2023-10-01", timezone: TZ });
    expect(() => mergeSeries([a, c])).toThrow(/GRID_MISMATCH/);
  });

  it("refuses to invent values for absent dates", () => {
    expect(() => valuesForDates(a, ["2021-10-03"])).toThrow(/MISSING_DATE/);
  });
});
