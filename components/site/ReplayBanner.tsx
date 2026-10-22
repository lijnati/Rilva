/** Non-dismissible replay disclosure (DESIGN.md §6). Shown wherever a replay spec is displayed. */
export function ReplayBanner({ season, testnet = true }: { season?: string; testnet?: boolean }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-[14px] bg-warn-soft px-4 py-3 text-[13px] leading-5 text-ink">
      <svg viewBox="0 0 16 16" className="mt-0.5 size-4 flex-none text-warn" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4l2.5 1.5" strokeLinecap="round" />
      </svg>
      <p>
        <strong className="font-semibold">Retrospective replay{season ? ` of ${season}` : ""}.</strong> Not a live drought alert.
        {testnet && " Testnet funds only."}
      </p>
    </div>
  );
}
