import type { AssetImage } from "@/lib/assets";

export type { AssetImage as WorkImage };

export type WorkCategoryId = "PORTRAIT" | "INTERIOR";

export const WORK_CATEGORY_ORDER: WorkCategoryId[] = ["PORTRAIT", "INTERIOR"];

export const WORK_CATEGORY_LABELS: Record<WorkCategoryId, string> = {
  PORTRAIT: "PORTRAIT",
  INTERIOR: "INTERIOR",
};

export type WorkProject = {
  slug: string;
  title: string;
  category: WorkCategoryId;
  thumbnailUrl: string;
  images: AssetImage[];
};

export type WorkCategoryGroup = {
  id: WorkCategoryId;
  label: string;
  projects: WorkProject[];
};

const PORTRAIT_PROJECT_SLUGS = new Set(["JESSIM", "TALLA"]);

/** Portrait category order (directory list). */
const PORTRAIT_PROJECT_ORDER = ["JESSIM", "TALLA"];

export function getProjectCategory(slug: string): WorkCategoryId {
  return PORTRAIT_PROJECT_SLUGS.has(slug) ? "PORTRAIT" : "INTERIOR";
}

function sortProjectsInCategory(
  category: WorkCategoryId,
  projects: WorkProject[],
): WorkProject[] {
  if (category === "PORTRAIT") {
    const order = new Map(
      PORTRAIT_PROJECT_ORDER.map((slug, index) => [slug, index]),
    );
    return [...projects].sort((a, b) => {
      const aIndex = order.get(a.slug);
      const bIndex = order.get(b.slug);
      if (aIndex != null && bIndex != null) return aIndex - bIndex;
      if (aIndex != null) return -1;
      if (bIndex != null) return 1;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  }

  return [...projects].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
}

export function groupProjectsByCategory(projects: WorkProject[]): WorkCategoryGroup[] {
  const buckets = new Map<WorkCategoryId, WorkProject[]>(
    WORK_CATEGORY_ORDER.map((id) => [id, []]),
  );

  for (const project of projects) {
    buckets.get(project.category)?.push(project);
  }

  return WORK_CATEGORY_ORDER.map((id) => ({
    id,
    label: WORK_CATEGORY_LABELS[id],
    projects: sortProjectsInCategory(id, buckets.get(id) ?? []),
  })).filter((group) => group.projects.length > 0);
}

export function getOrderedProjects(projects: WorkProject[]): WorkProject[] {
  return groupProjectsByCategory(projects).flatMap((group) => group.projects);
}

export function workProjectPath(slug: string): string {
  return `/work/${encodeURIComponent(slug)}`;
}

/** Update the project URL without a Next.js navigation (keeps scroll + layout stable). */
export function replaceWorkProjectUrl(slug: string) {
  if (typeof window === "undefined") return;
  const path = workProjectPath(slug);
  window.history.replaceState(window.history.state, "", path);
}

export const WORK_GALLERY_GAP_PX = 3;
