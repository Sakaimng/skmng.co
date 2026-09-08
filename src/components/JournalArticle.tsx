"use client";

import { useCallback, useEffect } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { usePageTransition } from "@/components/PageTransitionProvider";
import {
  formatJournalDate,
  formatJournalTime,
  type JournalEntry,
} from "@/lib/journal";

export function JournalArticle({ entry }: { entry: JournalEntry }) {
  const { navigate } = usePageTransition();
  const { locale, messages } = useLocale();
  const dateLabel = formatJournalDate(entry.dateMs, locale);
  const timeLabel = formatJournalTime(entry.dateMs, locale);

  const close = useCallback(() => {
    navigate("/journal");
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-[max(2.5%,env(safe-area-inset-top))] z-[80] flex items-start justify-between pl-[max(2vw,env(safe-area-inset-left))] pr-[max(2vw,env(safe-area-inset-right))]">
        <div className="pointer-events-none flex items-center gap-[0.5em] text-foreground">
          <p className={`m-0 leading-none ${locale === "en" ? "uppercase" : ""}`}>
            {dateLabel}
          </p>
          <p className="m-0 leading-none">{timeLabel}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={messages.a11y.closeJournal}
          className="pointer-events-auto border-0 bg-transparent p-0 leading-none text-foreground"
        >
          {messages.journal.close}
        </button>
      </div>

      <button
        type="button"
        onClick={() => entry.prev && navigate(`/journal/${entry.prev.slug}`)}
        disabled={!entry.prev}
        aria-label={messages.a11y.olderJournal}
        className="fixed bottom-[max(2.5%,env(safe-area-inset-bottom))] left-[max(2vw,env(safe-area-inset-left))] z-[80] border-0 bg-transparent p-0 leading-none text-foreground disabled:opacity-0"
      >
        {messages.journal.older}
      </button>
      <button
        type="button"
        onClick={() => entry.next && navigate(`/journal/${entry.next.slug}`)}
        disabled={!entry.next}
        aria-label={messages.a11y.newerJournal}
        className="fixed bottom-[max(2.5%,env(safe-area-inset-bottom))] right-[max(2vw,env(safe-area-inset-right))] z-[80] border-0 bg-transparent p-0 leading-none text-foreground disabled:opacity-0"
      >
        {messages.journal.newer}
      </button>

      <div className="h-full overflow-x-hidden overflow-y-auto">
        <div className="relative mx-auto w-[81vw] pt-[max(5rem,calc(2.5%+3rem))] pb-[max(5rem,calc(2.5%+3.5rem))]">
          <article className="flex w-full min-w-0 flex-col items-start text-left text-foreground">
            <div className="flex w-full min-w-0 flex-col items-start gap-5">
              {entry.paragraphs.map((paragraph, index) => (
                <p
                  key={`${entry.slug}-${index}`}
                  className="info-para-fade m-0 w-full min-w-0 break-words leading-normal text-foreground"
                  style={{ animationDelay: `${index * 0.05 + 0.06}s` }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
