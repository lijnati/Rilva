import { describe, expect, it, vi } from "vitest";
import {
  buildArchiveUrl,
  fetchArchiveDocument,
  planRequests,
  type FetchLike,
} from "@/lib/climate/source";
import { makeSeasonSpec } from "@/lib/climate/scenarios";
import { syntheticBody } from "../helpers/synthetic";

const req = { latitude: 4.88, longitude: 38.08, start: "2021-10-01", end: "2021-10-03", timezone: "Africa/Addis_Ababa" };
const noSleep = async () => {};

function okResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

describe("buildArchiveUrl", () => {
  it("pins era5, the variable and the timezone with a stable parameter order", () => {
    const url = buildArchiveUrl(req);
    expect(url).toBe(
      "https://archive-api.open-meteo.com/v1/archive?latitude=4.88&longitude=38.08&start_date=2021-10-01&end_date=2021-10-03&daily=precipitation_sum&timezone=Africa%2FAddis_Ababa&models=era5",
    );
    expect(url).not.toContain("best_match");
  });

  it("rejects invalid dates and coordinates", () => {
    expect(() => buildArchiveUrl({ ...req, start: "2021-13-01" })).toThrow(/INVALID_DATE/);
    expect(() => buildArchiveUrl({ ...req, latitude: 91 })).toThrow(/INVALID_SPEC/);
  });
});

describe("planRequests", () => {
  it("splits the baseline into ≤10-year chunks and adds the observed period", () => {
    const spec = makeSeasonSpec({
      label: "Yabelo",
      latitude: 4.88,
      longitude: 38.08,
      start: "2021-10-01",
      end: "2021-12-31",
      baselineStartYear: 1991,
      baselineEndYear: 2020,
      thresholdBps: 6000,
      replay: true,
    });
    expect(planRequests(spec).map((r) => `${r.start}..${r.end}`)).toEqual([
      "1991-01-01..2000-12-31",
      "2001-01-01..2010-12-31",
      "2011-01-01..2020-12-31",
      "2021-10-01..2021-12-31",
    ]);
  });
});

describe("fetchArchiveDocument", () => {
  const body = syntheticBody({ start: req.start, end: req.end });

  it("returns the raw body, its sha256 and the canonical URL", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => okResponse(body));
    const doc = await fetchArchiveDocument(req, { fetchImpl, sleep: noSleep, now: () => new Date("2026-10-19T00:00:00Z") });
    expect(doc.body).toBe(body);
    expect(doc.sha256).toMatch(/^0x[0-9a-f]{64}$/);
    expect(doc.retrievedAt).toBe("2026-10-19T00:00:00.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toContain("models=era5");
  });

  it("retries transient failures then succeeds", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okResponse("busy", 503))
      .mockResolvedValueOnce(okResponse(body));
    const doc = await fetchArchiveDocument(req, { fetchImpl, sleep: noSleep, retries: 3 });
    expect(doc.body).toBe(body);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("maps timeouts to NETWORK_TIMEOUT after exhausting retries", async () => {
    const fetchImpl = vi.fn<FetchLike>((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    });
    await expect(fetchArchiveDocument(req, { fetchImpl, sleep: noSleep, retries: 1, timeoutMs: 5 })).rejects.toThrow(/NETWORK_TIMEOUT/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps persistent 5xx to HTTP_ERROR", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => okResponse("down", 502));
    await expect(fetchArchiveDocument(req, { fetchImpl, sleep: noSleep, retries: 2 })).rejects.toThrow(/HTTP_ERROR.*502/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry upstream 4xx errors and surfaces the reason", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => okResponse('{"error":true,"reason":"end_date out of range"}', 400));
    await expect(fetchArchiveDocument(req, { fetchImpl, sleep: noSleep, retries: 3 })).rejects.toThrow(/UPSTREAM_ERROR.*out of range/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a 200 response with a malformed body", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => okResponse("<html>not json</html>"));
    await expect(fetchArchiveDocument(req, { fetchImpl, sleep: noSleep })).rejects.toThrow(/MALFORMED_RESPONSE/);
  });
});
