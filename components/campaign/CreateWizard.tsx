"use client";

import Link from "next/link";
import { useState } from "react";
import type { Address } from "viem";
import { useBalance, useConnection, useWriteContract } from "wagmi";
import { HashField } from "@/components/chain/HashField";
import { useChainTime, useEscrowClient } from "@/components/chain/useRilva";
import { TxStatus, type TxState } from "@/components/chain/TxStatus";
import { WalletControl } from "@/components/chain/WalletControl";
import { NotConfigured } from "@/components/ui/States";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { MAX_DEADLINE_SECONDS, MIN_DEADLINE_SECONDS, validateCreateForm, type CreateFormErrors, type CreateFormInput } from "@/lib/app/createForm";
import { formatDuration, formatEth, formatUtc, seasonLabel, formatPct } from "@/lib/app/format";
import { describeRevert } from "@/lib/app/revert";
import { canonicalSpec, SCENARIOS, type ScenarioId } from "@/lib/climate";
import { campaignIdFromReceipt, campaignTermsFromSpec, prepareCreateCampaign } from "@/lib/contracts";
import { cn } from "@/lib/utils";

const STEPS = ["Season", "Roles", "Amount", "Review"] as const;
const DEADLINES = [
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 7 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
];

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="pl-1 text-[13px] font-semibold">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="pl-4 text-[12.5px] text-fail" role="alert">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="pl-4 text-[12px] text-ink-3">{hint}</p>
      )}
    </div>
  );
}

export function CreateWizard() {
  const connection = useConnection();
  const funder = connection.status === "connected" ? connection.address : undefined;
  const wrongChain = connection.status === "connected" && connection.chainId !== CHAIN.chain.id;
  const balance = useBalance({ address: funder, chainId: CHAIN.chain.id, query: { enabled: !!funder && !wrongChain } });
  const chainNow = useChainTime();
  const { client } = useEscrowClient();
  const write = useWriteContract();

  const [step, setStep] = useState(0);
  const [input, setInput] = useState<CreateFormInput>({ scenarioId: "yabelo-ond-2021", beneficiary: "", attestor: "", amountEth: "0.01", deadlineSeconds: 7 * 86400 });
  const [touched, setTouched] = useState(false);
  const [tx, setTx] = useState<TxState>({ step: "idle" });
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  if (!ESCROW.address) return <NotConfigured />;

  // Deadlines are computed from chain time (as the contract judges them), never the browser clock.
  const nowSec = chainNow.data ?? 0n;
  const timeKnown = chainNow.data !== undefined;
  const result = validateCreateForm(input, { now: nowSec, funder, balance: balance.data?.value });
  const errors: CreateFormErrors = result.ok ? {} : result.errors;
  const stepFields: Array<Array<keyof CreateFormInput>> = [["scenarioId"], ["beneficiary", "attestor"], ["amountEth", "deadlineSeconds"], []];
  const stepValid = (i: number) => stepFields[i]!.every((f) => !errors[f]);
  const set = (patch: Partial<CreateFormInput>) => setInput((v) => ({ ...v, ...patch }));
  const spec = SCENARIOS[(input.scenarioId as ScenarioId) in SCENARIOS ? (input.scenarioId as ScenarioId) : "yabelo-ond-2021"].spec;
  const terms = campaignTermsFromSpec(spec);
  const busy = tx.step === "simulating" || tx.step === "wallet" || tx.step === "pending";

  async function submit() {
    if (!result.ok || !funder || !client || !ESCROW.address) return;
    const call = prepareCreateCampaign({ escrow: ESCROW.address, ...result.value });
    try {
      setTx({ step: "simulating" });
      const sim = await client.simulateContract({ ...call, account: funder as Address });
      setTx({ step: "wallet" });
      const hash = await write.mutateAsync(sim.request);
      setTx({ step: "pending", hash });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") return setTx({ step: "failed", name: "Reverted", reason: "The transaction was mined but reverted. No campaign was created.", hash });
      const id = campaignIdFromReceipt(receipt.logs);
      if (id === null) return setTx({ step: "failed", name: "NoEvent", reason: "Mined, but no CampaignCreated event was found. Check the transaction.", hash });
      setCreatedId(id);
      setTx({ step: "confirmed", hash, note: `CampaignCreated emitted for campaign #${id}.` });
    } catch (e) {
      const r = describeRevert(e);
      setTx((t) => ({ step: "failed", name: r.name, reason: r.reason, hash: "hash" in t ? t.hash : undefined }));
    }
  }

  if (createdId !== null && tx.step === "confirmed") {
    return (
      <div className="card-raised mx-auto grid max-w-[640px] gap-5 p-6 sm:p-8">
        <p className="meta">Confirmed on {CHAIN.label}</p>
        <p className="font-display text-[34px] font-semibold tracking-[-0.04em]">Campaign #{createdId.toString()} is live.</p>
        <p className="text-[14px] leading-6 text-ink-2">
          {formatEth(result.ok ? result.value.value : 0n)} is now held by the contract. Only the attestor&apos;s signed evidence or the deadline can move it.
        </p>
        <TxStatus state={tx} />
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-butter" href={`/campaigns/${createdId}`}>Open the campaign →</Link>
          <Link className="btn btn-outline" href={`/verify/${createdId}`}>Public verification page</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="card p-5 sm:p-8">
        <ol className="flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className={cn("chip ring-1", i === step ? "bg-ink text-paper ring-ink" : "bg-surface text-ink-2 ring-rule", i > step && "cursor-not-allowed")}
                aria-current={i === step ? "step" : undefined}
                disabled={i > step && !(stepValid(step) && i === step + 1)}
                onClick={() => i <= step && setStep(i)}
              >
                <span className="tnum">{i + 1}</span> {s}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-7">
          {step === 0 && (
            <fieldset className="grid gap-3">
              <legend className="h3 mb-1">Which season should decide?</legend>
              <p className="mb-2 text-[13px] text-ink-2">
                Location, data source (ERA5, pinned), baseline (1991–2020) and the illustrative {formatPct(spec.thresholdBps)} % threshold are fixed for this demo.
                Only verified Yabelo replay seasons are available.
              </p>
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
                const s = SCENARIOS[id].spec;
                const t = campaignTermsFromSpec(s);
                return (
                  <label key={id} className={cn("flex cursor-pointer items-start gap-3 rounded-[14px] p-4 ring-1 transition-colors", input.scenarioId === id ? "bg-mint ring-accent" : "bg-surface ring-rule hover:ring-rule-strong")}>
                    <input type="radio" name="season" className="mt-1 accent-[var(--accent)]" checked={input.scenarioId === id} onChange={() => set({ scenarioId: id })} />
                    <span>
                      <span className="block text-[15px] font-semibold">{seasonLabel(t.observationStart, t.observationEnd)} · {s.location.label}</span>
                      <span className="block text-[12.5px] text-ink-2">
                        {s.period.start} → {s.period.end} · retrospective replay · vs {s.baseline.startYear}–{s.baseline.endYear} normal
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <p className="h3">Who receives, and who attests?</p>
              <Field id="beneficiary" label="Beneficiary (fixed forever)" hint="The only address that can ever receive a release." error={touched ? errors.beneficiary : undefined}>
                <input
                  id="beneficiary"
                  className="field mono"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x…"
                  value={input.beneficiary}
                  aria-invalid={touched && !!errors.beneficiary}
                  aria-describedby={touched && errors.beneficiary ? "beneficiary-err" : "beneficiary-hint"}
                  onChange={(e) => set({ beneficiary: e.target.value })}
                />
              </Field>
              <Field id="attestor" label="Attestor (independent data steward)" hint="Must recompute and sign. Cannot be you or the beneficiary." error={touched ? errors.attestor : undefined}>
                <input
                  id="attestor"
                  className="field mono"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x…"
                  value={input.attestor}
                  aria-invalid={touched && !!errors.attestor}
                  aria-describedby={touched && errors.attestor ? "attestor-err" : "attestor-hint"}
                  onChange={(e) => set({ attestor: e.target.value })}
                />
              </Field>
              <p className="text-[12.5px] text-ink-2">Funder: {funder ? <code className="font-mono">{funder}</code> : "connect a wallet at the review step"}</p>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <p className="h3">How much, and for how long?</p>
              <Field id="amount" label="Escrow amount (testnet ETH)" hint={balance.data ? `Wallet balance: ${formatEth(balance.data.value)}` : "Use a small testnet amount, e.g. 0.001–0.01."} error={touched ? errors.amountEth : undefined}>
                <div className="relative max-w-[280px]">
                  <input
                    id="amount"
                    className="field mono pr-16"
                    inputMode="decimal"
                    value={input.amountEth}
                    aria-invalid={touched && !!errors.amountEth}
                    aria-describedby={touched && errors.amountEth ? "amount-err" : "amount-hint"}
                    onChange={(e) => set({ amountEth: e.target.value })}
                  />
                  <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-3">ETH</span>
                </div>
              </Field>
              <fieldset className="grid gap-2">
                <legend className="mb-1 pl-1 text-[13px] font-semibold">Settlement window</legend>
                <div className="flex flex-wrap gap-2">
                  {DEADLINES.map((d) => (
                    <label key={d.seconds} className={cn("btn btn-sm cursor-pointer", input.deadlineSeconds === d.seconds ? "btn-ink" : "btn-outline")}>
                      <input type="radio" name="deadline" className="sr-only" checked={input.deadlineSeconds === d.seconds} onChange={() => set({ deadlineSeconds: d.seconds })} />
                      {d.label}
                    </label>
                  ))}
                </div>
                <p className="pl-1 text-[12px] text-ink-3">
                  Settlement closes around {timeKnown ? formatUtc(nowSec + BigInt(input.deadlineSeconds)) : "… (reading chain time)"}. After that, anyone can return the funds to you. Allowed:{" "}
                  {formatDuration(MIN_DEADLINE_SECONDS)} to {formatDuration(MAX_DEADLINE_SECONDS)}.
                </p>
              </fieldset>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-6">
              <p className="h3">Review the rule before you sign</p>
              <div className="rounded-[14px] bg-cream p-5 text-[14px] leading-7">
                <p>
                  You lock <strong>{result.ok ? formatEth(result.value.value) : input.amountEth + " ETH"}</strong>. If the attested{" "}
                  <strong>{seasonLabel(terms.observationStart, terms.observationEnd)}</strong> rainfall at {spec.location.label} is{" "}
                  <strong>at or below {formatPct(terms.thresholdBps)} %</strong> of the {spec.baseline.startYear}–{spec.baseline.endYear} normal, the contract sends
                  it to <code className="break-all font-mono text-[12.5px]">{input.beneficiary || "—"}</code>. Otherwise it comes back to you.
                </p>
                <p className="mt-2 text-[13px] text-ink-2">If nobody settles before {timeKnown ? formatUtc(nowSec + BigInt(input.deadlineSeconds)) : "the deadline"}, anyone can refund you.</p>
              </div>
              <ul className="grid gap-2 text-[13px] text-ink-2">
                <li>• These terms are permanent. The beneficiary, attestor, amount and rule cannot be changed.</li>
                <li>• You cannot withdraw before the deadline, and you cannot attest your own campaign.</li>
                <li>• {formatPct(terms.thresholdBps)} % of normal is an illustrative hackathon rule, not an official drought definition.</li>
                <li>• This is a retrospective replay on a testnet. No real funds or relief are involved.</li>
              </ul>
              <div className="grid gap-3">
                <HashField label="Spec hash (stored on-chain)" value={terms.specHash} />
                <details>
                  <summary className="cursor-pointer text-[13px] font-medium text-ink-2 hover:text-ink">Show the exact spec JSON ({terms.spec.length} bytes)</summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-[12px] bg-paper-deep p-4 font-mono text-[11.5px] leading-5">{JSON.stringify(JSON.parse(canonicalSpec(spec)), null, 2)}</pre>
                </details>
              </div>

              {!funder ? (
                <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-paper-deep p-4">
                  <p className="text-[13px] text-ink-2">Connect the funder wallet to continue.</p>
                  <WalletControl tone="paper" />
                </div>
              ) : wrongChain ? (
                <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-warn-soft p-4">
                  <p className="text-[13px]">Your wallet is on another network. No transaction will be sent until you switch.</p>
                  <WalletControl tone="paper" />
                </div>
              ) : (
                <button type="button" className="btn btn-butter w-full justify-between sm:w-auto" disabled={!result.ok || busy || !timeKnown} onClick={submit}>
                  Lock {result.ok ? formatEth(result.value.value) : "funds"} and create campaign <span className="i" aria-hidden="true">→</span>
                </button>
              )}
              {!result.ok && (
                <p className="text-[12.5px] text-fail" role="alert">
                  Fix: {Object.values(errors).join(" ")}
                </p>
              )}
              <TxStatus state={tx} />
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-rule pt-5">
            <button type="button" className="btn btn-sm btn-outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => {
                setTouched(true);
                if (stepValid(step)) setStep((s) => s + 1);
              }}
            >
              Continue <span className="i" aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>

      <aside className="grid content-start gap-4">
        <div className="rounded-[18px] bg-ice p-5 text-[13px] leading-6">
          <p className="font-semibold">What happens next</p>
          <ol className="mt-2 grid gap-2 text-ink-2">
            <li>1. The contract stores the spec hash and locks the ETH.</li>
            <li>2. The attestor recomputes the index from ERA5 and signs it.</li>
            <li>3. Anyone submits the signature; the contract applies the rule.</li>
            <li>4. Anyone can verify every step at /verify, with no wallet.</li>
          </ol>
        </div>
        <div className="rounded-[18px] bg-paper-deep/70 p-5 text-[12.5px] leading-6 text-ink-2">
          <p className="font-semibold text-ink">Wallet and network</p>
          <p>{CHAIN.label}{CHAIN.isLocal && " — a development chain on this computer, not a public network."}</p>
          <div className="mt-3">
            <WalletControl tone="paper" />
          </div>
        </div>
      </aside>
    </div>
  );
}
