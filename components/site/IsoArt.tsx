/**
 * Isometric line drawings for step cards — the pixel-meadow `iso()` helper, ported to JSX and extended
 * with Rilva metaphors: a spec (stacked sheets), evidence (bars), an attestation (a sealed tray) and a
 * settlement (a vault with one released block).
 */
type Kind = "spec" | "evidence" | "attest" | "settle";

const S = 13;
const CX = 120;
const CY = 92;
const C = Math.cos(Math.PI / 6);
const SN = Math.sin(Math.PI / 6);
const P = (x: number, y: number, z: number) => [CX + (x - y) * C * S, CY + (x + y) * SN * S - z * S] as const;
const pts = (a: Array<[number, number, number]>) => a.map((p) => P(...p).map((v) => v.toFixed(1)).join(",")).join(" ");

function box(x: number, y: number, z: number, w: number, d: number, h: number): string[] {
  return [
    pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]),
    pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]),
    pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]),
  ];
}

function polys(kind: Kind): string[] {
  switch (kind) {
    case "spec":
      return [...box(-5, -3, 0, 7, 9, 0.5), ...box(-4, -2.4, 0.9, 7, 9, 0.5), ...box(-3, -1.8, 1.8, 7, 9, 0.5), ...box(-1.2, 0.4, 2.4, 3.2, 1, 0.2), ...box(-1.2, 2.2, 2.4, 2.2, 1, 0.2)];
    case "evidence": {
      const heights = [2.2, 3.4, 1.4, 4.2, 0.8, 2.8];
      return [...box(-6, -3, 0, 12, 6, 0.3), ...heights.flatMap((h, i) => box(-5.4 + i * 1.9, -0.6, 0.3, 1.2, 1.2, h))];
    }
    case "attest":
      return [...box(-5, -4, 0, 10, 8, 1.2), ...box(-4, -3, 1.2, 8, 6, 0.15), ...box(-3.6, -2.6, 1.6, 7.4, 5.4, 0.15), ...box(0.6, 0.4, 1.75, 2, 2, 0.9)];
    case "settle":
      return [...box(-5, -4, 0, 6, 6, 4), ...box(-4.2, -3.2, 4, 4.4, 4.4, 0.25), ...box(3, 1, 0, 2, 2, 1.2), ...box(3, 1, 1.4, 2, 2, 0.2)];
  }
}

export function IsoArt({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 240 170" aria-hidden="true" className="h-auto w-full max-w-[230px]" fill="var(--sheet)" fillOpacity=".6" stroke="var(--ink)" strokeOpacity=".55" strokeWidth="1" strokeLinejoin="round">
      {polys(kind).map((p, i) => (
        <polygon key={i} points={p} />
      ))}
    </svg>
  );
}
