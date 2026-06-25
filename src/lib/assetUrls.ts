import blobAssetUrls from "@/data/blobAssetUrls.json";

type BlobUrlMap = Record<string, string>;

const blobUrls = blobAssetUrls as BlobUrlMap;

function normalizedAssetKey(name: string) {
  return name
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function getAssetUrl(name: string, width?: number, quality = 78) {
  void width;
  void quality;
  const key = normalizedAssetKey(name);
  const fromBlob = blobUrls[key];
  if (fromBlob) return fromBlob;

  const path = name
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/assets/${path}`;
}

export function getAssetSrcSet(
  name: string,
  widths = [480, 768, 960, 1280, 1600],
  quality = 78,
) {
  return widths.map((width) => `${getAssetUrl(name, width, quality)} ${width}w`).join(", ");
}
