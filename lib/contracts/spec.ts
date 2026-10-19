/**
 * Mapping between the Phase 1 climate spec and RilvaEscrow's on-chain terms. The spec string is the
 * Phase 1 canonical JSON (RFC 8785); its keccak256 is computed identically on-chain.
 */
import type { Hex } from "viem";
import { parseIsoDate } from "../climate/dates";
import { canonicalSpec, specHash } from "../climate/evidence";
import { assertValidSpec } from "../climate/scenarios";
import { ClimateError, type ClimateSpec, type IsoDate } from "../climate/types";

export interface CampaignTerms {
  /** Exact canonical string passed to createCampaign; keccak256(bytes(spec)) == specHash. */
  spec: string;
  specHash: Hex;
  observationStart: number; // YYYYMMDD
  observationEnd: number; // YYYYMMDD
  thresholdBps: number;
}

const UINT32_MAX = 4_294_967_295;

export function toUint32(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${label} must be an integer in uint32 range, got ${value}`);
  }
  return value;
}

/** "2021-10-01" → 20211001 (validated calendar date). */
export function isoToYyyymmdd(iso: IsoDate): number {
  const { year, month, day } = parseIsoDate(iso);
  return year * 10_000 + month * 100 + day;
}

/** 20211001 → "2021-10-01" (validated). */
export function yyyymmddToIso(value: number): IsoDate {
  if (!Number.isInteger(value) || value < 10_000_101 || value > 99_991_231) {
    throw new ClimateError("INVALID_DATE", `not a YYYYMMDD integer: ${value}`);
  }
  const s = String(value);
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  parseIsoDate(iso);
  return iso;
}

export function campaignTermsFromSpec(spec: ClimateSpec): CampaignTerms {
  assertValidSpec(spec);
  return {
    spec: canonicalSpec(spec),
    specHash: specHash(spec),
    observationStart: isoToYyyymmdd(spec.period.start),
    observationEnd: isoToYyyymmdd(spec.period.end),
    thresholdBps: toUint32(spec.thresholdBps, "thresholdBps"),
  };
}
