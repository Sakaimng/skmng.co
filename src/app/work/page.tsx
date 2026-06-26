import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkExperience } from "@/components/WorkExperience";
import { defaultOgImagePath } from "@/lib/site";
import { getWorkProjects } from "@/lib/works.server";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Work",
  description:
    "Selected client and personal projects by SKMNG — visual storytelling, photography, and design.",
  alternates: { canonical: "/work" },
  openGraph: {
    title: "Work | SKMNG",
    description:
      "Selected client and personal projects by SKMNG.",
    url: "/work",
    images: [{ url: defaultOgImagePath, alt: "SKMNG — work" }],
  },
  twitter: {
    title: "Work | SKMNG",
    description:
      "Selected client and personal projects by SKMNG.",
  },
};

export default async function WorkPage() {
  const projects = await getWorkProjects();

  return (
    <main className="overflow-x-hidden overflow-y-hidden bg-transparent">
      <Suspense fallback={null}>
        <WorkExperience projects={projects} selectedSlug={null} />
      </Suspense>
    </main>
  );
}
