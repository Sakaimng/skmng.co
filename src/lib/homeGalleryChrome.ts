/** Body flag while the home gallery is visible over imagery (not idle). */
export const HOME_GALLERY_OVER_IMAGERY_ATTR = "data-home-gallery-over-imagery";

export function setHomeGalleryOverImagery(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.body.setAttribute(HOME_GALLERY_OVER_IMAGERY_ATTR, "1");
  } else {
    document.body.removeAttribute(HOME_GALLERY_OVER_IMAGERY_ATTR);
  }
}

export function clearHomeGalleryOverImagery() {
  setHomeGalleryOverImagery(false);
}
