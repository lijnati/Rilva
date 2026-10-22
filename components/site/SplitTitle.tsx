/**
 * Split-word headline reveal (pixel-meadow). Pure CSS (see `.split .w` in globals.css); words wrapped in
 * *asterisks* render as the single italic serif accent; a lone "/" forces a line break (≥ 640 px).
 * Screen readers get the plain sentence.
 */
export function SplitTitle({ text, className, as: Tag = "h1" }: { text: string; className?: string; as?: "h1" | "h2" }) {
  const plain = text.replace(/\*/g, "").replace(/\s\/\s/g, " ");
  const words = text.split(/\s+/);
  return (
    <Tag className={`split ${className ?? ""}`} aria-label={plain}>
      {words.map((w, i) => {
        if (w === "/") return <span key={i} aria-hidden="true" className="hidden sm:block" />;
        const accent = w.startsWith("*");
        const clean = w.replace(/\*/g, "");
        return (
          <span key={i} aria-hidden="true">
            <span className="w" style={{ "--i": i } as React.CSSProperties}>
              {accent ? <em>{clean}</em> : clean}
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </Tag>
  );
}
