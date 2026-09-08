import type { MetadataRoute } from "next";
import { getJournalEntries } from "@/lib/journal.server";
import { siteUrl } from "@/lib/site";
import { getWorkProjects } from "@/lib/works.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl;
  const now = new Date();
  const [projects, journalEntries] = await Promise.all([
    getWorkProjects(),
    getJournalEntries(),
  ]);

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/archive`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${base}/work`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...projects.map((project) => ({
      url: `${base}/work/${encodeURIComponent(project.slug)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${base}/journal`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...journalEntries.map((entry) => ({
      url: `${base}/journal/${entry.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    {
      url: `${base}/info-contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    },
  ];
}
