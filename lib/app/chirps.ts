/**
 * CHIRPS v3.0 point values at Yabelo (grid col 4361, row 1102), as published in CLIMATE_DATA.md §3.2
 * (read via HTTP Range requests on 2026-10-19). INFORMATIONAL ONLY — never an input to eligibility,
 * the index, the evidence hash or the contract. Only the three replay seasons were retrieved.
 */
export const CHIRPS_SOURCE = {
  label: "CHIRPS v3.0 final, 3-monthly, 0.05°",
  citation: "Funk et al., CHIRPS v3.0, Climate Hazards Center, UCSB",
  url: "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/",
  doc: "CLIMATE_DATA.md §3.2",
  accessed: "2026-10-19",
} as const;

export const CHIRPS_OND: Readonly<Record<number, { mm: string; percentOfNormal: string }>> = {
  2021: { mm: "88.9", percentOfNormal: "52.5" },
  2022: { mm: "92.8", percentOfNormal: "54.8" },
  2023: { mm: "238.8", percentOfNormal: "140.9" },
};
