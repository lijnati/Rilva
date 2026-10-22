import { ETHIOPIA_PATH, MAP_PROJECTION, NEIGHBOUR_PATHS } from "@/lib/app/mapOutline";

/**
 * Static locator (DESIGN.md §6): Ethiopia (Natural Earth admin-0), the requested point, the ERA5 0.25° cell
 * Open-Meteo resolved to, and the CHIRPS 0.05° cell, with a magnified inset. Not interactive.
 */
const { lon0, lat0, k, width, height } = MAP_PROJECTION;
const px = (lon: number, lat: number) => [(lon - lon0) * k, (lat0 - lat) * k] as const;

// 1° of longitude ≈ 111.32·cos(lat) km; 100 km at ~5° N.
const KM100_DEG = 100 / (111.32 * Math.cos((5 * Math.PI) / 180));

export function LocatorMap({
  requested,
  era5Cell,
  chirpsCell,
  label,
}: {
  requested: { latitude: number; longitude: number };
  era5Cell: { latitude: number; longitude: number; size: number };
  chirpsCell: { latitude: number; longitude: number; size: number };
  label: string;
}) {
  const [qx, qy] = px(requested.longitude, requested.latitude);

  // Inset: 0.4° square around the cells, magnified.
  const IN = { size: 200, span: 0.4 };
  const inK = IN.size / IN.span;
  const c = { lon: era5Cell.longitude, lat: era5Cell.latitude };
  const ix = (lon: number) => (lon - (c.lon - IN.span / 2)) * inK;
  const iy = (lat: number) => (c.lat + IN.span / 2 - lat) * inK;
  const cell = (g: { latitude: number; longitude: number; size: number }) => ({
    x: ix(g.longitude - g.size / 2),
    y: iy(g.latitude + g.size / 2),
    s: g.size * inK,
  });
  const e = cell(era5Cell);
  const ch = cell(chirpsCell);

  return (
    <figure className="card overflow-hidden p-0">
      <div className="grid gap-0 md:grid-cols-[1.35fr_1fr]">
        <div className="grid place-items-center bg-paper-deep/50">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="map-title map-desc"
          className="h-auto w-full"
        >
          <title id="map-title">Location of the study point in Ethiopia</title>
          <desc id="map-desc">
            {`${label}: requested point ${requested.latitude}° N, ${requested.longitude}° E, inside the ERA5 0.25° grid cell centred at ${era5Cell.latitude}° N, ${era5Cell.longitude}° E.`}
          </desc>
          {Object.entries(NEIGHBOUR_PATHS).map(([name, d]) => (
            <path key={name} d={d} fill="none" stroke="var(--rule-strong)" strokeWidth="1" />
          ))}
          <path d={ETHIOPIA_PATH} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth="1.4" strokeLinejoin="round" />
          <text x={px(39.2, 9.4)[0]} y={px(39.2, 9.4)[1]} fontSize="17" fill="var(--ink-2)" fontFamily="var(--font-display)" fontWeight="600">
            Ethiopia
          </text>
          <text x={px(38.6, 2.95)[0]} y={px(38.6, 2.95)[1]} fontSize="12" fill="var(--ink-3)">Kenya</text>
          <text x={px(44.6, 4.2)[0]} y={px(44.6, 4.2)[1]} fontSize="12" fill="var(--ink-3)">Somalia</text>
          <rect
            x={px(era5Cell.longitude - era5Cell.size / 2, 0)[0]}
            y={px(0, era5Cell.latitude + era5Cell.size / 2)[1]}
            width={era5Cell.size * k}
            height={era5Cell.size * k}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1.5"
          />
          <circle cx={qx} cy={qy} r="11" fill="none" stroke="var(--ink)" strokeWidth="1" opacity=".5" />
          <circle cx={qx} cy={qy} r="3.5" fill="var(--ink)" />
          <text x={qx + 15} y={qy + 4} fontSize="13" fontWeight="600" fill="var(--ink)">Yabelo</text>
          {/* scale bar */}
          <g transform={`translate(24 ${height - 26})`}>
            <path d={`M0 0h${KM100_DEG * k}`} stroke="var(--ink-2)" strokeWidth="2" />
            <path d={`M0 -4v8M${KM100_DEG * k} -4v8`} stroke="var(--ink-2)" strokeWidth="1.2" />
            <text x={KM100_DEG * k + 8} y="4" fontSize="11" fill="var(--ink-2)">100 km</text>
          </g>
        </svg>
        </div>

        <div className="border-t border-rule p-5 md:border-l md:border-t-0">
          <p className="meta">Grid cells, magnified</p>
          <svg viewBox={`0 0 ${IN.size} ${IN.size}`} className="mx-auto mt-3 h-auto w-full max-w-[220px]" role="img" aria-label="ERA5 and CHIRPS grid cells around the requested point">
            <rect x="0" y="0" width={IN.size} height={IN.size} fill="var(--paper-deep)" rx="10" />
            <rect x={e.x} y={e.y} width={e.s} height={e.s} fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
            <rect x={ch.x} y={ch.y} width={ch.s} height={ch.s} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 2" />
            <circle cx={ix(requested.longitude)} cy={iy(requested.latitude)} r="3.5" fill="var(--ink)" />
          </svg>
          <dl className="mt-4 grid gap-2 text-[12.5px] leading-5">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 inline-block size-3 flex-none border-[1.5px] border-ink bg-surface" aria-hidden="true" />
              <div>
                <dt className="font-medium">ERA5 cell (decision source)</dt>
                <dd className="text-ink-2">{era5Cell.size}° ≈ 28 km, centred {era5Cell.latitude}° N, {era5Cell.longitude}° E</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-1 inline-block size-3 flex-none border border-dashed border-ink-3" aria-hidden="true" />
              <div>
                <dt className="font-medium">CHIRPS v3 cell (cross-check only)</dt>
                <dd className="text-ink-2">{chirpsCell.size}° ≈ 5.5 km, centred {chirpsCell.latitude}° N, {chirpsCell.longitude}° E</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5 inline-block size-2 flex-none rounded-full bg-ink" aria-hidden="true" />
              <div>
                <dt className="font-medium">Requested point</dt>
                <dd className="text-ink-2">{requested.latitude}° N, {requested.longitude}° E</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
      <figcaption className="border-t border-rule px-5 py-3 text-[11.5px] text-ink-3">
        Outline: Natural Earth 1:50m (public domain). A grid cell is not a farm, a household or Borena Zone.
      </figcaption>
    </figure>
  );
}
