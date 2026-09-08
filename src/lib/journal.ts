import type { Locale } from "@/lib/locale";

export type JournalListItem = {
  slug: string;
  dateMs: number;
  dateLabel: string;
  timeLabel: string;
  title: string;
};

export type JournalEntry = {
  slug: string;
  dateMs: number;
  dateLabel: string;
  timeLabel: string;
  title: string;
  paragraphs: string[];
  prev: { slug: string; dateLabel: string; timeLabel: string } | null;
  next: { slug: string; dateLabel: string; timeLabel: string } | null;
};

const DATE_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  ja: "ja-JP",
};

export function formatJournalDate(dateMs: number, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: "Asia/Tokyo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateMs));
}

export function formatJournalTime(dateMs: number, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateMs));
}
