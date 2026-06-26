import type { Metadata } from "next";
import { Suspense } from "react";
import { ArchiveExperience } from "@/components/ArchiveExperience";
import { defaultOgImagePath } from "@/lib/site";
import { getArchiveImages } from "@/lib/assets";

/** Image list is static; avoid frequent ISR work. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Archive",
  description:
    "Browse SKMNG’s full photography archive — cinematic frames, composition-led imagery, and catalogue view.",
  alternates: { canonical: "/archive" },
  openGraph: {
    title: "Archive | SKMNG",
    description:
      "Full photography archive — browse the complete SKMNG image catalogue.",
    url: "/archive",
    images: [{ url: defaultOgImagePath, alt: "SKMNG — photography archive" }],
  },
  twitter: {
    title: "Archive | SKMNG",
    description:
      "Full photography archive — browse the complete SKMNG image catalogue.",
  },
};

export default async function ArchivePage() {
  const images = await getArchiveImages();
  return (
    <Suspense fallback={null}>
      <ArchiveExperience images={images} />
    </Suspense>
  );
}
