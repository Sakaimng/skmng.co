export const HOME_GALLERY_INTRO_PENDING_ATTR = "data-home-gallery-intro-pending";

export const HOME_GALLERY_INTRO_PENDING_EVENT = "skmng:home-gallery-intro-pending";
export const HOME_GALLERY_INTRO_DONE_EVENT = "skmng:home-gallery-intro-done";

/** Matches `HomeGallery` intro delay / clip duration. */
export const HOME_GALLERY_INTRO_DELAY_S = 0.12;
export const HOME_GALLERY_INTRO_CLIP_S = 1.05;

/** Matches `HomeGallery` leave clip on visible gallery media. */
export const HOME_GALLERY_LEAVE_CLIP_S = 0.52;

export function markHomeGalleryIntroPending() {
  if (typeof document === "undefined") return;
  document.body.setAttribute(HOME_GALLERY_INTRO_PENDING_ATTR, "1");
  window.dispatchEvent(new Event(HOME_GALLERY_INTRO_PENDING_EVENT));
}

export function markHomeGalleryIntroDone() {
  if (typeof document === "undefined") return;
  document.body.removeAttribute(HOME_GALLERY_INTRO_PENDING_ATTR);
  window.dispatchEvent(new Event(HOME_GALLERY_INTRO_DONE_EVENT));
}

export function clearHomeGalleryIntroPending() {
  if (typeof document === "undefined") return;
  document.body.removeAttribute(HOME_GALLERY_INTRO_PENDING_ATTR);
}
