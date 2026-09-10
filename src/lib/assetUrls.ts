/** Bumps when `/assets` 404s were cached as immutable, so browsers fetch the files again. */
const ASSET_URL_VERSION = "20260910";

function normalizedAssetKey(name: string) {
  return name
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function getAssetUrl(name: string) {
  const key = normalizedAssetKey(name);
  const path = `/assets/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  return `${path}?v=${ASSET_URL_VERSION}`;
}
