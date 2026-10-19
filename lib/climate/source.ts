/**
 * Network I/O for the Open-Meteo Historical Weather API (archive). The only module that talks to
 * the network; everything returned is still untrusted and must go through validate.ts.
 *
 * Request contract (docs: https://open-meteo.com/en/docs/historical-weather-api, checked 2026-10-19):
 *   GET /v1/archive?latitude&longitude&start_date&end_date&daily=precipitation_sum&timezone&models=era5
 * `models=era5` is always pinned — `best_match` mixes IFS from 2017 and breaks baseline homogeneity.
 */
import { sha256, stringToBytes, type Hex } from "viem";
import { parseIsoDate } from "./dates";
import { ClimateError, type ClimateSpec, type IsoDate } from "./types";

export const OPEN_METEO_ARCHIVE_ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";
export const OPEN_METEO_ATTRIBUTION =
  "Weather data by Open-Meteo.com (CC BY 4.0), based on ERA5 — Copernicus Climate Change Service information.";
export const OPEN_METEO_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

/** Max calendar years per request; keeps responses small and retries cheap. */
export const MAX_YEARS_PER_REQUEST = 10;

export interface ArchiveRequest {
  latitude: number;
  longitude: number;
  start: IsoDate;
  end: IsoDate;
  timezone: string;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;

export interface FetchOptions {
  fetchImpl?: FetchLike;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Additional attempts after the first. */
  retries?: number;
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface RawDocument {
  request: ArchiveRequest;
  url: string;
  body: string;
  bytes: number;
  sha256: Hex;
  retrievedAt: string;
}

export function buildArchiveUrl(r: ArchiveRequest): string {
  parseIsoDate(r.start);
  parseIsoDate(r.end);
  if (!(r.latitude >= -90 && r.latitude <= 90 && r.longitude >= -180 && r.longitude <= 180)) {
    throw new ClimateError("INVALID_SPEC", `invalid coordinates ${r.latitude},${r.longitude}`);
  }
  // Fixed parameter order so the URL itself is a stable, comparable identifier.
  const params = new URLSearchParams();
  params.set("latitude", String(r.latitude));
  params.set("longitude", String(r.longitude));
  params.set("start_date", r.start);
  params.set("end_date", r.end);
  params.set("daily", "precipitation_sum");
  params.set("timezone", r.timezone);
  params.set("models", "era5");
  return `${OPEN_METEO_ARCHIVE_ENDPOINT}?${params.toString()}`;
}

/** Baseline split into ≤10-year full-calendar-year chunks, followed by the observed period. */
export function planRequests(spec: ClimateSpec): ArchiveRequest[] {
  const base = {
    latitude: spec.location.latitude,
    longitude: spec.location.longitude,
    timezone: spec.source.timezone,
  };
  const out: ArchiveRequest[] = [];
  for (let y = spec.baseline.startYear; y <= spec.baseline.endYear; y += MAX_YEARS_PER_REQUEST) {
    const last = Math.min(y + MAX_YEARS_PER_REQUEST - 1, spec.baseline.endYear);
    out.push({ ...base, start: `${y}-01-01`, end: `${last}-12-31` });
  }
  out.push({ ...base, start: spec.period.start, end: spec.period.end });
  return out;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

/** Fetches one archive document with a bounded timeout and exponential backoff. */
export async function fetchArchiveDocument(request: ArchiveRequest, opts: FetchOptions = {}): Promise<RawDocument> {
  const fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 1_000;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? (() => new Date());
  const url = buildArchiveUrl(request);

  let lastError: ClimateError = new ClimateError("NETWORK_ERROR", "no attempt made");
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1));
    let response: Response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    } catch (e) {
      lastError = isAbort(e)
        ? new ClimateError("NETWORK_TIMEOUT", `no response within ${timeoutMs} ms from ${url}`)
        : new ClimateError("NETWORK_ERROR", `${e instanceof Error ? e.message : String(e)} (${url})`);
      continue;
    }

    let body: string;
    try {
      body = await response.text();
    } catch (e) {
      lastError = isAbort(e)
        ? new ClimateError("NETWORK_TIMEOUT", `body not received within ${timeoutMs} ms from ${url}`)
        : new ClimateError("NETWORK_ERROR", `failed reading body: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    if (response.status >= 500 || response.status === 429) {
      lastError = new ClimateError("HTTP_ERROR", `HTTP ${response.status} from ${url}`, { status: response.status });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new ClimateError("MALFORMED_RESPONSE", `HTTP ${response.status} body is not JSON (${url})`);
    }
    if (!response.ok) {
      const reason =
        typeof parsed === "object" && parsed !== null && typeof (parsed as { reason?: unknown }).reason === "string"
          ? (parsed as { reason: string }).reason
          : `HTTP ${response.status}`;
      throw new ClimateError("UPSTREAM_ERROR", `Open-Meteo rejected the request: ${reason}`, { status: response.status });
    }

    const bytes = stringToBytes(body);
    return { request, url, body, bytes: bytes.length, sha256: sha256(bytes), retrievedAt: now().toISOString() };
  }
  throw lastError;
}
