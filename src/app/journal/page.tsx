import type { Metadata } from "next";

import { InfoExperience } from "@/components/InfoExperience";
import { JournalIndex } from "@/components/JournalIndex";
import { JournalPasswordForm } from "@/components/JournalPasswordForm";
import { isJournalUnlocked } from "@/lib/journalGate.server";
import { getJournalEntries } from "@/lib/journal.server";
import { defaultOgImagePath } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal",
  robots: { index: false, follow: false },
  alternates: { canonical: "/journal" },
  openGraph: {
    title: "Journal | SKMNG",
    url: "/journal",
    images: [{ url: defaultOgImagePath, alt: "SKMNG — journal" }],
  },
  twitter: {
    title: "Journal | SKMNG",
  },
};

export default async function JournalPage() {
  if (!(await isJournalUnlocked())) {
    return (
      <main className="overflow-x-hidden overflow-y-hidden bg-background">
        <InfoExperience>
          <JournalPasswordForm nextPath="/journal" />
        </InfoExperience>
      </main>
    );
  }

  const entries = await getJournalEntries();

  return (
    <main className="overflow-x-hidden overflow-y-hidden bg-background">
      <InfoExperience>
        <JournalIndex entries={entries} />
      </InfoExperience>
    </main>
  );
}
