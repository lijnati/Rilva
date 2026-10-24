"use client";

import { truncateMiddle } from "@/components/chain/HashField";
import type { UpstreamCheck } from "@/lib/app/browserEvidence";
import { formatBpsAsPercent } from "@/lib/climate";

/**
 * Informational line under a pinned-snapshot result: what a live Open-Meteo re-fetch gives today.
 * It never changes a check's status; the decision path uses the committed snapshot only.
 */
export function UpstreamNote({ check, pending }: { check: UpstreamCheck | undefined; pending?: boolean }) {
  if (pending) return <p className="text-[12px] text-ink-3">Re-fetching Open-Meteo live to compare…</p>;
  if (!check) return null;
  if (check.kind === "unreachable")
    return <p className="text-[12px] text-ink-3">Live comparison skipped: Open-Meteo unreachable ({check.error}).</p>;
  if (check.kind === "same")
    return <p className="text-[12px] text-ink-3">Live Open-Meteo today returns the same data: identical digest.</p>;
  return (
    <p className="text-[12px] leading-5 text-ink-2">
      <span className="meta mr-1.5">Upstream revised</span>
      Open-Meteo has revised its ERA5 values since the snapshot. Live today: {formatBpsAsPercent(check.indexBps)} % ({check.deltaBps > 0 ? "+" : ""}
      {check.deltaBps} bps), digest <code className="font-mono">{truncateMiddle(check.digest, 10, 8)}</code>
      {check.sameDecision ? ", same decision." : ". The decision would differ."} Campaigns sign the pinned snapshot, and anyone can re-verify it.
    </p>
  );
}
