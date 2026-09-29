"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { usePageTransition } from "@/components/PageTransitionProvider";
import {
  formatJournalDate,
  formatJournalTime,
  type JournalListItem,
} from "@/lib/journal";

const NAV_CLEARANCE_PX = 16;

const journalCellClass =
  "info-para-fade w-full border-0 bg-transparent p-0 text-left max-md:[&:nth-child(odd)]:pl-[max(2vw,env(safe-area-inset-left))] max-md:[&:nth-child(even)]:pr-[max(2vw,env(safe-area-inset-right))] max-md:[&:nth-child(even)]:text-right md:[&:nth-child(3n+1)]:pl-[max(2vw,env(safe-area-inset-left))] md:[&:nth-child(3n)]:pr-[max(2vw,env(safe-area-inset-right))] md:[&:nth-child(3n)]:text-right";

const journalGridClass =
  "journal-grid grid w-full grid-cols-2 gap-x-0 gap-y-[9px] md:grid-cols-3 md:gap-y-[6px]";

function rowsThatFit(available: number, cellH: number, rowGap: number) {
  if (cellH <= 0 || available <= 0) return 0;
  return Math.max(0, Math.floor((available + rowGap) / (cellH + rowGap)));
}

export function JournalIndex({ entries }: { entries: JournalListItem[] }) {
  const { navigate } = usePageTransition();
  const { locale } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const [aboveCount, setAboveCount] = useState(entries.length);
  const [belowTop, setBelowTop] = useState<number | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const grids = [...root.querySelectorAll<HTMLElement>(".journal-grid")];
    const grid = grids.find((node) => node.querySelector("button"));
    const cell = grid?.querySelector<HTMLElement>("button");
    if (!grid || !cell) return;

    const header = document.querySelector<HTMLElement>(".site-header-grid");
    const headerRect = header?.getBoundingClientRect();
    const headerReady = !!headerRect && headerRect.height > 0;
    const navTop = headerReady ? headerRect.top : window.innerHeight / 2 - 24;
    const navBottom = headerReady ? headerRect.bottom : window.innerHeight / 2 + 24;

    const rootRect = root.getBoundingClientRect();
    const padTop = parseFloat(getComputedStyle(root).paddingTop) || 0;
    const rowGap = parseFloat(getComputedStyle(grid).rowGap) || 0;
    const cellH = cell.getBoundingClientRect().height;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    const available = navTop - rootRect.top - padTop - NAV_CLEARANCE_PX;
    const nextAbove = Math.min(entries.length, rowsThatFit(available, cellH, rowGap) * cols);
    const nextBelow = Math.round(navBottom - rootRect.top + NAV_CLEARANCE_PX);

    setAboveCount((prev) => (prev === nextAbove ? prev : nextAbove));
    setBelowTop((prev) => (prev === nextBelow ? prev : nextBelow));
  }, [entries.length]);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    const ro = new ResizeObserver(() => measure());
    if (root) ro.observe(root);
    const watchHeader = () => {
      const header = document.querySelector(".site-header-grid");
      if (header) ro.observe(header);
    };
    watchHeader();
    window.addEventListener("resize", measure);

    const mo = new MutationObserver(() => {
      const header = document.querySelector(".site-header-grid");
      if (!header || header.getBoundingClientRect().height <= 0) return;
      watchHeader();
      measure();
      mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const frame = requestAnimationFrame(() => {
      watchHeader();
      measure();
    });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const above = entries.slice(0, aboveCount);
  const below = entries.slice(aboveCount);

  const renderEntry = (entry: JournalListItem, index: number) => {
    const dateLabel = formatJournalDate(entry.dateMs, locale);
    const timeLabel = formatJournalTime(entry.dateMs, locale);

    return (
      <button
        key={entry.slug}
        type="button"
        onClick={() => navigate(`/journal/${entry.slug}`)}
        aria-label={`${dateLabel} ${timeLabel}`}
        className={journalCellClass}
        style={{ animationDelay: `${index * 0.04 + 0.06}s` }}
      >
        <span
          className={`contact-link block leading-none text-foreground ${locale === "en" ? "uppercase" : ""}`}
        >
          {dateLabel}
        </span>
        <span className="mt-px block leading-none text-foreground">
          {timeLabel}
        </span>
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className="altPadding relative z-10 h-[100dvh] w-full overflow-hidden"
    >
      <div className={journalGridClass}>{above.map(renderEntry)}</div>
      {below.length > 0 && belowTop != null ? (
        <div
          className="journal-index-below absolute inset-x-0 bottom-0 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[max(4.5rem,env(safe-area-inset-bottom))]"
          style={{ top: belowTop }}
        >
          <div className={journalGridClass}>
            {below.map((entry, index) => renderEntry(entry, aboveCount + index))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
