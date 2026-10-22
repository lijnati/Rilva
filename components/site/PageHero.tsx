import { PixelScene, type ScenePreset } from "./PixelScene";
import { SiteNav } from "./SiteNav";

/**
 * Slim art banner that tops every app page: the pixel scene in an inset rounded frame,
 * the nav, then the page's eyebrow, title and one-line lede (pixel-meadow "Paper" mode).
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  seed,
  preset = "highland",
  sky,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  seed: number;
  preset?: ScenePreset;
  sky?: string[];
  children?: React.ReactNode;
}) {
  return (
    <header className="art-frame">
      <PixelScene preset={preset} seed={seed} sky={sky} sunX={0.82} sunY={0.24} />
      <div className="art-shade" />
      {/* Short banners put copy over the hills; a left-weighted shade keeps it readable (skill: strengthen haze, never shrink type). */}
      <div className="absolute inset-0 -z-[1] bg-[linear-gradient(90deg,rgba(6,28,20,.55),rgba(6,28,20,.25)_45%,transparent_75%)]" aria-hidden="true" />
      <SiteNav />
      <div className="on-art container-rv pb-24 pt-6 sm:pb-36 sm:pt-10">
        <p className="eyebrow text-white/90">{eyebrow}</p>
        <h1 className="display mt-3 max-w-[22ch] text-[clamp(34px,4.6vw,60px)]">{title}</h1>
        {lede && <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.65] text-white/95 sm:text-[17px]">{lede}</p>}
        {children}
      </div>
    </header>
  );
}
