"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";

const SITE_BOOT_STORAGE_KEY = "skmng-site-booted";
const SITE_BOOT_EVENT = "skmng:site-booted";
const PENDING_NAV_REVEAL_KEY = "skmng-pending-nav-reveal";

function isFullPageReload() {
  const nav = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}

export function GlobalSiteHeader() {
  const pathname = usePathname() ?? "/";
  const [isBooted, setIsBooted] = useState(() => {
    if (typeof window === "undefined") return pathname !== "/";
    if (isFullPageReload()) return false;
    return window.sessionStorage.getItem(SITE_BOOT_STORAGE_KEY) === "1";
  });
  const [playLandingReveal, setPlayLandingReveal] = useState(false);

  const handleLandingRevealDone = useCallback(() => {
    setPlayLandingReveal(false);
  }, []);

  useEffect(() => {
    let booted: boolean;

    if (isFullPageReload()) {
      window.sessionStorage.removeItem(SITE_BOOT_STORAGE_KEY);
      window.sessionStorage.removeItem(PENDING_NAV_REVEAL_KEY);
      booted = false;
    } else {
      booted = window.sessionStorage.getItem(SITE_BOOT_STORAGE_KEY) === "1";
    }

    // Mirrors sessionStorage immediately after hydration/reload detection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsBooted(booted);

    if (booted) {
      const pending =
        window.sessionStorage.getItem(PENDING_NAV_REVEAL_KEY) === "1";
      if (pending) {
        window.sessionStorage.removeItem(PENDING_NAV_REVEAL_KEY);
        setPlayLandingReveal(true);
      }
    }

    const syncBootState = () => {
      const nextBooted =
        window.sessionStorage.getItem(SITE_BOOT_STORAGE_KEY) === "1";
      setIsBooted(nextBooted);
      if (
        nextBooted &&
        window.sessionStorage.getItem(PENDING_NAV_REVEAL_KEY) === "1"
      ) {
        window.sessionStorage.removeItem(PENDING_NAV_REVEAL_KEY);
        setPlayLandingReveal(true);
      }
    };

    window.addEventListener(SITE_BOOT_EVENT, syncBootState);
    window.addEventListener("storage", syncBootState);

    return () => {
      window.removeEventListener(SITE_BOOT_EVENT, syncBootState);
      window.removeEventListener("storage", syncBootState);
    };
  }, []);

  // Always render SiteHeader — the nav SKMNG is the real preloader SKMNG element.
  // isPreloading=true during the home-page preloader: raises header above the
  // preloader overlay so SKMNG is visible at its exact nav position, while nav
  // items remain hidden until the preloader is done.
  return (
    <SiteHeader
      currentPath={pathname}
      playLandingReveal={playLandingReveal}
      onLandingRevealDone={handleLandingRevealDone}
      isPreloading={pathname === "/" && !isBooted}
    />
  );
}
