import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { loadScenarioEvidence } from "@/lib/app/evidence.server";
import { formatPct } from "@/lib/app/format";
import { CHIRPS_SOURCE } from "@/lib/app/chirps";
import { formatBpsAsPercent, formatDmmAsMm } from "@/lib/climate";
import { ATTESTATION_TYPE_STRING } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Rilva computes SRPN-v1 from ERA5, hashes evidence, signs EIP-712 attestations and enforces the rule on-chain — and what it cannot prove.",
};

const SOURCES = [
  ["Open-Meteo Historical Weather API", "https://open-meteo.com/en/docs/historical-weather-api"],
  ["Open-Meteo terms (CC BY 4.0)", "https://open-meteo.com/en/terms"],
  ["CHIRPS v3.0 README", "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/README-CHIRPSv3.0.txt"],
  ["RFC 8785 JSON Canonicalization Scheme", "https://www.rfc-editor.org/rfc/rfc8785"],
  ["EIP-712 typed structured data", "https://eips.ethereum.org/EIPS/eip-712"],
  ["FEWS NET East Africa Seasonal Monitor, Dec 2021", "https://fews.net/east-africa/seasonal-monitor/december-2021"],
];

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-8 gap-4 border-t border-rule pt-10 md:grid-cols-[220px_1fr] md:gap-10" aria-labelledby={`${id}-t`}>
      <div>
        <p className="meta">{n}</p>
        <h2 id={`${id}-t`} className="h3 mt-1">{title}</h2>
      </div>
      <div className="grid max-w-[68ch] gap-3 text-[15px] leading-[1.8] text-ink-2 [&_strong]:text-ink">{children}</div>
    </section>
  );
}

export default async function MethodologyPage() {
  const { series } = await loadScenarioEvidence();
  const o21 = series.observed.find((o) => o.year === 2021);
  const baseHits = series.points.filter((p) => p.inBaseline && p.indexBps <= series.thresholdBps).length;

  return (
    <>
      <PageHero
        seed={131}
        eyebrow="Methodology & trust"
        title={
          <>
            What we compute. What we <em>can&apos;t</em> prove.
          </>
        }
        lede="Every step from a rainfall API to a settled escrow, in enough detail to redo it yourself — and the limits that no hash can remove."
      />
      <main id="main" className="container-rv grid gap-10 pb-20 pt-10">
        <nav aria-label="On this page" className="flex flex-wrap gap-2">
          {[
            ["data", "Data"],
            ["index", "Index"],
            ["threshold", "Threshold"],
            ["evidence", "Evidence"],
            ["attestation", "Attestation"],
            ["contract", "Contract"],
            ["trust", "Trust"],
            ["limits", "Limits"],
          ].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="btn btn-sm btn-outline">{l}</a>
          ))}
        </nav>

        <Section id="data" n="01" title="ERA5 via Open-Meteo">
          <p>
            Daily <strong>precipitation_sum</strong> comes from the Open-Meteo archive API with <code className="font-mono text-[13px]">models=era5</code> pinned: the ECMWF ERA5
            reanalysis on a 0.25° grid (≈ 28 km). The request point {series.location.requested.latitude}° N, {series.location.requested.longitude}° E resolves to the cell at{" "}
            {series.location.resolved.latitude}° N, {series.location.resolved.longitude}° E ({series.location.resolved.elevation} m). Days follow Africa/Addis_Ababa.
          </p>
          <p>
            Three regional replays use the same method at their own ERA5 cells, with days in their local timezone: Marsabit, Kenya (OND 2021, 1991–2020 normal),
            Petrolina, Brazil (MAM 2012) and Beed, India (JJAS 2015). The last two use the 1981–2010 normal, because a season may not sit inside its own baseline.
            The baseline is part of the hashed spec, so it is fixed before any money moves.
          </p>
          <p>
            The default <code className="font-mono text-[13px]">best_match</code> model is never used: it switches to a different model from 2017, which would mix two series inside one baseline.
            Raw responses for the demo seasons are committed byte-for-byte with SHA-256 hashes, so the site still works if the API is down — and says so when it falls back.
          </p>
          <p className="text-[13px]">
            Cross-check: {CHIRPS_SOURCE.label}. Shown for context only; it never feeds the rule, the index, the hash or the contract.
          </p>
        </Section>

        <Section id="index" n="02" title="SRPN-v1: percent of normal">
          <p>
            Each daily value (0.1 mm steps) becomes an integer number of tenths of a millimetre (dmm). <strong>T</strong> is the season total, <strong>S</strong> the sum of the same
            season over {series.baseline.startYear}–{series.baseline.endYear}, and <strong>N</strong> the number of baseline seasons ({series.baseline.years}).
          </p>
          <p className="rounded-[14px] bg-paper-deep px-5 py-4 font-mono text-[14px] text-ink">indexBps = floor(T × 10000 × N / S)</p>
          {o21 && (
            <p>
              For OND 2021: floor({o21.totalDmm} × 10000 × {series.baseline.years} / {series.baseline.sumDmm}) = <strong>{o21.indexBps} bps</strong>, i.e. {formatBpsAsPercent(o21.indexBps)} % of a{" "}
              {formatDmmAsMm(series.baseline.meanDmm)} mm normal. Integer arithmetic only; any missing or null day makes the evidence <strong>INVALID</strong>. Nothing is gap-filled.
            </p>
          )}
        </Section>

        <Section id="threshold" n="03" title="The illustrative 60 % rule">
          <p>
            A campaign is <strong>triggered</strong> when indexBps ≤ {series.thresholdBps} ({formatPct(series.thresholdBps)} % of normal).{" "}
            {formatPct(series.thresholdBps)} % of normal is an illustrative hackathon rule, not an official drought definition.
          </p>
          <p>
            Base rate: in ERA5 at this cell, {baseHits} of {series.baseline.years} baseline seasons fall at or below it — roughly one year in four. A real programme would calibrate a
            threshold (for example with SPI on a fitted distribution) with the people it is meant to serve.
          </p>
        </Section>

        <Section id="evidence" n="04" title="Evidence and hashing">
          <p>
            The campaign <strong>spec</strong> (location, source, model, period, baseline, threshold, replay flag) is serialised with RFC 8785 canonical JSON and hashed with keccak256.
            The contract stores that hash before any money is locked.
          </p>
          <p>
            The <strong>evidence core</strong> holds the spec, the resolved grid cell, all observed daily values, every baseline season total and the result. Its keccak256 over canonical
            JSON is the <strong>evidence hash</strong>. Because it excludes retrieval timestamps, anyone re-fetching the same public data gets the same hash.
          </p>
          <p className="text-[13px]">A matching hash proves integrity and reproducibility — not that the rainfall estimate is correct.</p>
        </Section>

        <Section id="attestation" n="05" title="EIP-712 attestation">
          <p>The attestor signs typed data, so wallets show named fields instead of an opaque blob. The type is defined once and shared byte-for-byte with the contract:</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-[14px] bg-paper-deep px-5 py-4 font-mono text-[12.5px] leading-6 text-ink">{ATTESTATION_TYPE_STRING}</pre>
          <p>
            The domain binds it to this contract and chain. There is no nonce: each attestation already names one campaign and one spec, and a campaign can only settle once. An expiry
            limits how long a signature stays usable.
          </p>
        </Section>

        <Section id="contract" n="06" title="On-chain enforcement">
          <p>
            RilvaEscrow is ownerless and non-upgradeable. <code className="font-mono text-[13px]">settle</code> checks, in order: the campaign exists and is active, the window is open,
            the attestation has not expired, the spec hash and period match, and the signature recovers to the designated attestor. Only then does it compare the index with the
            threshold itself and send the fixed amount, once, to the fixed beneficiary or back to the funder.
          </p>
          <p>
            If nobody settles before the deadline, anyone can trigger a refund to the funder. Rejected attempts revert with a named error, which the campaign page demonstrates with
            no-gas simulations. The contract has an extensive test suite but no professional audit.
          </p>
        </Section>

        <Section id="trust" n="07" title="Who you still trust">
          <p>
            <strong>The attestor is trusted to sign honestly; Rilva makes every attestation checkable, not automatically true.</strong> A dishonest attestor could sign a false index.
            Anyone can detect it — the evidence hash will not reproduce — but the contract cannot prevent it, and whichever valid attestation arrives first is final.
          </p>
          <p>Recomputing in the browser lets the attestor and the public check the number; it does not remove that trust. Future work: several independent attestors, or a challenge window.</p>
        </Section>

        <Section id="limits" n="08" title="Limits">
          <ul className="grid gap-2">
            <li>• <strong>Replay, not monitoring.</strong> Every season shown is a retrospective replay. Rilva issues no drought alerts.</li>
            <li>• <strong>A model, not a gauge.</strong> Rainfall estimate from ERA5 reanalysis (a model, not a rain gauge) for one ~28 km grid cell. It does not measure drought impact or financial loss.</li>
            <li>• <strong>Sources disagree.</strong> ERA5 and CHIRPS v3 disagree for some seasons (e.g. MAM 2021: 55 % vs 101 % of normal). Rilva shows both and uses ERA5 for the rule.</li>
            <li>• <strong>Rainfall deficit ≠ loss.</strong> The index ignores temperature, soil moisture, pasture, livestock, markets and conflict.</li>
            <li>• <strong>Testnet only.</strong> No real funds, no insurance, no relief delivered.</li>
          </ul>
        </Section>

        <section className="grid gap-4 border-t border-rule pt-10 md:grid-cols-[220px_1fr] md:gap-10" aria-labelledby="sources-t">
          <h2 id="sources-t" className="h3">Sources</h2>
          <ul className="grid gap-2 text-[14px]">
            {SOURCES.map(([t, u]) => (
              <li key={u}>
                <a className="link" href={u} target="_blank" rel="noreferrer">{t} ↗</a> <span className="text-[12.5px] text-ink-3">accessed 2026-10-19</span>
              </li>
            ))}
            <li className="text-[13px] text-ink-2">
              Full research notes and golden values: CLIMATE_DATA.md and CONTRACTS.md in the repository. Try it yourself in the{" "}
              <Link className="link" href="/explore">Climate Explorer</Link>.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
