"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { SeasonPoint } from "@/lib/app/explorerSeries";
import { CHIRPS_OND } from "@/lib/app/chirps";
import { formatBpsAsPercent, formatDmmAsMm } from "@/lib/climate";

/**
 * OND totals 1991–2023 (DESIGN.md §6 SeasonChart). Heights are drawn from integer dmm/10; every label
 * is formatted from integers with the SRPN display helpers. Baseline seasons are grey, replay seasons are
 * outlined, the selected replay is filled ochre (below normal) or teal (at/above normal).
 */
interface Row extends SeasonPoint {
  mm: number;
}

function TooltipBody({ active, payload, thresholdBps }: Pick<TooltipContentProps<ValueType, NameType>, "active" | "payload"> & { thresholdBps: number }) {
  const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
  if (!row) return null;
  const chirps = CHIRPS_OND[row.year];
  return (
    <div className="card-raised min-w-[190px] px-4 py-3 text-[12.5px] leading-5">
      <p className="font-display text-[15px] font-semibold tracking-[-0.02em]">OND {row.year}</p>
      <p className="meta mt-0.5">{row.inBaseline ? "Baseline season" : "Replay season"}</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 tnum">
        <dt className="text-ink-2">ERA5 total</dt>
        <dd className="text-right font-medium">{formatDmmAsMm(row.totalDmm)} mm</dd>
        <dt className="text-ink-2">% of 1991–2020 normal</dt>
        <dd className="text-right font-medium">{formatBpsAsPercent(row.indexBps)} %</dd>
        <dt className="text-ink-2">≤ {formatBpsAsPercent(thresholdBps)} % rule</dt>
        <dd className="text-right font-medium">{row.indexBps <= thresholdBps ? "Met" : "Not met"}</dd>
        {chirps && (
          <>
            <dt className="text-ink-2">CHIRPS v3 (info)</dt>
            <dd className="text-right font-medium">{chirps.percentOfNormal} %</dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function SeasonChart({
  points,
  meanDmm,
  baselineSumDmm,
  baselineYears,
  thresholdBps,
  selectedYear,
  onSelect,
  height = 340,
}: {
  points: SeasonPoint[];
  meanDmm: number;
  baselineSumDmm: number;
  baselineYears: number;
  thresholdBps: number;
  selectedYear?: number;
  onSelect?: (year: number) => void;
  height?: number;
}) {
  const data: Row[] = points.map((p) => ({ ...p, mm: p.totalDmm / 10 }));
  const normalMm = baselineSumDmm / baselineYears / 10;
  const thresholdMm = (normalMm * thresholdBps) / 10000;
  const selectable = new Set(points.filter((p) => !p.inBaseline).map((p) => p.year));

  return (
    <BarChart
      responsive
      data={data}
      style={{ width: "100%", height }}
      margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
      barCategoryGap="22%"
      accessibilityLayer
      desc={`OND seasonal totals in mm; the 1991–2020 normal is ${formatDmmAsMm(meanDmm)} mm and the illustrative threshold is ${formatBpsAsPercent(thresholdBps)} % of normal.`}
    >
      <CartesianGrid vertical={false} stroke="var(--rule)" />
      <XAxis
        dataKey="year"
        tickLine={false}
        axisLine={{ stroke: "var(--rule-strong)" }}
        tick={{ fill: "var(--ink-3)", fontSize: 11 }}
        interval="preserveStartEnd"
        minTickGap={14}
      />
      <YAxis
        width={52}
        tickLine={false}
        axisLine={false}
        tick={{ fill: "var(--ink-3)", fontSize: 11 }}
      />
      <Tooltip
        cursor={{ fill: "var(--paper-deep)", opacity: 0.7 }}
        content={(props) => <TooltipBody active={props.active} payload={props.payload} thresholdBps={thresholdBps} />}
        isAnimationActive={false}
      />
      <Bar
        dataKey="mm"
        radius={[3, 3, 0, 0]}
        isAnimationActive={false}
        onClick={(entry) => {
          const year = (entry as unknown as { payload?: Row }).payload?.year;
          if (year !== undefined && selectable.has(year)) onSelect?.(year);
        }}
      >
        {data.map((d) => {
          const selected = d.year === selectedYear;
          const below = d.indexBps < 10000;
          const fill = d.inBaseline ? "var(--baseline)" : selected ? (below ? "var(--deficit)" : "var(--normal)") : "transparent";
          const stroke = d.inBaseline ? "none" : selected ? fill : "var(--ink-2)";
          return (
            <Cell
              key={d.year}
              fill={fill}
              stroke={stroke}
              strokeWidth={d.inBaseline ? 0 : 1.5}
              cursor={selectable.has(d.year) ? "pointer" : "default"}
            />
          );
        })}
      </Bar>
      <ReferenceLine
        y={normalMm}
        stroke="var(--normal)"
        strokeWidth={1.25}
      />
      <ReferenceLine
        y={thresholdMm}
        stroke="var(--deficit)"
        strokeDasharray="5 4"
        strokeWidth={1.25}
      />
    </BarChart>
  );
}
