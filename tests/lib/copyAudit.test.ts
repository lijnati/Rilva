/**
 * Release gate for PRODUCT.md §9 (forbidden claims) and DESIGN.md §1 (banned voice): scans every UI
 * source file under app/ and components/ for wording that drifts toward impact or hype claims.
 * Disclaimers ("no relief delivered", "not a live drought alert") are allowed by design.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components"].map((d) => path.join(process.cwd(), d));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|mdx?)$/.test(name) ? [full] : [];
  });
}

const FORBIDDEN: Array<[RegExp, string]> = [
  [/real[- ]time/i, "no real-time / live drought detection claims"],
  [/guaranteed?\s+(payout|payment|relief|release)/i, "no guaranteed payout"],
  [/\b(farmers|households|people|families|pastoralists|livestock|communities)\s+(were\s+|are\s+|get\s+)?(helped|saved|protected|supported|paid)\b/i, "no people/livestock helped"],
  [/\b(lives|losses)\s+(saved|prevented|avoided)\b/i, "no losses prevented"],
  [/\b(relief|aid|money|funds)\s+(was|were|is)\s+delivered\b/i, "no relief delivered"],
  [/\b(ERA5|CHIRPS)\s+is\s+(the\s+)?ground truth\b/i, "no ground-truth claims"],
  [/\bofficial drought (threshold|definition)\b(?![^"<]*\bnot\b)/i, "60 % must never be called official"],
  [/\b(AI[- ]powered|revolutionary|seamless|supercharge|unleash)\b/i, "banned hype words"],
  [/[a-z]!\s*["<]/i, "no exclamation marks in copy"],
];

describe("copy audit (forbidden claims)", () => {
  const all = ROOTS.flatMap(files);

  it("scans the UI sources", () => {
    expect(all.length).toBeGreaterThan(20);
  });

  for (const [re, rule] of FORBIDDEN) {
    it(rule, () => {
      const hits = all.flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => ({ f: path.relative(process.cwd(), f), n: i + 1, line }))
          // Disclaimers and FAQ questions (answered "No.") are the point; flag only assertions.
          .filter(({ line }) => re.test(line) && !/\bnot\b|\bno\b|never|isn&apos;t|does not|\?"/i.test(line)),
      );
      expect(hits.map((h) => `${h.f}:${h.n}: ${h.line.trim()}`)).toEqual([]);
    });
  }
});
