export const WORK_PROJECT_LOADING_EVENT = "skmng:work-project-loading";
export const WORK_RETURN_DIRECTORY_EVENT = "skmng:work-return-directory";
export const WORK_NAV_LOADING_FADE_OUT_S = 0.28;

const WORK_ACTIVE_SLUG_KEY = "skmng-work-active-slug";
const WORK_RETURN_REVEAL_KEY = "skmng-work-return-reveal";
const WORK_ENTRY_COVER_SLUG_KEY = "skmng-work-entry-cover-slug";
const WORK_ENTRY_COVER_URL_KEY = "skmng-work-entry-cover-url";
export const WORK_ENTRY_COVER_CLEAR_EVENT = "skmng:work-entry-cover-clear";
export const WORK_ENTRY_COVER_SET_EVENT = "skmng:work-entry-cover-set";
const WORK_DIRECTORY_REVEALED_KEY = "skmng-work-directory-revealed";

export function markWorkDirectoryRevealed() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_DIRECTORY_REVEALED_KEY, "1");
}

export function consumeWorkDirectoryRevealed() {
  if (typeof window === "undefined") return false;
  const pending =
    window.sessionStorage.getItem(WORK_DIRECTORY_REVEALED_KEY) === "1";
  if (pending) window.sessionStorage.removeItem(WORK_DIRECTORY_REVEALED_KEY);
  return pending;
}

export function saveWorkEntryCoverSlug(slug: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_ENTRY_COVER_SLUG_KEY, slug);
}

export function saveWorkEntryCoverUrl(url: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_ENTRY_COVER_URL_KEY, url);
  window.dispatchEvent(new CustomEvent(WORK_ENTRY_COVER_SET_EVENT));
}

export function readWorkEntryCoverUrl(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(WORK_ENTRY_COVER_URL_KEY);
}

export function subscribeWorkEntryCover(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onChange = () => onStoreChange();
  window.addEventListener(WORK_ENTRY_COVER_SET_EVENT, onChange);
  window.addEventListener(WORK_ENTRY_COVER_CLEAR_EVENT, onChange);
  return () => {
    window.removeEventListener(WORK_ENTRY_COVER_SET_EVENT, onChange);
    window.removeEventListener(WORK_ENTRY_COVER_CLEAR_EVENT, onChange);
  };
}

export function getWorkEntryCoverSnapshot(): string | null {
  return readWorkEntryCoverUrl();
}

export function readWorkEntryCoverSlug(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(WORK_ENTRY_COVER_SLUG_KEY);
}

export function clearWorkEntryCover() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WORK_ENTRY_COVER_SLUG_KEY);
  window.sessionStorage.removeItem(WORK_ENTRY_COVER_URL_KEY);
  window.dispatchEvent(new CustomEvent(WORK_ENTRY_COVER_CLEAR_EVENT));
}

/** @deprecated Use {@link clearWorkEntryCover}. */
export function clearWorkEntryCoverSlug() {
  clearWorkEntryCover();
}

export function markWorkReturnReveal() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_RETURN_REVEAL_KEY, "1");
}

export function hasWorkReturnRevealPending() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(WORK_RETURN_REVEAL_KEY) === "1";
}

export function consumeWorkReturnReveal() {
  if (typeof window === "undefined") return false;
  const pending = hasWorkReturnRevealPending();
  if (pending) window.sessionStorage.removeItem(WORK_RETURN_REVEAL_KEY);
  return pending;
}

export function saveWorkActiveSlug(slug: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_ACTIVE_SLUG_KEY, slug);
  window.dispatchEvent(new CustomEvent("skmng:work-chrome-store-change"));
}

export function readWorkActiveSlug(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(WORK_ACTIVE_SLUG_KEY);
}

export function clearWorkActiveSlug() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WORK_ACTIVE_SLUG_KEY);
  window.dispatchEvent(new CustomEvent("skmng:work-chrome-store-change"));
}

export function dispatchWorkProjectLoading(
  loading: boolean,
  options?: { fadeOutDuration?: number },
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WORK_PROJECT_LOADING_EVENT, {
      detail: {
        loading,
        fadeOutDuration: options?.fadeOutDuration,
      },
    }),
  );
}

const WORK_PROJECT_ENTER_KEY = "skmng-work-project-enter";
const WORK_RETURN_ENTER_KEY = "skmng-work-return-enter";

/** Set before /work/[project] → /work nav to skip page fade-in. */
export function markWorkReturnEnter() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_RETURN_ENTER_KEY, "1");
}

export function consumeWorkReturnEnter() {
  if (typeof window === "undefined") return false;
  const pending = window.sessionStorage.getItem(WORK_RETURN_ENTER_KEY) === "1";
  if (pending) window.sessionStorage.removeItem(WORK_RETURN_ENTER_KEY);
  return pending;
}

/** Set before /work → /work/[project] nav to skip page fade-in. */
export function markWorkProjectEnter() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_PROJECT_ENTER_KEY, "1");
}

export function consumeWorkProjectEnter() {
  if (typeof window === "undefined") return false;
  const pending = window.sessionStorage.getItem(WORK_PROJECT_ENTER_KEY) === "1";
  if (pending) window.sessionStorage.removeItem(WORK_PROJECT_ENTER_KEY);
  return pending;
}

const WORK_PROJECT_TITLE_REVEAL_KEY = "skmng-work-project-title-reveal";

/** Set before /work/[project] → /work/[project] nav to reveal title after overlay out. */
export function markWorkProjectTitleReveal() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_PROJECT_TITLE_REVEAL_KEY, "1");
}

export function consumeWorkProjectTitleReveal() {
  if (typeof window === "undefined") return false;
  const pending =
    window.sessionStorage.getItem(WORK_PROJECT_TITLE_REVEAL_KEY) === "1";
  if (pending) window.sessionStorage.removeItem(WORK_PROJECT_TITLE_REVEAL_KEY);
  return pending;
}

/** Read the pending-reveal flag without clearing it (for synchronous initial
 *  render state — the effect still consumes it). */
export function peekWorkProjectTitleReveal() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(WORK_PROJECT_TITLE_REVEAL_KEY) === "1";
}
