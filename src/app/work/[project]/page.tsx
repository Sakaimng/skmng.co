import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { WorkExperience } from "@/components/WorkExperience";
import { defaultOgImagePath } from "@/lib/site";
import { getWorkProject, getWorkProjects } from "@/lib/works.server";

export const revalidate = 86400;

type WorkProjectPageProps = {
  params: Promise<{ project: string }>;
};

export async function generateStaticParams() {
  const projects = await getWorkProjects();
  return projects.map((project) => ({ project: project.slug }));
}

export async function generateMetadata({
  params,
}: WorkProjectPageProps): Promise<Metadata> {
  const { project: projectParam } = await params;
  const project = await getWorkProject(projectParam);

  if (!project) {
    return { title: "Work" };
  }

  const canonical = `/work/${encodeURIComponent(project.slug)}`;

  return {
    title: project.title,
    description: `${project.title} — project by SKMNG.`,
    alternates: { canonical },
    openGraph: {
      title: `${project.title} | SKMNG`,
      description: `${project.title} — project by SKMNG.`,
      url: canonical,
      images: [
        {
          url: project.thumbnailUrl,
          alt: `${project.title} — SKMNG`,
        },
      ],
    },
    twitter: {
      title: `${project.title} | SKMNG`,
      description: `${project.title} — project by SKMNG.`,
      images: [project.thumbnailUrl],
    },
  };
}

export default async function WorkProjectPage({ params }: WorkProjectPageProps) {
  const { project: projectParam } = await params;
  const [projects, project] = await Promise.all([
    getWorkProjects(),
    getWorkProject(projectParam),
  ]);

  if (!project) notFound();

  return (
    <main className="overflow-x-hidden overflow-y-hidden bg-transparent">
      <Suspense fallback={null}>
        <WorkExperience projects={projects} selectedSlug={project.slug} />
      </Suspense>
    </main>
  );
}
