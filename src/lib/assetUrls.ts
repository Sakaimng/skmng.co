function normalizedAssetKey(name: string) {
  return name
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function getAssetUrl(name: string) {
  const key = normalizedAssetKey(name);
  return `/assets/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
