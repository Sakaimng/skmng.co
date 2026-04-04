export function getAssetUrl(name: string, width?: number, quality = 78) {
  const encoded = encodeURIComponent(name);
  const params = new URLSearchParams();

  if (width) params.set("w", String(width));
  if (quality) params.set("q", String(quality));

  const query = params.toString();
  return `/api/assets/${encoded}${query ? `?${query}` : ""}`;
}

export function getAssetSrcSet(
  name: string,
  widths = [480, 768, 960, 1280, 1600],
  quality = 78,
) {
  return widths.map((width) => `${getAssetUrl(name, width, quality)} ${width}w`).join(", ");
}
