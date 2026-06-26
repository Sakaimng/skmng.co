import { archiveAssetNames } from "@/data/archiveAssetNames";
import { homeGalleryAssetNames } from "@/data/homeGalleryAssetNames";
import { getAssetUrl } from "@/lib/assetUrls";

export type AssetImage = {
  id: string;
  name: string;
  url: string;
  /** Intrinsic pixel size — set for work-project images so next/image can
   *  reserve aspect-ratio space (no layout shift). Optional elsewhere. */
  width?: number;
  height?: number;
};

function mapAssetNames(names: readonly string[]): AssetImage[] {
  return names.map((name) => ({
    id: name,
    name,
    url: getAssetUrl(name),
  }));
}

const homeGalleryImages = mapAssetNames(homeGalleryAssetNames);
const archiveImages = mapAssetNames(archiveAssetNames);

export async function getHomeGalleryImages(): Promise<AssetImage[]> {
  return homeGalleryImages;
}

export async function getArchiveImages(): Promise<AssetImage[]> {
  return archiveImages;
}
