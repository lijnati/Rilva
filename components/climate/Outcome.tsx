import { formatBpsAsPercent } from "@/lib/climate";

/** Rule outcome, carried by icon + words (never colour alone). */
export function RuleOutcome({ indexBps, thresholdBps }: { indexBps: number; thresholdBps: number }) {
  const met = indexBps <= thresholdBps;
  const t = formatBpsAsPercent(thresholdBps).replace(/\.00$/, "");
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 grid size-5 flex-none place-items-center rounded-full text-[11px] font-bold ${met ? "bg-deficit text-paper" : "bg-paper-deep text-ink ring-1 ring-rule-strong"}`}
        aria-hidden="true"
      >
        {met ? "≤" : ">"}
      </span>
      <p className="text-[14px] leading-6">
        <strong className="font-semibold">{met ? `At or below ${t} % → condition met` : `Above ${t} % → condition not met`}</strong>
        <span className="block text-[12.5px] text-ink-2">
          {met ? "A valid attestation would release the escrow to the beneficiary." : "A valid attestation would refund the funder."}
        </span>
      </p>
    </div>
  );
}

export function thresholdNote(thresholdBps: number): string {
  return `${formatBpsAsPercent(thresholdBps).replace(/\.00$/, "")} % of normal is an illustrative hackathon rule, not an official drought definition.`;
}
export const ERA5_NOTE =
  "Rainfall estimate from ERA5 reanalysis (a model, not a rain gauge) for one ~28 km grid cell. It does not measure drought impact or financial loss.";
