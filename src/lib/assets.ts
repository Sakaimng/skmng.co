import { readdir } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { getAssetUrl } from "@/lib/assetUrls";

export type AssetImage = {
  id: string;
  name: string;
  url: string;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function assetDirectory() {
  return path.join(process.cwd(), "src", "assets");
}

async function readAssetImages(): Promise<AssetImage[]> {
  const entries = await readdir(assetDirectory(), { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      id: name,
      name,
      url: getAssetUrl(name),
    }));
}

const getCachedAssetImages = unstable_cache(readAssetImages, ["asset-images"], {
  revalidate: 5,
});

export async function getAssetImages(): Promise<AssetImage[]> {
  return getCachedAssetImages();
}

export function assetFilePath(name: string) {
  return path.join(assetDirectory(), name);
}
