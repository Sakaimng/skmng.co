/** Body flag while the archive lightbox layer is open. */
export const ARCHIVE_LIGHTBOX_OPEN_ATTR = "data-archive-lightbox-open";

export function setArchiveLightboxOpen(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.body.setAttribute(ARCHIVE_LIGHTBOX_OPEN_ATTR, "1");
  } else {
    document.body.removeAttribute(ARCHIVE_LIGHTBOX_OPEN_ATTR);
  }
}

export function clearArchiveLightboxOpen() {
  setArchiveLightboxOpen(false);
}
