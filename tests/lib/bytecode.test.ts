import { describe, expect, it } from "vitest";
import { runtimeCodeMatches } from "@/lib/contracts/bytecode";

// 8 bytes of code with one 2-byte immutable at offset 3.
const ARTIFACT = "0x6080aaaa00005b00" as const;
const REFS = { "11": [{ start: 3, length: 2 }] };

describe("runtimeCodeMatches", () => {
  it("matches when only immutable slots differ", () => {
    expect(runtimeCodeMatches("0x6080aabeef005b00", ARTIFACT, REFS)).toBe(true);
    expect(runtimeCodeMatches(ARTIFACT, ARTIFACT, REFS)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(runtimeCodeMatches("0x6080AABEEF005B00", ARTIFACT, REFS)).toBe(true);
  });

  it("rejects any change outside the immutable slots", () => {
    expect(runtimeCodeMatches("0x6081aabeef005b00", ARTIFACT, REFS)).toBe(false);
    expect(runtimeCodeMatches("0x6080aabeef005b01", ARTIFACT, REFS)).toBe(false);
  });

  it("rejects different lengths, empty code and EOAs", () => {
    expect(runtimeCodeMatches("0x6080aabeef005b", ARTIFACT, REFS)).toBe(false);
    expect(runtimeCodeMatches("0x", ARTIFACT, REFS)).toBe(false);
    expect(runtimeCodeMatches(undefined, ARTIFACT, REFS)).toBe(false);
  });

  it("rejects immutable references that fall outside the code", () => {
    expect(() => runtimeCodeMatches(ARTIFACT, ARTIFACT, { "1": [{ start: 7, length: 4 }] })).toThrow(/immutable/);
  });
});
