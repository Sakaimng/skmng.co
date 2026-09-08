"use client";

import { useLocale } from "@/components/LocaleProvider";
import { usePageTransition } from "@/components/PageTransitionProvider";
import {
  formatJournalDate,
  formatJournalTime,
  type JournalListItem,
} from "@/lib/journal";

export function JournalIndex({ entries }: { entries: JournalListItem[] }) {
  const { navigate } = usePageTransition();
  const { locale } = useLocale();

  return (
    <div className="altPadding relative z-10 w-full min-h-[85dvh] overflow-x-hidden overflow-y-auto pb-[max(2.5%,env(safe-area-inset-bottom))]">
      <div className="grid w-full grid-cols-2 gap-x-0 gap-y-[9px] md:grid-cols-3 md:gap-y-[6px]">
        {entries.map((entry, index) => {
          const dateLabel = formatJournalDate(entry.dateMs, locale);
          const timeLabel = formatJournalTime(entry.dateMs, locale);

          return (
            <button
              key={entry.slug}
              type="button"
              onClick={() => navigate(`/journal/${entry.slug}`)}
              aria-label={`${dateLabel} ${timeLabel}`}
              className="info-para-fade w-full border-0 bg-transparent p-0 text-left max-md:[&:nth-child(odd)]:pl-[max(2vw,env(safe-area-inset-left))] max-md:[&:nth-child(even)]:pr-[max(2vw,env(safe-area-inset-right))] max-md:[&:nth-child(even)]:text-right md:[&:nth-child(3n+1)]:pl-[max(2vw,env(safe-area-inset-left))] md:[&:nth-child(3n)]:pr-[max(2vw,env(safe-area-inset-right))] md:[&:nth-child(3n)]:text-right"
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
        })}
      </div>
    </div>
  );
}
