"use client";

import { useLayoutEffect, useRef } from "react";

const MOBILE_MQ = "(max-width: 767px)";
const WORK_NAV_LINK_SELECTOR = '[data-nav-href="/work"]';

/** Pins work titles under the header nav, aligned with the Work link (mobile) or first nav link (desktop). */
export function useWorkNavAlign(gapPx = 14, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!enabled) return;

    const list = ref.current;
    if (!list) return;

    const headerNav = document.querySelector<HTMLElement>("header nav");
    if (!headerNav) return;

    const mobileMq = window.matchMedia(MOBILE_MQ);
    let raf = 0;

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const alignLink =
          (mobileMq.matches
            ? headerNav.querySelector<HTMLElement>(WORK_NAV_LINK_SELECTOR)
            : null) ??
          headerNav.querySelector<HTMLElement>(".nav-link");
        const navRect = headerNav.getBoundingClientRect();

        list.style.position = "fixed";
        list.style.top = `${navRect.bottom + gapPx}px`;
        list.style.zIndex = "30";

        if (alignLink) {
          list.style.left = `${alignLink.getBoundingClientRect().left}px`;
          list.style.right = "auto";
          return;
        }

        const insetLeft = Math.max(window.innerWidth * 0.02, 16);
        list.style.left = `${insetLeft}px`;
        list.style.right = "auto";
      });
    };

    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(headerNav);
    window.addEventListener("resize", sync, { passive: true });
    mobileMq.addEventListener("change", sync);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      mobileMq.removeEventListener("change", sync);
      list.style.removeProperty("position");
      list.style.removeProperty("top");
      list.style.removeProperty("left");
      list.style.removeProperty("right");
      list.style.removeProperty("z-index");
    };
  }, [gapPx, enabled]);

  return ref;
}
