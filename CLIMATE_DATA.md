# CLIMATE_DATA.md — Rilva climate data, indicator and case study

> Status: Phase 0 research. Access date for every source and request below: **2026-10-19** unless noted.
> Legend: **Verified** = observed directly by a request or quoted from the cited source on the access date. **Decision** = Rilva project design choice (not an external fact). **UNVERIFIED** = not confirmed; do not present as fact.

---

## 1. Summary

| Item | Value |
|---|---|
| Primary (decision) data source | Open-Meteo Historical Weather API, **`models=era5`** (ECMWF ERA5 reanalysis, 0.25°) |
| Independent cross-check | CHIRPS v3.0 final, 3-monthly global GeoTIFF, 0.05° (informational only, never in the payout path) |
| Study location | **Yabelo, Borena Zone, Oromia, southern Ethiopia** — request point 4.88° N, 38.08° E |
| Season | **OND** (Oct–Dec; *Hagaya/Hageya* short rains in Borena) |
| Triggering replay | **OND 2021** (2021-10-01 → 2021-12-31 inclusive) — ERA5 **33.63 % of normal**; CHIRPS v3 52.5 % |
| Non-triggering replay | **OND 2023** (2023-10-01 → 2023-12-31) — ERA5 **213.22 % of normal**; CHIRPS v3 140.9 % |
| Fallback triggering replay | **OND 2022** — ERA5 44.61 %; CHIRPS v3 54.8 % |
| Indicator | **SRPN-v1** — Seasonal Rainfall Percent of Normal, in basis points |
| Baseline | Same point, same model, same months, **1991–2020** (30 seasons) |
| Illustrative threshold | **≤ 6000 bps (≤ 60 % of normal)** — hackathon rule, not an authoritative drought definition |

All scenarios are **retrospective replays** of past seasons. Rilva is not issuing a live drought alert.

---

## 2. Source research

### 2.1 Open-Meteo Historical Weather API

- **Endpoint:** `https://archive-api.open-meteo.com/v1/archive`. Docs: https://open-meteo.com/en/docs/historical-weather-api
- **Datasets (Verified, docs page):**
  - ERA5: 0.25° (~25 km), 1940 onward, daily updates with a 5-day delay.
  - ERA5-Land: 0.1°, 1950 onward.
  - ECMWF IFS: 9 km, 2017 onward.
  - The default `best_match` "combines IFS HRES, ERA5 and ERA5-Land seamlessly".
- **Variable (Verified):** `precipitation_sum` is the "Sum of daily precipitation (including rain, showers and snowfall)", in **mm**. Daily aggregation follows the `timezone` parameter. We observed `utc_offset_seconds: 10800` for `Africa/Addis_Ababa`.
- **Precision (Verified, observed):** returned values are multiples of 0.1 mm (e.g. `1.60, 2.40, 10.80`).
- **Grid snapping (Verified, observed):** a request at 4.88/38.08 with `models=era5` resolves to `latitude 5.0, longitude 38.0, elevation 1891.0`. The resolved coordinates must be recorded in the evidence.
- **Latency and missing data (Verified, observed 2026-10-19):** a request for 2026-10-10..19 returned values through 2026-10-13 and **`null`** for 2026-10-14..19, so the latency is about 6 days. An `end_date` beyond today returns `{"reason":"Parameter 'end_date' is out of allowed range from 1940-01-01 to 2026-10-19","error":true}`.
- **Reproducibility (Verified, observed):**
  - Two re-fetches of OND 2021 returned byte-identical `daily` arrays, also identical to the earlier decade-chunk downloads.
  - `generationtime_ms` differs on every call, so it must never be hashed.
- **CORS (Verified, observed):** responses include `access-control-allow-origin: *`, so browsers can fetch directly.
- **Licence and terms (Verified, https://open-meteo.com/en/terms):**
  - Data are under **CC BY 4.0**.
  - Free API is "only … for non-commercial purposes", with limits of "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute".
  - The docs credit line "Generated using Copernicus Climate Change Service information" also applies (ERA5 is Copernicus C3S). Attribution text in the UI: *"Weather data by Open-Meteo.com (CC BY 4.0), based on ERA5 — Copernicus Climate Change Service."*
- **Rilva has not confirmed that a hackathon prototype is non-commercial use (UNVERIFIED).** It is very likely non-commercial: no ads and no subscriptions.
- **Network reliability (observed):** transient connection and DNS failures occurred during research. The app retries with backoff and ships committed snapshots (Phase 1).

#### Critical finding: `best_match` is not a homogeneous series

We pulled 1991–2023 at Yabelo with `best_match` and with `models=era5`:
- Through 2016 the two are identical.
- From 2017 they diverge strongly. Example: MAM 2018 is 383.5 mm with `best_match` versus 756.3 mm with ERA5. This is consistent with the documented switch to IFS from 2017.
- A baseline mixing models is invalid for anomaly work.
- **Decision:** always pin `models=era5`, and include the model in the campaign spec and the evidence hash.

### 2.2 CHIRPS v3.0 (Climate Hazards Center, UCSB)

Verified from `README-CHIRPSv3.0.txt` at https://data.chc.ucsb.edu/products/CHIRPS/v3.0/ (HTTP 200).
- **Coverage and resolution:** quasi-global 60° N–60° S, 0.05°, 1981 → near real time. Products run from pentads to annual, plus Africa subsets.
- **Provenance:** satellite infrared (CHIRP3) blended with station data from more than 90 sources. Since v3, station data are gauge-undercatch corrected, so v3 is "overall wetter" than v2. Missing data are filled with 0.25° ERA5.
  - **Implication:** CHIRPS v3 is *not fully independent* of ERA5 where fill is used.
- **Latency:**
  - Preliminary release: 2 days after each pentad.
  - Final release: "typically complete during the third week of the following month".
- **Version:** v3.0 released 2025-01-01.
- **Licence:** **UNVERIFIED** for v3 specifically. CHC has historically published CHIRPS as public domain / free with citation; to confirm at https://www.chc.ucsb.edu/data/chirps3 before final submission. Suggested citation: Funk et al., CHIRPS v3.0, Climate Hazards Center, UCSB.
- **File format (Verified):**
  - `3-monthly/global/tifs/chirps-v3.0.YYYY.MMMMMM.tif`, for example `…2021.101112.tif` for OND.
  - Each file is 65.9 MiB: uncompressed float32, 7200×2400, strip-organized, origin −180/60, pixel 0.05°.
  - We read individual pixels with **HTTP Range requests**, so whole rasters never had to be downloaded.
  - Yabelo maps to grid cell col 4361, row 1102 (centre 4.875° N, 38.075° E).
- **Use in Rilva (Decision):** an informational cross-check shown on the evidence page and in the docs. It is never part of eligibility or payout.

---

## 3. Case study selection

### 3.1 Why Yabelo / Borena / OND

- Borena is a pastoral zone in southern Oromia that relies on two rainy seasons: *Ganna* (MAM) and *Hagaya* (OND).
- It was central to the 2020–2023 Horn of Africa drought.
- A single point keeps the computation simple and reproducible. **Decision:** use a point, not a zone polygon. Zone averaging is out of scope.

### 3.2 Data-derived rainfall deficit (this is what Rilva computes)

ERA5 via Open-Meteo, point 4.88/38.08 (resolved 5.0/38.0), `timezone=Africa/Addis_Ababa`. Baseline 1991–2020 OND:
- Mean 234.0 mm, SD 116.1 mm.
- Integer baseline sum is **70193 dmm**, where dmm = tenths of a millimetre.

| Season | ERA5 total | ERA5 SRPN | ERA5 z | CHIRPS v3 point | CHIRPS v3 % of its 1991–2020 mean | Outcome @ 6000 bps |
|---|---|---|---|---|---|---|
| **OND 2021** | 78.7 mm (787 dmm, 92/92 days) | **3363 bps (33.63 %)** | −1.34 | 88.9 mm | 52.5 % | **Triggers** |
| OND 2022 (fallback) | 104.4 mm (1044 dmm) | 4461 bps (44.61 %) | −1.12 | 92.8 mm | 54.8 % | Triggers |
| **OND 2023** | 498.9 mm (4989 dmm) | **21322 bps (213.22 %)** | +2.28 | 238.8 mm | 140.9 % | **Does not trigger** |

Notes:
- ERA5 OND 2021 (78.7 mm) is the second-driest OND in 1991–2023 at this point, 0.1 mm above OND 1998 (78.6 mm = 786 dmm, from the committed snapshots; corrected 2026-10-22 from an earlier "ties 1998"). CHIRPS v3 ranks OND 2021 fifth driest.
- **Agreement:** the year-to-year correlation of percent-of-normal between ERA5 and CHIRPS v3 at this location is **r = 0.90 for OND** and only **r = 0.75 for MAM**.
- **Disagreement example (why we did not choose MAM 2021):** ERA5 MAM 2021 = 54.68 %, but CHIRPS v3 MAM 2021 = 101.4 %. A MAM 2021 trigger would therefore be source-dependent. MAM 2022 is 74.6 % (ERA5) versus 58.6 % (CHIRPS), with the opposite sign of disagreement.
- **OND 2020** is above normal in both datasets (ERA5 145 %, CHIRPS 155 %) at this point, although regional narratives often count OND 2020 as the first failed season. We do not claim OND 2020 was dry at Yabelo.
- **Base rate disclosure:** 7 of 30 baseline OND seasons (1993, 1996, 1998, 2003, 2007, 2010, 2018) fall at or below 60 % of normal in ERA5. The illustrative threshold therefore fires roughly 1 year in 4. That suits a demo; a real parametric design would calibrate it.

### 3.3 Independently documented drought impacts (NOT computed by Rilva)

These sources describe the situation; Rilva does not verify them and does not use them for eligibility.

- **FEWS NET, East Africa Seasonal Monitor, 31 Dec 2021** — https://fews.net/east-africa/seasonal-monitor/december-2021 :
  - "October to December deyr/hegaya rainfall in southern and southeastern pastoral areas was well below average", "ranging between 45-75 percent of average".
  - "Moderate to extreme drought conditions are ongoing across many areas of Borena and Guji Zone of Oromia."
  - This is consistent with the CHIRPS figure (52.5 %). ERA5 (33.6 %) is drier than FEWS NET's range.
- **UNICEF Ethiopia story (Dec 2021), Dubuluk woreda, Borena:** describes the failed Hagayya rains and livestock losses. https://www.unicef.org/ethiopia/stories/hagayya-rain-failed-ellas-dried-and-bona-strikes-again
- **GOAL:** reports, citing the local administration, 650,000 livestock deaths in the first three months of 2022, and three consecutive failed rainy seasons in 2021–2022. https://www.goalglobal.org/stories/vulnerable-communities-in-ethiopia-in-need-following-drought/ — secondary source.
- **WMO/ICPAC forecast briefing, 26 Aug 2022:** warned of a fifth consecutive failed season (UN News coverage): https://news.un.org/en/node/1125552 — WMO's own press release was not retrieved (UNVERIFIED wording).

Impact figures vary widely between sources (livestock deaths range from tens of thousands to millions depending on area and date). **Rilva must not display a single impact number as fact.** At most, it may link these sources under "Context from humanitarian monitoring".

---

## 4. Indicator specification — SRPN-v1 (Decision)

**Name:** Seasonal Rainfall Percent of Normal, version 1 (`SRPN-v1`).

**Inputs (all fixed in the campaign spec):**
- `latitude`, `longitude` (request point, 2 decimals)
- `model = "era5"`
- `timezone = "Africa/Addis_Ababa"`
- `periodStart`, `periodEnd`: ISO dates, both **inclusive**
- `baselineStartYear = 1991`, `baselineEndYear = 2020`

**Season definition:**
- The target season is the calendar-day range `[periodStart, periodEnd]`.
- Baseline season *y* is the same month/day range shifted to year *y*.
- The period must lie within one calendar year (MVP restriction). This avoids ambiguity for DJF and leap days.
- If the range contains 29 Feb, it is rejected in MVP. OND/MAM never do.

**Algorithm (integer arithmetic only):**
1. For each day *d* in the range, read `precipitation_sum[d]` (mm, 1-decimal). Convert to integer tenths: `dmm[d] = round(value × 10)`. Values are 1-decimal, so this conversion is exact.
2. `T` = Σ `dmm[d]` over the target season.
3. `B_y` = Σ `dmm[d]` over baseline season *y*. `S` = Σ_y `B_y`. `N` = number of baseline years (30).
4. **`indexBps = floor(T × 10000 × N / S)`**, computed with BigInt or uint256. There is no intermediate rounding of the mean.
5. `triggered = indexBps ≤ thresholdBps`. The contract computes this itself and never trusts the off-chain boolean.
6. Display only: `percent = indexBps / 100` (2 decimals); `mean_mm = S / N / 10` (1 decimal); `z` = (T − mean)/SD with sample SD, on 2 decimals. **z is informational and never used for decisions.**

**Missing-data rules:**
- Every day in the target and all 30 baseline seasons must be present and non-null. The day count must equal the expected calendar days (92 for OND).
- Any `null`, a missing day, a negative value, an API `error:true`, or a resolved-coordinate mismatch → evidence status **`INVALID`**. No attestation can be produced.
- There is no gap filling and no partial seasons.
- `S = 0` → `INVALID` (division guard).

**Golden values (must be unit tests, from data retrieved 2026-10-19):**

| Case | T (dmm) | S (dmm) | N | indexBps |
|---|---|---|---|---|
| OND 2021 | 787 | 70193 | 30 | **3363** |
| OND 2022 | 1044 | 70193 | 30 | **4461** |
| OND 2023 | 4989 | 70193 | 30 | **21322** |
| MAM 2021 (counter-example) | 2265 | 124257 | 30 | 5468 |

**Threshold:**
- `thresholdBps = 6000` is an **illustrative hackathon rule**.
- It is not WMO, FEWS NET or national drought guidance.
- The UI must say so next to every threshold display.
- A credible future method would be SPI on a gamma fit (WMO-No. 1090, 2012). It is out of scope because it needs a fitted distribution, which is harder to make bit-exact.

---

## 5. Evidence artifact and hashing (Decision; implemented in Phase 1)

> **Phase 1 update (2026-10-19):** the Phase 0 draft assumed the raw response could be hashed into the evidence. That is impossible to re-derive live, because every Open-Meteo body contains a different `generationtime_ms`. The implementation therefore uses three distinct hashes. Code: `lib/climate/evidence.ts`; details in README.md.

| Hash | Formula | Purpose | Reproducible live? |
|---|---|---|---|
| Raw snapshot integrity | `sha256(raw response bytes)` (in `manifest.json` and provenance) | Proves a saved snapshot is byte-identical to what was received | No (bytes change every call) |
| `seriesDigest` | `keccak256(JCS({schema:"rilva.series.v1", grid, variable, unit:"dmm", days:[[date,dmm],…]}))` | Pins exactly the normalised observed and baseline days used | Yes |
| **`evidenceDigest`** | `keccak256(UTF-8(JCS(core)))` | The `bytes32` attested on-chain in Phase 2 (`Attestation.evidenceHash`) | **Yes.** Verified 2026-10-19: a live re-fetch reproduced all digests. |

`specHash = keccak256(UTF-8(JCS(spec)))`, where `spec` is the `rilva.spec.v1` object in CONTRACTS.md §2.

**Core (`rilva.evidence.v1`) fields, all hashed:**
- `schema`, `algorithm: "SRPN-v1"`, `specHash`, `spec`.
- `source {provider, endpoint, model:"era5", variable, unit:"mm", normalizedUnit:"dmm", timezone}`.
- `location {requested {latitude, longitude}, resolved {latitude, longitude, elevation, utcOffsetSeconds}}`.
- `periods {observed {start, end, days}, baseline {startYear, endYear, years, daysPerSeason}}`.
- `data {seriesDigest, observedDailyDmm[92], baselineSeasonTotalsDmm[30]}`.
- `result {observedTotalDmm, baselineSumDmm, baselineYears, indexBps, deficitBps, thresholdBps, triggered}`.

**Not hashed:**
- provenance: `mode` live|snapshot, `fellBackFromLive`, document URLs, `retrievedAt`, raw SHA-256;
- presentation strings;
- the human-readable notice.

These live next to the core in `public/evidence/<scenario>.json`.

**JCS rules:**
- RFC 8785.
- Keys are sorted by UTF-16 code units.
- ECMAScript number/string serialisation (`5.0 → 5`).
- No whitespace.
- Non-JSON values throw an error.

A valid digest proves integrity and reproducibility, **not** that the observation is correct.

## 6. Reproduction recipe

1. Target:
   ```
   GET https://archive-api.open-meteo.com/v1/archive?latitude=4.88&longitude=38.08&start_date=2021-10-01&end_date=2021-12-31&daily=precipitation_sum&timezone=Africa%2FAddis_Ababa&models=era5
   ```
2. Baseline: same parameters with `start_date=1991-01-01&end_date=2020-12-31`. Split into decade requests for reliability. Keep only 10-01..12-31 of each year.
3. Apply §4. Expected values: `T=787`, `S=70193`, `indexBps=3363`.
4. Build `core` (§5), JCS-canonicalize, keccak256, and compare with the `evidenceHash` in the on-chain `Settled` event. Expected for OND 2021: `0xde7fdf48a6a608f3702848d95643440ceac87c4f411ccd64fc7776653be94f50`.
5. CHIRPS cross-check: read pixel (col 4361, row 1102) from `https://data.chc.ucsb.edu/products/CHIRPS/v3.0/3-monthly/global/tifs/chirps-v3.0.2021.101112.tif`. Expected value: 88.887 mm.

The Phase 0 research scripts that produced these numbers lived in a temporary scratchpad. **Done in Phase 1:** the production TypeScript module re-derived all golden values (3363 / 4461 / 21322 / 5468 bps) from genuine raw responses committed under `public/snapshots/open-meteo/era5/yabelo/`. These were cross-checked against the Phase 0 downloads (0 differences in 11,234 overlapping days). Run `pnpm climate:verify all`.

---

## 7. Limitations and uncertainty disclosure (must appear in the product)

1. **Reanalysis, not observation:**
   - ERA5 precipitation is a model forecast field constrained by data assimilation. It is not a rain-gauge measurement.
   - It has known biases over East African highlands.
   - A 0.25° cell (~28 km) is not a farm or a household.
2. **Source disagreement is material:**
   - ERA5 and CHIRPS v3 differ by up to about 50 percentage points in some seasons at this point (MAM 2021).
   - For OND 2021, the two sources span 34–53 % of normal.
3. **Point ≠ region:** one grid cell does not represent Borena Zone.
4. **Rainfall deficit ≠ drought impact ≠ financial loss.** SRPN measures meteorological rainfall only. It does not account for temperature, evapotranspiration, soil moisture, vegetation, markets or conflict.
5. **Baseline choice matters:** 1991–2020 follows the WMO climate-normal convention. A different baseline shifts the index.
6. **Revisions:**
   - Recent ERA5 (preliminary ERA5T, roughly the last 3 months) can be revised. **UNVERIFIED** how Open-Meteo surfaces revisions.
   - The demo uses 2021–2023 data and is not affected.
7. **Signed evidence proves who attested which bytes, not ground truth.**
8. **Availability:**
   - Open-Meteo free-tier limits and network flakiness were observed.
   - The app must cache responses and ship committed snapshots, so the demo works even when the source is down.

---

## Sources (accessed 2026-10-19)

- Open-Meteo Historical Weather API docs — https://open-meteo.com/en/docs/historical-weather-api
- Open-Meteo terms — https://open-meteo.com/en/terms
- Open-Meteo archive API (direct requests, see §6) — https://archive-api.open-meteo.com/v1/archive
- CHIRPS v3.0 data and README — https://data.chc.ucsb.edu/products/CHIRPS/v3.0/README-CHIRPSv3.0.txt
- CHIRPS v3 landing page (licence to confirm) — https://www.chc.ucsb.edu/data/chirps3
- FEWS NET East Africa Seasonal Monitor, Dec 2021 — https://fews.net/east-africa/seasonal-monitor/december-2021
- UNICEF Ethiopia story — https://www.unicef.org/ethiopia/stories/hagayya-rain-failed-ellas-dried-and-bona-strikes-again
- GOAL story — https://www.goalglobal.org/stories/vulnerable-communities-in-ethiopia-in-need-following-drought/
- UN News on WMO/ICPAC outlook, 26 Aug 2022 — https://news.un.org/en/node/1125552
- RFC 8785 JSON Canonicalization Scheme — https://www.rfc-editor.org/rfc/rfc8785
- WMO, *Standardized Precipitation Index User Guide*, WMO-No. 1090 (2012) — reference for future work; not retrieved in Phase 0.
