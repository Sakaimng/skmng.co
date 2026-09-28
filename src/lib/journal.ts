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

const DATE_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(DATE_LOCALES.en, {
    timeZone: "Asia/Tokyo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  ja: new Intl.DateTimeFormat(DATE_LOCALES.ja, {
    timeZone: "Asia/Tokyo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
};

const TIME_FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(DATE_LOCALES.en, {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  ja: new Intl.DateTimeFormat(DATE_LOCALES.ja, {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
};

export function formatJournalDate(dateMs: number, locale: Locale = "en"): string {
  return DATE_FORMATTERS[locale].format(dateMs);
}

export function formatJournalTime(dateMs: number, locale: Locale = "en"): string {
  return TIME_FORMATTERS[locale].format(dateMs);
}
