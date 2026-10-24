import { describe, expect, it } from "vitest";
import { cardPlace, meterPosition, specForHash } from "@/lib/app/campaignCatalog";
import { SCENARIOS, specHash } from "@/lib/climate";

describe("campaign catalogue", () => {
  it("finds a known scenario spec by its on-chain hash", () => {
    const spec = SCENARIOS["yabelo-ond-2021"].spec;
    expect(specForHash(specHash(spec))).toEqual(spec);
    expect(specForHash(specHash(SCENARIOS["yabelo-ond-2023"].spec))?.period.start).toBe("2023-10-01");
  });

  it("returns null for a hash it does not know, so the UI never guesses a location", () => {
    expect(specForHash(`0x${"ab".repeat(32)}`)).toBeNull();
  });

  it("splits a spec label into place and region", () => {
    expect(cardPlace("Yabelo, Borena, Oromia, Ethiopia")).toEqual({ place: "Yabelo", region: "Borena, Oromia, Ethiopia" });
    expect(cardPlace("Somewhere")).toEqual({ place: "Somewhere", region: "" });
  });

  it("places index and threshold on a 0–250 % meter, clamping the far end", () => {
    expect(meterPosition(6000)).toBe(24);
    expect(meterPosition(10000)).toBe(40);
    expect(meterPosition(3363)).toBeCloseTo(13.452);
    expect(meterPosition(30000)).toBe(100);
    expect(meterPosition(0)).toBe(0);
  });
});
