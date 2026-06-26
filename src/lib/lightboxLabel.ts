export function lightboxDisplayName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.toUpperCase();
}
