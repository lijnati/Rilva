"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Adds `.is-in` to `.reveal` elements as they scroll into view (pixel-meadow blur-to-sharp reveal). */
export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (el: Element) => el.classList.add("is-in");
    if (reduce || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    const scan = () => document.querySelectorAll(".reveal:not(.is-in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
  return null;
}
