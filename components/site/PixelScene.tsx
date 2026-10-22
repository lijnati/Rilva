"use client";

import { useEffect, useRef } from "react";

/**
 * Procedural 16-bit scene from the pixel-meadow-ui skill (public/vendor/pixel-scene.js, vendored verbatim).
 * The script attaches `window.PixelScene`; it is loaded once on demand. The art is decorative (aria-hidden).
 */
interface PixelSceneApi {
  mount(el: HTMLElement, opts: Record<string, unknown>): { canvas: HTMLCanvasElement };
  sprite(el: HTMLElement, name: "bee" | "butterfly" | "bird", opts?: { scale?: number }): HTMLCanvasElement | null;
}

declare global {
  interface Window {
    PixelScene?: PixelSceneApi;
  }
}

let loader: Promise<PixelSceneApi> | null = null;

function loadPixelScene(): Promise<PixelSceneApi> {
  if (window.PixelScene) return Promise.resolve(window.PixelScene);
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vendor/pixel-scene.js";
    s.async = true;
    s.onload = () => (window.PixelScene ? resolve(window.PixelScene) : reject(new Error("PixelScene missing")));
    s.onerror = () => {
      loader = null;
      reject(new Error("pixel-scene.js failed to load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export type ScenePreset = "meadow" | "bloom" | "dusk" | "highland";

export function PixelScene({
  preset = "highland",
  seed,
  sky,
  pixel,
  sunX,
  sunY,
  huts,
  className = "art-layer",
}: {
  preset?: ScenePreset;
  seed: number;
  sky?: string[];
  pixel?: number;
  sunX?: number;
  sunY?: number;
  huts?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const skyKey = sky?.join(",");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    loadPixelScene()
      .then((api) => {
        if (cancelled) return;
        el.replaceChildren(); // StrictMode double-mount guard
        api.mount(el, { preset, seed, sky: skyKey?.split(","), pixel, sunX, sunY, huts });
      })
      .catch(() => {
        /* the frame keeps its solid sky fallback colour */
      });
    return () => {
      cancelled = true;
      el.replaceChildren();
    };
  }, [preset, seed, skyKey, pixel, sunX, sunY, huts]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}

export function PixelCritter({
  kind,
  scale = 4,
  className,
  style,
}: {
  kind: "bee" | "butterfly" | "bird";
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    loadPixelScene()
      .then((api) => {
        if (cancelled) return;
        el.replaceChildren();
        api.sprite(el, kind, { scale });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      el.replaceChildren();
    };
  }, [kind, scale]);
  return <div ref={ref} className={`critter ${className ?? ""}`} style={style} aria-hidden="true" />;
}
