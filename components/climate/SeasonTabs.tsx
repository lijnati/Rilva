"use client";

import { useRef } from "react";

/** Segmented pill tab bar with arrow-key support (WAI-ARIA tabs pattern). */
export function SeasonTabs({
  options,
  value,
  onChange,
  label,
  controls,
}: {
  options: Array<{ value: number; label: string }>;
  value: number;
  onChange: (v: number) => void;
  label: string;
  controls: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div role="tablist" aria-label={label} className="seg">
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          id={`tab-${o.value}`}
          aria-selected={o.value === value}
          aria-controls={controls}
          tabIndex={o.value === value ? 0 : -1}
          className="seg-tab"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
            e.preventDefault();
            const n =
              e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : (i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length;
            onChange(options[n]!.value);
            refs.current[n]?.focus();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
