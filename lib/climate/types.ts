/**
 * Shared types for the SRPN-v1 climate engine.
 *
 * Units glossary:
 *  - mm   : millimetres as returned by Open-Meteo (raw, untrusted).
 *  - dmm  : integer tenths of a millimetre (normalised; 1.6 mm → 16 dmm).
 *  - bps  : integer basis points; 10000 bps = 100 % of normal, 6000 bps = 60 %.
 */

/** ISO civil date `YYYY-MM-DD` (no time, no timezone). */
export type IsoDate = string;

export type ClimateErrorCode =
  | "MALFORMED_RESPONSE"
  | "UPSTREAM_ERROR"
  | "UNEXPECTED_UNIT"
  | "UNEXPECTED_TIMEZONE"
  | "LENGTH_MISMATCH"
  | "DUPLICATE_DATE"
  | "MISSING_DATE"
  | "UNEXPECTED_DATE"
  | "NULL_VALUE"
  | "NEGATIVE_VALUE"
  | "INVALID_VALUE"
  | "PRECISION_EXCEEDED"
  | "GRID_MISMATCH"
  | "INVALID_DATE"
  | "INVALID_SEASON"
  | "LEAP_DAY_UNSUPPORTED"
  | "INVALID_BASELINE"
  | "ZERO_BASELINE"
  | "INVALID_THRESHOLD"
  | "INVALID_SPEC"
  | "NETWORK_TIMEOUT"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "SNAPSHOT_MISSING"
  | "SNAPSHOT_INTEGRITY"
  | "NON_CANONICAL_VALUE";

/** Every failure in the climate engine is a ClimateError with a stable machine-readable code. */
export class ClimateError extends Error {
  readonly code: ClimateErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ClimateErrorCode, message: string, details?: Record<string, unknown>) {
    super(`${code}: ${message}`);
    this.name = "ClimateError";
    this.code = code;
    this.details = details;
  }
}

/** Grid cell the upstream API actually used (it snaps the requested point to the model grid). */
export interface ResolvedGrid {
  latitude: number;
  longitude: number;
  elevation: number;
  utcOffsetSeconds: number;
  timezone: string;
}

/** A validated, normalised daily precipitation series. Dates are contiguous and unique. */
export interface DailySeries {
  grid: ResolvedGrid;
  /** Contiguous inclusive dates. */
  dates: IsoDate[];
  /** precipitation_sum in dmm, same length and order as `dates`. */
  dmm: number[];
}

/** Season as month/day bounds within a single calendar year, both inclusive. */
export interface SeasonWindow {
  startMonthDay: string; // "MM-DD"
  endMonthDay: string; // "MM-DD"
}

/** The fixed inputs that define an SRPN-v1 computation (the campaign "spec"). */
export interface ClimateSpec {
  schema: "rilva.spec.v1";
  method: "SRPN-v1";
  replay: boolean;
  location: { label: string; latitude: number; longitude: number };
  source: {
    provider: "open-meteo";
    model: "era5";
    variable: "precipitation_sum";
    timezone: string;
  };
  period: { start: IsoDate; end: IsoDate };
  baseline: { startYear: number; endYear: number };
  thresholdBps: number;
}

/** Pure SRPN-v1 result; all integers. */
export interface SrpnResult {
  observedTotalDmm: number; // T
  baselineSeasonTotalsDmm: number[]; // B_y, ordered by year
  baselineSumDmm: number; // S
  baselineYears: number; // N
  indexBps: number; // floor(T·10000·N / S)
  deficitBps: number; // 10000 − indexBps (negative = surplus)
  thresholdBps: number;
  triggered: boolean; // indexBps <= thresholdBps
}

export type ProvenanceMode = "live" | "snapshot";

/** Where the observations came from. Never part of the evidence digest. */
export interface SourceProvenance {
  mode: ProvenanceMode;
  /** True when live retrieval was attempted, failed, and a saved snapshot was used instead. */
  fellBackFromLive: boolean;
  liveError?: string;
  documents: Array<{
    id: string;
    url: string;
    retrievedAt: string;
    sha256: string;
    bytes: number;
  }>;
  attribution: string;
}
