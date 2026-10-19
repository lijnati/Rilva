import { describe, expect, it } from "vitest";
import { canonicalize } from "@/lib/climate/canonical";

describe("canonicalize (RFC 8785 JCS subset)", () => {
  it("matches the RFC 8785 §3.2.2 example", () => {
    const input = {
      numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
      string: String.fromCharCode(0x20ac, 0x24, 0x0f, 0x0a, 0x41, 0x27, 0x42, 0x22, 0x5c, 0x5c, 0x22, 0x2f),
      literals: [null, true, false],
    };
    expect(canonicalize(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it("sorts keys by UTF-16 code units (RFC 8785 §3.2.3 example)", () => {
    const input = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      "דּ": "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "😀": "Emoji: Grinning Face",
      "\u0080": "Control",
      "ö": "Latin Small Letter O With Diaeresis",
    };
    const order = Object.values(JSON.parse(canonicalize(input)) as Record<string, string>);
    // JSON.parse re-orders integer-like keys first, so check the raw string order instead.
    const raw = canonicalize(input);
    const positions = [
      "Carriage Return",
      "One",
      "Control",
      "Latin Small Letter O With Diaeresis",
      "Euro Sign",
      "Emoji: Grinning Face",
      "Hebrew Letter Dalet With Dagesh",
    ].map((v) => raw.indexOf(v));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(order).toHaveLength(7);
  });

  it("is independent of key insertion order and whitespace", () => {
    const a = { b: 1, a: { d: [3, 2, 1], c: "x" } };
    const b = JSON.parse('{ "a": { "c": "x", "d": [3,2,1] }, "b": 1 }') as unknown;
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(a)).toBe('{"a":{"c":"x","d":[3,2,1]},"b":1}');
  });

  it("serialises numbers like ECMAScript (environment-stable golden)", () => {
    expect(canonicalize([5.0, 38.0, 4.88, 38.08, 1891.0, -0, 1e21, 1e-7, 10800])).toBe(
      "[5,38,4.88,38.08,1891,0,1e+21,1e-7,10800]",
    );
  });

  it.each([
    ["undefined", { a: undefined }],
    ["NaN", [Number.NaN]],
    ["Infinity", [Number.POSITIVE_INFINITY]],
    ["bigint", [1n]],
    ["function", [() => 1]],
    ["Date", [new Date(0)]],
    ["Map", [new Map()]],
    ["lone surrogate", ["\ud800"]],
  ])("rejects %s", (_name, value) => {
    expect(() => canonicalize(value)).toThrow(/NON_CANONICAL_VALUE/);
  });
});
