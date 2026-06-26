"use client";

import { useLayoutEffect, useState } from "react";

import { GlobalSiteHeader } from "@/components/GlobalSiteHeader";

/** Client-only mount so sessionStorage boot state cannot mismatch SSR. */
export function DeferredGlobalSiteHeader() {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    // Layout effect keeps chrome (incl. theme toggle) available on the first paint with the preloader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <GlobalSiteHeader />;
}
