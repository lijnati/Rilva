"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function truncateMiddle(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 3 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Mono, middle-truncated value with a copy control; the full value is in the title and screen-reader text. */
export function HashField({
  label,
  value,
  href,
  hrefLabel = "View on explorer",
  head = 10,
  tail = 8,
  className,
}: {
  label?: string;
  value: string;
  href?: string | null;
  hrefLabel?: string;
  head?: number;
  tail?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className={cn("min-w-0", className)}>
      {label && <p className="meta mb-1">{label}</p>}
      <div className="flex min-w-0 items-center gap-1.5">
        <code className="min-w-0 truncate font-mono text-[12.5px] text-ink" title={value}>
          <span aria-hidden="true">{truncateMiddle(value, head, tail)}</span>
          <span className="sr-only">{value}</span>
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex-none rounded-full px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-rule hover:text-ink hover:ring-rule-strong"
          aria-label={`Copy ${label ?? "value"}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="flex-none text-[11px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            {hrefLabel} ↗
          </a>
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
