import { describe, expect, it } from "vitest";
import { formatDuration, formatEth, formatPct, formatUtc, parseCampaignId, seasonLabel } from "@/lib/app/format";

describe("format helpers", () => {
  it("labels OND periods, falls back to ISO dates otherwise", () => {
    expect(seasonLabel(20211001, 20211231)).toBe("OND 2021");
    expect(seasonLabel(20210301, 20210531)).toBe("MAM 2021");
    expect(seasonLabel(20210115, 20210220)).toBe("2021-01-15 → 2021-02-20");
  });

  it("formats wei exactly (no float rounding)", () => {
    expect(formatEth(10_000_000_000_000_000n)).toBe("0.01 ETH");
    expect(formatEth(1n)).toBe("0.000000000000000001 ETH");
    expect(formatEth(2n * 10n ** 18n)).toBe("2 ETH");
  });

  it("formats percent of normal without redundant decimals", () => {
    expect(formatPct(6000)).toBe("60");
    expect(formatPct(3363)).toBe("33.63");
    expect(formatPct(21322)).toBe("213.22");
  });

  it("formats chain timestamps as UTC", () => {
    expect(formatUtc(0n)).toBe("1970-01-01 00:00 UTC");
  });

  it("formats durations", () => {
    expect(formatDuration(90)).toBe("1 min");
    expect(formatDuration(7 * 86400)).toBe("7 days");
    expect(formatDuration(3 * 3600 + 60)).toBe("3 h 1 min");
  });

  it("parses campaign ids strictly (ids start at 1)", () => {
    expect(parseCampaignId("12")).toBe(12n);
    expect(parseCampaignId("0")).toBeNull();
    expect(parseCampaignId("1.5")).toBeNull();
    expect(parseCampaignId("abc")).toBeNull();
    expect(parseCampaignId("1".repeat(80))).toBeNull();
  });
});
