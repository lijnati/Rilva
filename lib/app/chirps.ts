/**
 * CHIRPS v3.0 point values at Yabelo (grid col 4361, row 1102), as published in CLIMATE_DATA.md §3.2
 * (read via HTTP Range requests on 2026-10-19). INFORMATIONAL ONLY — never an input to eligibility,
 * the index, the evidence hash or the contract. Only these seasons were retrieved. Each percentage is
 * relative to CHIRPS' own 1991–2020 mean at that pixel.
 */
import { formatBpsAsPercent } from "../climate/srpn";

export const CHIRPS_SOURCE = {
  label: "CHIRPS v3.0 final, 3-monthly, 0.05°",
  citation: "Funk et al., CHIRPS v3.0, Climate Hazards Center, UCSB",
  url: "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/",
  doc: "CLIMATE_DATA.md §3.2",
  accessed: "2026-10-19",
} as const;

/** Keyed by season label. `mm` is only published for the OND seasons. */
export const CHIRPS_SEASONS: Readonly<Record<string, { mm?: string; percentOfNormal: string }>> = {
  "OND 2021": { mm: "88.9", percentOfNormal: "52.5" },
  "OND 2022": { mm: "92.8", percentOfNormal: "54.8" },
  "OND 2023": { mm: "238.8", percentOfNormal: "140.9" },
  "MAM 2021": { percentOfNormal: "101.4" },
};

export const CHIRPS_OND: Readonly<Record<number, { mm: string; percentOfNormal: string }>> = Object.fromEntries(
  Object.entries(CHIRPS_SEASONS)
    .filter(([k, v]) => k.startsWith("OND ") && v.mm)
    .map(([k, v]) => [Number(k.slice(4)), { mm: v.mm!, percentOfNormal: v.percentOfNormal }]),
);

/** "52.5" → 5250 basis points, exactly (string arithmetic, no floats). */
function pctToBps(pct: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(pct);
  if (!m) throw new Error(`not a percentage: ${pct}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export interface SourceComparisonRow {
  key: string;
  era5Bps: number;
  chirpsBps: number;
  era5Pct: string;
  chirpsPct: string;
  ruleEra5: boolean;
  ruleChirps: boolean;
  sourcesAgree: boolean;
  /** |ERA5 − CHIRPS| in percentage points. */
  gapPp: string;
}

/** Pairs computed ERA5 indices with cited CHIRPS values; seasons without a CHIRPS figure are skipped. */
export function compareSources(seasons: Array<{ key: string; era5Bps: number }>, thresholdBps: number): SourceComparisonRow[] {
  return seasons.flatMap(({ key, era5Bps }) => {
    const ch = CHIRPS_SEASONS[key];
    if (!ch) return [];
    const chirpsBps = pctToBps(ch.percentOfNormal);
    const ruleEra5 = era5Bps <= thresholdBps;
    const ruleChirps = chirpsBps <= thresholdBps;
    return [
      {
        key,
        era5Bps,
        chirpsBps,
        era5Pct: formatBpsAsPercent(era5Bps),
        chirpsPct: ch.percentOfNormal,
        ruleEra5,
        ruleChirps,
        sourcesAgree: ruleEra5 === ruleChirps,
        gapPp: formatBpsAsPercent(Math.abs(era5Bps - chirpsBps)),
      },
    ];
  });
}
