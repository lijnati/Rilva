/** Display helpers. Exact (bigint/string) — never used for decisions. */
import { formatEther } from "viem";
import { formatBpsAsPercent } from "../climate/srpn";

const SEASONS: Record<string, string> = { "0101-0331": "JFM", "0301-0531": "MAM", "0601-0930": "JJAS", "1001-1231": "OND" };

export function seasonLabel(start: number, end: number): string {
  const s = String(start);
  const e = String(end);
  const key = `${s.slice(4)}-${e.slice(4)}`;
  if (s.slice(0, 4) === e.slice(0, 4) && SEASONS[key]) return `${SEASONS[key]} ${s.slice(0, 4)}`;
  const iso = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  return `${iso(s)} → ${iso(e)}`;
}

export function formatEth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

export function formatUtc(seconds: bigint): string {
  const d = new Date(Number(seconds) * 1000);
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days >= 2) return `${days} days`;
  if (days === 1) return hours ? `1 day ${hours} h` : "1 day";
  if (hours) return mins ? `${hours} h ${mins} min` : `${hours} h`;
  return `${Math.max(1, mins)} min`;
}

export function parseCampaignId(raw: string): bigint | null {
  const v = raw.trim();
  if (!/^\d{1,77}$/.test(v)) return null;
  const id = BigInt(v);
  if (id < 1n || id >= 1n << 256n) return null;
  return id;
}

/** 6000 → "60", 3363 → "33.63" (percent of normal without a redundant ".00"). */
export function formatPct(bps: number): string {
  return formatBpsAsPercent(bps).replace(/\.00$/, "");
}
