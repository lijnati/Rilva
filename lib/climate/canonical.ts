/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) for the JSON subset Rilva hashes:
 * null, booleans, well-formed strings, finite numbers, arrays and plain objects.
 *
 * - Strings and numbers use ECMAScript JSON serialisation, which RFC 8785 adopts verbatim
 *   (numbers: shortest round-trip form, e.g. 5.0 → "5", 1e21 → "1e+21").
 * - Object keys are sorted by UTF-16 code units (the default JS string comparison).
 * - No whitespace. Anything else (undefined, NaN, Infinity, BigInt, Date, Map, lone surrogates)
 *   throws NON_CANONICAL_VALUE instead of being silently coerced.
 */
import { ClimateError } from "./types";

function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function fail(path: string, what: string): never {
  throw new ClimateError("NON_CANONICAL_VALUE", `${what} at ${path || "<root>"}`);
}

function serialize(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) fail(path, `non-finite number ${value}`);
      return JSON.stringify(value);
    case "string":
      if (hasLoneSurrogate(value)) fail(path, "string with lone surrogate");
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((v, i) => serialize(v, `${path}[${i}]`)).join(",")}]`;
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) fail(path, "non-plain object");
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const members = keys.map((k) => {
        if (hasLoneSurrogate(k)) fail(path, "key with lone surrogate");
        const v = record[k];
        if (v === undefined) fail(`${path}.${k}`, "undefined value");
        return `${JSON.stringify(k)}:${serialize(v, `${path}.${k}`)}`;
      });
      return `{${members.join(",")}}`;
    }
    default:
      return fail(path, `unsupported type ${typeof value}`);
  }
}

export function canonicalize(value: unknown): string {
  return serialize(value, "");
}
