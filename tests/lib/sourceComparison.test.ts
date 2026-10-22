/**
 * ERA5 vs CHIRPS v3 per season. ERA5 values come from the committed snapshots (golden indices);
 * CHIRPS values are the cited CLIMATE_DATA.md §3.2 figures. Informational only.
 */
import { describe, expect, it } from "vitest";
import { compareSources } from "@/lib/app/chirps";

describe("compareSources", () => {
  const rows = compareSources(
    [
      { key: "OND 2021", era5Bps: 3363 },
      { key: "MAM 2021", era5Bps: 5468 },
      { key: "OND 2023", era5Bps: 21322 },
      { key: "OND 1999", era5Bps: 9000 },
    ],
    6000,
  );

  it("pairs each season with its cited CHIRPS percentage and skips seasons without one", () => {
    expect(rows.map((r) => r.key)).toEqual(["OND 2021", "MAM 2021", "OND 2023"]);
    expect(rows[0]).toMatchObject({ era5Pct: "33.63", chirpsPct: "52.5", ruleEra5: true, ruleChirps: true, sourcesAgree: true });
  });

  it("flags MAM 2021, where the rule outcome depends on the data source", () => {
    expect(rows[1]).toMatchObject({ era5Pct: "54.68", chirpsPct: "101.4", ruleEra5: true, ruleChirps: false, sourcesAgree: false });
  });

  it("gap is reported in percentage points, exactly from the inputs", () => {
    expect(rows[1]!.gapPp).toBe("46.72");
    expect(rows[2]!.gapPp).toBe("72.32");
  });
});
