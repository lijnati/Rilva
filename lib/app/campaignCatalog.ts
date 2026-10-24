/** Card-level lookups for the campaign list. Display only — never used for decisions. */
import type { Hex } from "viem";
import { SCENARIOS, specHash, type ClimateSpec } from "../climate";

const BY_HASH: ReadonlyMap<string, ClimateSpec> = new Map(Object.values(SCENARIOS).map(({ spec }) => [specHash(spec).toLowerCase(), spec]));

/** The app's own scenario spec whose hash equals the on-chain `specHash`, or null (the UI then reads the spec from the event log). */
export function specForHash(hash: Hex): ClimateSpec | null {
  return BY_HASH.get(hash.toLowerCase()) ?? null;
}

/** "Yabelo, Borena, Oromia, Ethiopia" → place "Yabelo", region "Borena, Oromia, Ethiopia". */
export function cardPlace(label: string): { place: string; region: string } {
  const i = label.indexOf(",");
  return i < 0 ? { place: label.trim(), region: "" } : { place: label.slice(0, i).trim(), region: label.slice(i + 1).trim() };
}

/** Meter scale: 0 → 250 % of normal (25000 bps). */
export const METER_MAX_BPS = 25000;

/** Position (0–100 %) of a bps value on the meter, clamped. */
export function meterPosition(bps: number): number {
  return Math.min(100, Math.max(0, (bps / METER_MAX_BPS) * 100));
}
