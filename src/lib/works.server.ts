import fs from "fs/promises";
import path from "path";

import sharp from "sharp";

import type { AssetImage } from "@/lib/assets";
import { getAssetUrl } from "@/lib/assetUrls";
import type { WorkProject } from "@/lib/works";
import { getProjectCategory } from "@/lib/works";

/** Read intrinsic pixel size (header only — fast, cached by ISR). */
async function readImageSize(
  filePath: string,
): Promise<{ width?: number; height?: number }> {
  try {
    const { width, height } = await sharp(filePath).metadata();
    return { width, height };
  } catch {
    return {};
  }
}

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

/** Subdirs of `public/assets/` that are not client work projects. */
const RESERVED_ASSET_DIRS = new Set(["portrait"]);

/** Override default (first sorted) thumbnail per project slug. */
const PROJECT_THUMBNAILS: Record<string, string> = {
  "EXP.ATELIER": "L1100474.jpg",
  "EXP.CO-ONSEN": "L1040766.jpg",
  "JESSIM": "L1020430.jpg",
  "SLEEEP.MYOKO": "L1080743.jpg",
};

function workAssetKey(projectSlug: string, fileName: string) {
  return `${projectSlug}/${fileName}`;
}

async function readProjectDir(name: string): Promise<WorkProject | null> {
  const dir = path.join(ASSETS_DIR, name);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }

  const images = entries
    .filter((file) => IMAGE_EXT.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!images.length) return null;

  const preferred = PROJECT_THUMBNAILS[name];
  const thumbnail =
    preferred && images.includes(preferred) ? preferred : images[0]!;

  const imageEntries = await Promise.all(
    images.map(async (imageName): Promise<AssetImage> => {
      const { width, height } = await readImageSize(
        path.join(dir, imageName),
      );
      return {
        id: workAssetKey(name, imageName),
        name: imageName,
        url: getAssetUrl(workAssetKey(name, imageName)),
        width,
        height,
      };
    }),
  );

  return {
    slug: name,
    title: name,
    category: getProjectCategory(name),
    thumbnailUrl: getAssetUrl(workAssetKey(name, thumbnail)),
    images: imageEntries,
  };
}

export async function getWorkProjects(): Promise<WorkProject[]> {
  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  const projects = await Promise.all(
    entries
      .filter(
        (entry) => entry.isDirectory() && !RESERVED_ASSET_DIRS.has(entry.name),
      )
      .map((entry) => readProjectDir(entry.name)),
  );

  return projects
    .filter((project): project is WorkProject => project !== null)
    .sort((a, b) => {
      if (a.category !== b.category) {
        return a.category === "PORTRAIT" ? -1 : 1;
      }
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
}

export async function getWorkProject(slug: string): Promise<WorkProject | null> {
  const decoded = decodeURIComponent(slug);
  if (!decoded || decoded.includes("/") || decoded.includes("..")) return null;
  if (RESERVED_ASSET_DIRS.has(decoded)) return null;
  return readProjectDir(decoded);
}
