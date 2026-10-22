import Link from "next/link";

/** Wordmark + mark: a raindrop resting on a ledger rule (rain-gauge reading / audit line). */
export function BrandMark({ tone = "butter" }: { tone?: "butter" | "ink" }) {
  const fill = tone === "butter" ? "var(--butter)" : "var(--accent)";
  const stroke = tone === "butter" ? "#183d32" : "#fffefa";
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill={fill} />
      <path d="M13 5.8c2.7 3.3 4 5.5 4 7.3a4 4 0 0 1-8 0c0-1.8 1.3-4 4-7.3Z" fill={stroke} />
      <path d="M7 19.6h12" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ tone = "butter" }: { tone?: "butter" | "ink" }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-display text-[23px] font-[650] tracking-[-0.04em]" aria-label="Rilva home">
      <BrandMark tone={tone} />
      rilva
    </Link>
  );
}
