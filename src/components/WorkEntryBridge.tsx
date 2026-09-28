"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";

import { COVER_IMAGE_QUALITY } from "@/lib/imageQuality";
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
      <Image
        src={coverUrl}
        alt=""
        fill
        quality={COVER_IMAGE_QUALITY}
        sizes="100vw"
        loading="eager"
        draggable={false}
        decoding="sync"
        fetchPriority="high"
        className="object-cover object-center"
      />
    </div>
  );
}
