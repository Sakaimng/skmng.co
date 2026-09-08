import type { Metadata } from "next";

import { InfoExperience } from "@/components/InfoExperience";
import { JournalIndex } from "@/components/JournalIndex";
import { getJournalEntries } from "@/lib/journal.server";
import { defaultOgImagePath } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Journal",
  description: "Journal entries by SKMNG — notes and writing, ordered by date.",
  alternates: { canonical: "/journal" },
  openGraph: {
    title: "Journal | SKMNG",
    description: "Journal entries by SKMNG — notes and writing, ordered by date.",
    url: "/journal",
    images: [{ url: defaultOgImagePath, alt: "SKMNG — journal" }],
  },
  twitter: {
    title: "Journal | SKMNG",
    description: "Journal entries by SKMNG — notes and writing, ordered by date.",
  },
};

export default async function JournalPage() {
  const entries = await getJournalEntries();

  return (
    <main className="overflow-x-hidden overflow-y-hidden bg-background">
      <InfoExperience>
        <JournalIndex entries={entries} />
      </InfoExperience>
    </main>
  );
}
