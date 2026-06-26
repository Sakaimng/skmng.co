"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { WorkEntryBridge } from "@/components/WorkEntryBridge";
import { WorkPinnedTitles } from "@/components/WorkPinnedTitles";
import {
  getWorkChromeSnapshot,
  subscribeWorkChromeStore,
  workChromeCallbacks,
  WORK_CHROME_SERVER_SNAPSHOT,
} from "@/lib/workChromeStore";
import { workTitleRefs } from "@/lib/workTitleRefs";

/** Layout-level work chrome that survives /work ↔ /work/[project] navigations. */
export function WorkChromeLayer() {
  const pathname = usePathname();
  const snapshot = useSyncExternalStore(
    subscribeWorkChromeStore,
    getWorkChromeSnapshot,
    () => WORK_CHROME_SERVER_SNAPSHOT,
  );

  const onWorkRoute = pathname === "/work" || /^\/work\/[^/]+$/.test(pathname);
  const { pins, activeSlug, registry } = snapshot;
  const displaySlug = activeSlug;
  const showPinned =
    onWorkRoute &&
    Boolean(pins && displaySlug && pins[displaySlug]);

  return (
    <>
      <WorkEntryBridge />
      {showPinned ? (
        <WorkPinnedTitles
          projects={registry.projects}
          pins={pins!}
          activeSlug={displaySlug!}
          titleRefs={workTitleRefs}
          clipHidden={registry.clipHidden}
          titleRevealInProgress={registry.titleRevealInProgress}
          interactive={registry.interactive && pathname === "/work"}
          onSelect={workChromeCallbacks.onSelect ?? undefined}
          onHover={workChromeCallbacks.onHover ?? undefined}
        />
      ) : null}
    </>
  );
}
