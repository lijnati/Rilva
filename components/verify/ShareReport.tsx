"use client";

import { useState } from "react";

/**
 * Share a verification result: the page link (anyone re-runs every check themselves), the native share
 * sheet where available, and a JSON record of what this browser checked.
 */
export function ShareReport({ campaignId, buildJson, ready }: { campaignId: string; buildJson: (url: string) => string; ready: boolean }) {
  const [note, setNote] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link copied. Whoever opens it re-runs every check in their own browser.");
    } catch {
      setNote(`Copy this address: ${window.location.href}`);
    }
  }

  async function share() {
    if (!("share" in navigator)) return copyLink();
    try {
      await navigator.share({ title: `Rilva · verify campaign #${campaignId}`, text: "Independent verification of a Rilva campaign. No wallet needed.", url: window.location.href });
    } catch {
      /* dismissed */
    }
  }

  function download() {
    const blob = new Blob([buildJson(window.location.href)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rilva-verification-campaign-${campaignId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setNote("Report downloaded. It records this result; the link lets others reproduce it.");
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-outline" onClick={copyLink}>
          Copy report link
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={download} disabled={!ready}>
          Download verification JSON
        </button>
        <button type="button" className="btn btn-sm btn-outline sm:hidden" onClick={share}>
          Share
        </button>
      </div>
      <p role="status" aria-live="polite" className="pl-1 text-[12px] text-ink-2">
        {note ?? (ready ? "" : "The JSON report is available once every check has finished.")}
      </p>
    </div>
  );
}
