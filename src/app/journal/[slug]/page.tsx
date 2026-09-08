import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoExperience } from "@/components/InfoExperience";
import { JournalArticle } from "@/components/JournalArticle";
import { getJournalEntries, getJournalEntry } from "@/lib/journal.server";
import { defaultOgImagePath } from "@/lib/site";

export const revalidate = 86400;

type JournalEntryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const entries = await getJournalEntries();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: JournalEntryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getJournalEntry(slug);

  if (!entry) {
    return { title: "Journal" };
  }

  const canonical = `/journal/${entry.slug}`;

  return {
    title: entry.title,
    description: entry.paragraphs[0] ?? entry.title,
    alternates: { canonical },
    openGraph: {
      title: `${entry.dateLabel} | SKMNG`,
      description: entry.paragraphs[0] ?? entry.title,
      url: canonical,
      images: [{ url: defaultOgImagePath, alt: "SKMNG — journal" }],
    },
    twitter: {
      title: `${entry.dateLabel} | SKMNG`,
      description: entry.paragraphs[0] ?? entry.title,
    },
  };
}

export default async function JournalEntryPage({ params }: JournalEntryPageProps) {
  const { slug } = await params;
  const entry = await getJournalEntry(slug);

  if (!entry) notFound();

  return (
    <main className="overflow-x-hidden overflow-y-hidden bg-background">
      <InfoExperience>
        <JournalArticle entry={entry} />
      </InfoExperience>
    </main>
  );
}
