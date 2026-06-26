import type { AssetImage } from "@/lib/assets";

export const ARCHIVE_LIGHTBOX_IMAGE_QUERY = "image";
/** Set before home → archive lightbox nav; skips archive page fade + landing only. */
export const ARCHIVE_LIGHTBOX_FROM_HOME_STORAGE_KEY = "skmng-archive-lightbox-from-home";

export function archiveLightboxHref(imageId: string): string {
  return `/archive?${ARCHIVE_LIGHTBOX_IMAGE_QUERY}=${encodeURIComponent(imageId)}`;
}

export function markArchiveLightboxNavFromHome(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ARCHIVE_LIGHTBOX_FROM_HOME_STORAGE_KEY, "1");
}

export function shouldSkipArchiveEnterAnimations(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ARCHIVE_LIGHTBOX_FROM_HOME_STORAGE_KEY) === "1";
}

export function consumeArchiveLightboxNavFromHome(): boolean {
  if (typeof window === "undefined") return false;
  const fromHome =
    window.sessionStorage.getItem(ARCHIVE_LIGHTBOX_FROM_HOME_STORAGE_KEY) === "1";
  if (fromHome) {
    window.sessionStorage.removeItem(ARCHIVE_LIGHTBOX_FROM_HOME_STORAGE_KEY);
  }
  return fromHome;
}

export function findArchiveImageIndex(
  images: readonly Pick<AssetImage, "id" | "name">[],
  imageId: string,
): number | null {
  const idx = images.findIndex((img) => img.id === imageId || img.name === imageId);
  return idx >= 0 ? idx : null;
}
