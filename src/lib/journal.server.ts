import fs from "fs/promises";
import path from "path";

import {
  formatJournalDate,
  formatJournalTime,
  type JournalEntry,
  type JournalListItem,
} from "@/lib/journal";

const BLOGS_DIR = path.join(process.cwd(), "BLOGS");
const NOTES_RE = /^Notes_(\d{6})_(\d{6})\.txt$/i;

type JournalRecord = {
  slug: string;
  dateMs: number;
  dateLabel: string;
  timeLabel: string;
  title: string;
  paragraphs: string[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseNoteStamp(datePart: string, timePart: string): Date | null {
  const year = 2000 + Number(datePart.slice(0, 2));
  const month = Number(datePart.slice(2, 4));
  const day = Number(datePart.slice(4, 6));
  const hour = Number(timePart.slice(0, 2));
  const minute = Number(timePart.slice(2, 4));
  const second = Number(timePart.slice(4, 6));

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+09:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toParagraphs(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function firstSentence(text: string): string {
  const match = text.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return (match?.[0] ?? text).trim();
}

function toTitle(paragraphs: string[]): string {
  const source = paragraphs.find((p) => p.length > 8) ?? paragraphs[0] ?? "Journal";
  const sentence = firstSentence(source).replace(/,$/, "");
  if (sentence.length <= 72) return sentence;
  return `${sentence.slice(0, 69).trimEnd()}…`;
}

async function readRecords(): Promise<JournalRecord[]> {
  let files: string[];
  try {
    files = await fs.readdir(BLOGS_DIR);
  } catch {
    return [];
  }

  const records = await Promise.all(
    files.map(async (fileName): Promise<JournalRecord | null> => {
      const match = fileName.match(NOTES_RE);
      if (!match) return null;

      const datePart = match[1]!;
      const timePart = match[2]!;
      const date = parseNoteStamp(datePart, timePart);
      if (!date) return null;

      const raw = await fs.readFile(path.join(BLOGS_DIR, fileName), "utf8");
      const paragraphs = toParagraphs(raw);
      if (!paragraphs.length) return null;

      const year = 2000 + Number(datePart.slice(0, 2));
      const slug = `${year}-${datePart.slice(2, 4)}-${datePart.slice(4, 6)}-${timePart}`;

      return {
        slug,
        dateMs: date.getTime(),
        dateLabel: formatJournalDate(date.getTime()),
        timeLabel: formatJournalTime(date.getTime()),
        title: toTitle(paragraphs),
        paragraphs,
      };
    }),
  );

  return records
    .filter((record): record is JournalRecord => record !== null)
    .sort((a, b) => b.dateMs - a.dateMs);
}

export async function getJournalEntries(): Promise<JournalListItem[]> {
  const records = await readRecords();
  return records.map(({ slug, dateMs, dateLabel, timeLabel, title }) => ({
    slug,
    dateMs,
    dateLabel,
    timeLabel,
    title,
  }));
}

export async function getJournalEntry(slug: string): Promise<JournalEntry | null> {
  const decoded = decodeURIComponent(slug);
  if (!decoded || decoded.includes("/") || decoded.includes("..")) return null;

  const records = await readRecords();
  const index = records.findIndex((record) => record.slug === decoded);
  if (index < 0) return null;

  const current = records[index]!;
  const newer = records[index - 1];
  const older = records[index + 1];

  return {
    slug: current.slug,
    dateMs: current.dateMs,
    dateLabel: current.dateLabel,
    timeLabel: current.timeLabel,
    title: current.title,
    paragraphs: current.paragraphs,
    next: newer
      ? { slug: newer.slug, dateLabel: newer.dateLabel, timeLabel: newer.timeLabel }
      : null,
    prev: older
      ? { slug: older.slug, dateLabel: older.dateLabel, timeLabel: older.timeLabel }
      : null,
  };
}
