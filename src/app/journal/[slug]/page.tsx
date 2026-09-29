import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InfoExperience } from "@/components/InfoExperience";
import { JournalArticle } from "@/components/JournalArticle";
import { JournalPasswordForm } from "@/components/JournalPasswordForm";
import { isJournalUnlocked } from "@/lib/journalGate.server";
import { getJournalEntries, getJournalEntry } from "@/lib/journal.server";
import { defaultOgImagePath } from "@/lib/site";

export const dynamic = "force-dynamic";

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
  if (!(await isJournalUnlocked())) {
    return {
      title: "Journal",
      robots: { index: false, follow: false },
    };
  }

  const { slug } = await params;
  const entry = await getJournalEntry(slug);

  if (!entry) {
    return { title: "Journal", robots: { index: false, follow: false } };
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
    robots: { index: false, follow: false },
  };
}

export default async function JournalEntryPage({ params }: JournalEntryPageProps) {
  const { slug } = await params;

  if (!(await isJournalUnlocked())) {
    return (
      <main className="overflow-x-hidden overflow-y-hidden bg-background">
        <InfoExperience>
          <JournalPasswordForm nextPath={`/journal/${slug}`} />
        </InfoExperience>
      </main>
    );
  }

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
