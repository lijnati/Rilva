import Link from "next/link";
import { HashField } from "@/components/chain/HashField";
import { RuleOutcome } from "@/components/climate/Outcome";
import { SeasonChart } from "@/components/climate/SeasonChart";
import { IsoArt } from "@/components/site/IsoArt";
import { JudgePath } from "@/components/site/JudgePath";
import { PixelCritter, PixelScene } from "@/components/site/PixelScene";
import { SiteNav } from "@/components/site/SiteNav";
import { SplitTitle } from "@/components/site/SplitTitle";
import { ButtonLink } from "@/components/ui/Button";
import { CHIRPS_OND } from "@/lib/app/chirps";
import { loadScenarioEvidence } from "@/lib/app/evidence.server";
import { formatBpsAsPercent, formatDmmAsMm } from "@/lib/climate";
import { isoToYyyymmdd } from "@/lib/contracts/spec";

const STEPS = [
  {
    art: "spec",
    tone: "pastel-mint",
    title: "Write the rule first.",
    body: "Place, data source, model, season, baseline and threshold go into one canonical spec. Its hash is stored on-chain before any money is locked.",
  },
  {
    art: "evidence",
    tone: "pastel-cream",
    title: "Compute the evidence.",
    body: "Daily ERA5 rainfall becomes one integer: percent of normal, in basis points. Missing days make the evidence invalid. Nothing is gap-filled.",
  },
  {
    art: "attest",
    tone: "pastel-ice",
    title: "Sign what was checked.",
    body: "A named attestor recomputes the index and signs an EIP-712 statement that binds the campaign, the spec hash and the evidence hash.",
  },
  {
    art: "settle",
    tone: "pastel-mint",
    title: "Let the contract decide.",
    body: "The escrow verifies the signature, compares the index with the threshold itself, and pays the fixed amount once, to a fixed address.",
  },
] as const;

const limits = (baseHits: number, baseYears: number) => [
  {
    q: "Is this live drought monitoring?",
    a: "No. Every season shown is a retrospective replay of a past season. Rilva is not issuing drought alerts.",
  },
  {
    q: "Is ERA5 the ground truth?",
    a: "No. ERA5 is a reanalysis model estimate for one ~28 km grid cell, not a rain gauge. CHIRPS v3 sometimes disagrees materially, and Rilva shows that disagreement instead of hiding it.",
  },
  {
    q: "Is 60 % of normal an official drought threshold?",
    a: `No. It is an illustrative hackathon rule. In ERA5 it would have fired in ${baseHits} of the ${baseYears} baseline seasons; a real programme would calibrate it.`,
  },
  {
    q: "Who do I still have to trust?",
    a: "The attestor is trusted to sign honestly; Rilva makes every attestation checkable, not automatically true. A wrong or conflicting signature can be detected by anyone, but the contract cannot prevent it.",
  },
  {
    q: "Does low rainfall mean people lost money?",
    a: "Not necessarily. Rainfall deficit is not drought impact, and drought impact is not financial loss. The index ignores temperature, soil moisture, pasture, markets and conflict.",
  },
  {
    q: "Is this insurance, or are real funds involved?",
    a: "No. This is a testnet demonstration on Base Sepolia. No real funds, no insurance, no relief delivered. The contract has tests but no professional audit.",
  },
];

export default async function Home() {
  const { series, artifacts } = await loadScenarioEvidence();
  const a2021 = artifacts["yabelo-ond-2021"];
  const core = a2021.core;
  const seasons = series.observed;
  const baseHits = series.points.filter((p) => p.inBaseline && p.indexBps <= series.thresholdBps).length;

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────────── */}
      <header className="art-frame flex min-h-[min(920px,calc(100svh-40px))] flex-col">
        <PixelScene preset="highland" seed={11} sunX={0.18} sunY={0.32} />
        <div className="art-shade" />
        <PixelCritter kind="bird" scale={4} className="bob hidden sm:block" style={{ left: "12%", top: "30%" }} />
        <PixelCritter kind="bird" scale={3} className="bob hidden sm:block" style={{ right: "16%", top: "22%" }} />
        <SiteNav />
        <div className="on-art relative mx-auto mb-auto mt-8 max-w-[1120px] px-5 pb-12 text-center sm:mt-14">
          <p className="eyebrow fade-down text-white/90">Climate intelligence × verifiable finance</p>
          <SplitTitle
            text="Climate evidence you can verify. / Relief rules you can *trust*."
            className="display mx-auto mt-5 max-w-[1100px] text-[clamp(38px,4.6vw,68px)]"
          />
          <p className="reveal mx-auto mt-6 max-w-[57ch] text-[16px] leading-[1.65] text-white sm:text-[18px]" style={{ "--d": ".5s" } as React.CSSProperties}>
            Rilva turns historical rainfall observations into transparent, independently reproducible evidence for on-chain climate-relief
            funding decisions.
          </p>
          <div className="reveal mt-7 flex flex-wrap justify-center gap-3" style={{ "--d": ".65s" } as React.CSSProperties}>
            <ButtonLink href="/explore" variant="butter" arrow="→">
              Explore climate data
            </ButtonLink>
            <ButtonLink href="#see-it-work" variant="sheet" arrow="↓">
              See it work, no wallet
            </ButtonLink>
          </div>
          <p className="reveal mt-5 text-[12px] text-white/90" style={{ "--d": ".8s" } as React.CSSProperties}>
            Retrospective replays on the Base Sepolia testnet. No real funds.
          </p>
        </div>

        {/* real product preview, built from the OND 2021 evidence */}
        <div className="reveal relative mx-auto w-[min(1040px,calc(100%-24px))] translate-y-0" style={{ "--d": ".9s" } as React.CSSProperties}>
          <div className="rounded-t-[16px] bg-surface text-ink shadow-[0_-20px_60px_-30px_rgba(4,30,20,.5)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3 sm:px-6">
              <span className="grid size-8 place-items-center rounded-[9px] bg-mint text-[13px]" aria-hidden="true">≋</span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold">Yabelo · OND 2021</p>
                <p className="meta">ERA5 · {core.location.resolved.latitude}° N {core.location.resolved.longitude}° E · saved snapshot</p>
              </div>
              <span className="chip ml-auto bg-warn-soft text-warn">Retrospective replay</span>
            </div>
            <div className="grid gap-0 md:grid-cols-[1.5fr_1fr]">
              <div className="min-w-0 px-2 pt-3 sm:px-4">
                <div className="overflow-hidden">
                  <SeasonChart
                    points={series.points}
                    meanDmm={series.baseline.meanDmm}
                    baselineSumDmm={series.baseline.sumDmm}
                    baselineYears={series.baseline.years}
                    thresholdBps={series.thresholdBps}
                    selectedYear={2021}
                    height={210}
                  />
                </div>
              </div>
              <div className="border-t border-rule px-5 py-4 md:border-l md:border-t-0">
                <p className="meta">% of 1991–2020 normal</p>
                <p className="mt-1 font-display text-[52px] font-semibold leading-none tracking-[-0.05em] text-deficit tnum">
                  {formatBpsAsPercent(core.result.indexBps).split(".")[0]}
                  <span className="text-[0.45em]">.{formatBpsAsPercent(core.result.indexBps).split(".")[1]} %</span>
                </p>
                <div className="mt-3">
                  <RuleOutcome indexBps={core.result.indexBps} thresholdBps={core.result.thresholdBps} />
                </div>
                <div className="mt-3 hidden sm:block">
                  <HashField label="Evidence digest" value={a2021.evidenceDigest} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ── proof strip ───────────────────────────────────────────── */}
        <div className="container-rv flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-rule py-6 text-[12.5px]">
          <span className="text-ink-2">Built only on public, reproducible inputs.</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium">
            <span>ERA5 via Open-Meteo</span>
            <span aria-hidden="true" className="hidden h-4 w-px bg-rule sm:block" />
            <span>SRPN-v1 integer index</span>
            <span aria-hidden="true" className="hidden h-4 w-px bg-rule sm:block" />
            <span>EIP-712 attestation</span>
            <span aria-hidden="true" className="hidden h-4 w-px bg-rule sm:block" />
            <span>Base Sepolia testnet</span>
          </div>
        </div>

        <JudgePath />

        {/* ── problem ───────────────────────────────────────────────── */}
        <section className="container-rv py-16 sm:py-[90px]" aria-labelledby="problem-title">
          <div className="grid items-end gap-8 md:grid-cols-2">
            <h2 id="problem-title" className="h2 reveal">
              The rains fail.
              <br />
              The rule stays <em>private</em>.
            </h2>
            <p className="reveal max-w-[46ch] leading-[1.8] text-ink-2" style={{ "--d": ".1s" } as React.CSSProperties}>
              Drought-relief funding often runs on pre-agreed triggers: if the rains fail, money moves. For anyone outside the room, three
              questions are hard to answer.
            </p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ["Which data?", "Rainfall products disagree. The same season can look like a drought in one and normal in another."],
              ["How was it computed?", "The calculation often lives in a spreadsheet that nobody outside can rerun."],
              ["Who decided, and where did the money go?", "The audit trail is usually an email thread, not a public record."],
            ].map(([q, a], i) => (
              <li key={q} className="reveal card p-6" style={{ "--d": `${i * 0.1}s` } as React.CSSProperties}>
                <span className="num">{i + 1}</span>
                <p className="h3 mt-4">{q}</p>
                <p className="mt-2 text-[13.5px] leading-[1.8] text-ink-2">{a}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── how it works ──────────────────────────────────────────── */}
        <section id="how" className="container-rv scroll-mt-6 pb-16 sm:pb-[90px]" aria-labelledby="how-title">
          <div className="grid items-end gap-8 md:grid-cols-2">
            <h2 id="how-title" className="h2 reveal">
              Public rules.
              <br />
              Checkable evidence.
            </h2>
            <p className="reveal max-w-[46ch] leading-[1.8] text-ink-2" style={{ "--d": ".1s" } as React.CSSProperties}>
              Rilva makes a drought trigger a public, reproducible and enforceable artefact, in four steps that anyone can follow and rerun.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <article key={s.title} className={`reveal flex min-h-[380px] flex-col rounded-[14px] px-6 pb-7 pt-6 ${s.tone}`} style={{ "--d": `${i * 0.08}s` } as React.CSSProperties}>
                <span className="num">{i + 1}</span>
                <div className="grid flex-1 place-items-center py-5">
                  <IsoArt kind={s.art} />
                </div>
                <h3 className="h3">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.8] text-ink-2">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── case study ────────────────────────────────────────────── */}
        <section className="bg-paper-deep/60 py-16 sm:py-[90px]" aria-labelledby="case-title">
          <div className="container-rv">
            <div className="grid items-end gap-8 md:grid-cols-2">
              <div>
                <p className="eyebrow text-ink-2">Case study · Yabelo, Borena, Ethiopia</p>
                <h2 id="case-title" className="h2 reveal mt-3">
                  One grid cell.
                  <br />
                  Three short rains.
                </h2>
              </div>
              <p className="reveal max-w-[46ch] leading-[1.8] text-ink-2" style={{ "--d": ".1s" } as React.CSSProperties}>
                Borena&apos;s pastoral economy depends on the October–December Hagaya rains. At the ERA5 cell over Yabelo, here is how three
                recent seasons compare with the {series.baseline.startYear}–{series.baseline.endYear} normal of{" "}
                {formatDmmAsMm(series.baseline.meanDmm)} mm.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {seasons.map((s, i) => {
                const below = s.indexBps < 10000;
                const chirps = CHIRPS_OND[s.year];
                return (
                  <article key={s.year} className="reveal card-raised p-6" style={{ "--d": `${i * 0.1}s` } as React.CSSProperties}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-[19px] font-semibold tracking-[-0.03em]">OND {s.year}</p>
                      <span className={`chip ${s.triggered ? "bg-cream text-warn" : "bg-paper-deep text-ink-2"}`}>{s.triggered ? "Rule met" : "Rule not met"}</span>
                    </div>
                    <p className={`mt-5 font-display text-[54px] font-semibold leading-none tracking-[-0.05em] tnum ${below ? "text-deficit" : "text-normal"}`}>
                      {formatBpsAsPercent(s.indexBps).split(".")[0]}
                      <span className="text-[0.45em]">.{formatBpsAsPercent(s.indexBps).split(".")[1]} %</span>
                    </p>
                    <p className="mt-2 text-[13px] text-ink-2">of normal · {formatDmmAsMm(s.totalDmm)} mm in 92 days</p>
                    {chirps && <p className="mt-4 border-t border-rule pt-3 text-[12px] text-ink-3">CHIRPS v3 cross-check: {chirps.percentOfNormal} % (informational)</p>}
                  </article>
                );
              })}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink href="/explore" variant="butter" arrow="→">
                Open the Climate Explorer
              </ButtonLink>
              <p className="text-[12.5px] text-ink-2">
                Context from humanitarian monitoring:{" "}
                <a className="link" href="https://fews.net/east-africa/seasonal-monitor/december-2021" target="_blank" rel="noreferrer">
                  FEWS NET, Dec 2021 ↗
                </a>
                . Rilva does not verify impact reports.
              </p>
            </div>
          </div>
        </section>

        {/* ── evidence → settlement ─────────────────────────────────── */}
        <section className="container-rv py-16 sm:py-[90px]" aria-labelledby="flow-title">
          <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <h2 id="flow-title" className="h2 reveal">
                From evidence
                <br />
                to settlement.
              </h2>
              <p className="reveal mt-4 max-w-[42ch] leading-[1.8] text-ink-2">
                The attestor signs typed data, not a blank cheque. The contract re-checks every field before a single wei moves.
              </p>
              <ol className="mt-7 grid gap-4">
                {[
                  ["Same campaign, same spec", "The signature names the campaign id and the spec hash stored at creation."],
                  ["Same period", "Observation dates must match the campaign exactly."],
                  ["Right signer", "Only the campaign's designated attestor can produce a valid signature."],
                  ["Rule applied on-chain", "Index ≤ threshold releases to the beneficiary; otherwise the funder is refunded."],
                ].map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[24px_1fr] gap-3.5">
                    <span className="num">{i + 1}</span>
                    <div>
                      <p className="font-semibold">{t}</p>
                      <p className="text-[13px] text-ink-2">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="reveal overflow-hidden rounded-[18px] bg-ice px-4 pt-8 sm:px-8" style={{ "--d": ".1s" } as React.CSSProperties}>
              <div className="rounded-t-[14px] bg-surface shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3 border-b border-rule px-5 py-3.5">
                  <span className="grid size-8 place-items-center rounded-[9px] bg-ice text-[13px]" aria-hidden="true">✎</span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold">Attestation · EIP-712</p>
                    <p className="meta">Domain RilvaEscrow v1 · chain 84532</p>
                  </div>
                </div>
                <dl className="grid gap-0 px-5 py-2 text-[12.5px]">
                  {[
                    ["campaignId", "assigned on-chain at creation"],
                    ["indexBps", String(core.result.indexBps)],
                    ["observationStart", String(isoToYyyymmdd(core.periods.observed.start))],
                    ["observationEnd", String(isoToYyyymmdd(core.periods.observed.end))],
                    ["expiresAt", "signing time + 1 hour"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-rule py-2.5">
                      <dt className="font-mono text-ink-2">{k}</dt>
                      <dd className="text-right font-medium tnum">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid gap-3 px-5 pb-4 pt-2">
                  <HashField label="specHash" value={core.specHash} />
                  <HashField label="evidenceHash" value={a2021.evidenceDigest} />
                </div>
                <div className="mx-5 mb-5 rounded-[10px] bg-mint px-3.5 py-3 text-[12.5px]">
                  <p className="font-semibold">Predicted outcome: Released</p>
                  <p className="meta mt-0.5">{formatBpsAsPercent(core.result.indexBps)} % ≤ {formatBpsAsPercent(core.result.thresholdBps)} % · decided by the contract</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-right text-[11.5px] text-ink-3">Preview fields come from the real OND 2021 evidence file. No campaign shown here.</p>
        </section>

        {/* ── verification ──────────────────────────────────────────── */}
        <section className="container-rv pb-16 sm:pb-[90px]" aria-labelledby="verify-title">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="relative isolate order-2 grid aspect-[1/0.9] place-items-center overflow-hidden rounded-[18px] p-5 lg:order-1">
              <PixelScene preset="highland" seed={4} className="absolute inset-0 -z-10" sunX={0.8} sunY={0.25} huts={false} />
              <div className="w-full max-w-[420px] rounded-[14px] bg-surface text-ink shadow-[0_30px_60px_-20px_rgba(4,50,30,.4)]">
                <p className="border-b border-rule px-5 py-3.5 text-[13px] font-semibold">What /verify checks, with no wallet</p>
                <ol className="grid gap-0 px-5 py-2 text-[12.5px]">
                  {[
                    "The spec hash matches the published spec",
                    "The spec agrees with the on-chain terms",
                    "The index recomputes from ERA5",
                    "The evidence hash recomputes",
                    "The signer is the campaign's attestor",
                    "The outcome follows the rule",
                    "The funds went to the right address",
                  ].map((t, i) => (
                    <li key={t} className="flex items-center gap-3 border-b border-rule py-2 last:border-0">
                      <span className="num">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 id="verify-title" className="h2 reveal">
                Don&apos;t trust us.
                <br />
                Check the <em>math</em>.
              </h2>
              <p className="reveal mt-4 max-w-[44ch] leading-[1.8] text-ink-2">
                Every campaign has a public verification report. Your browser re-fetches the rainfall, recomputes the index and the hashes,
                recovers the signer, and compares everything with the chain.
              </p>
              <ul className="mt-6 grid gap-2.5 text-[13.5px]">
                <li>Cryptographically authentic: who signed which bytes.</li>
                <li>Data reproducible: same inputs, same hash.</li>
                <li>Contract conditions satisfied: the rule was applied on-chain.</li>
                <li className="text-ink-2">Not checked: whether the rainfall estimate is accurate, or whether anyone was helped.</li>
              </ul>
              <div className="mt-7">
                <ButtonLink href="/campaigns" variant="butter" arrow="→">
                  Browse campaigns
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>

        {/* ── limitations ───────────────────────────────────────────── */}
        <section className="container-rv pb-16 sm:pb-[90px]" aria-labelledby="limits-title">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div className="lg:sticky lg:top-10">
              <h2 id="limits-title" className="h2">
                Fair questions.
                <br />
                Plain answers.
              </h2>
              <p className="mt-4 max-w-[40ch] text-ink-2">
                What Rilva proves, and what it does not. More in the{" "}
                <Link className="link" href="/methodology">
                  methodology
                </Link>
                .
              </p>
            </div>
            <div>
              {limits(baseHits, series.baseline.years).map((l) => (
                <details key={l.q} className="group border-t border-rule last:border-b">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                    {l.q}
                    <span aria-hidden="true" className="mr-1 size-2 flex-none rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink transition-transform duration-300 group-open:rotate-[225deg]" />
                  </summary>
                  <p className="pb-6 pr-10 leading-[1.8] text-ink-2">{l.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── closing band ────────────────────────────────────────────── */}
      <section className="art-frame px-6 pb-48 pt-24 text-center sm:pb-56 sm:pt-28" aria-labelledby="final-title">
        <PixelScene preset="highland" seed={23} sky={["#2a1f4f", "#5b3f7a", "#c06c84", "#f6b26b"]} sunX={0.7} sunY={0.55} />
        <div className="art-shade" />
        <div className="on-art">
          <h2 id="final-title" className="display text-[clamp(34px,4.2vw,56px)]">
            Open the evidence.
            <br />
            Check the rule.
          </h2>
          <p className="mx-auto mt-4 max-w-[48ch] text-[16px] text-white/95">Every number on this site can be traced to a saved snapshot, a live response or a cited source.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/explore" variant="butter" arrow="→">
              Explore climate data
            </ButtonLink>
            <ButtonLink href="/methodology" variant="sheet" arrow="→">
              Read the methodology
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
