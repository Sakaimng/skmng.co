"use client";

import { useSyncExternalStore } from "react";

import {
  getWorkEntryCoverSnapshot,
  subscribeWorkEntryCover,
} from "@/lib/workNavEvents";

/**
 * Fixed cover that survives /work → /work/[project] route changes.
 * Uses the same optimized src as the project hero so hover → entry → hero
 * never swaps JPEG vs WebP (which reads as a blink on first load).
 */
export function WorkEntryBridge() {
  const coverUrl = useSyncExternalStore(
    subscribeWorkEntryCover,
    getWorkEntryCoverSnapshot,
    () => null,
  );

  if (!coverUrl) return null;

  return (
    <div
      className="work-entry-bridge pointer-events-none fixed inset-0 z-[14]"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        draggable={false}
        decoding="sync"
        fetchPriority="high"
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}
