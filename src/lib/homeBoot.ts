export const HOME_PRELOADER_START_EVENT = "skmng:preloader-start";

/** Matches preloader counter + logo intro delay in HomeExperience. */
export const PRELOADER_COUNTER_DELAY_S = 0.35;

/** Preloader root fade-in after theme gate handoff. */
export const PRELOADER_FADE_IN_S = 0.52;

/** Pause after preloader exit fade before home content + nav handoff. */
export const PRELOADER_EXIT_SETTLE_S = 0.14;

/** Pause after home content mounts before nav landing reveal. */
export const HOME_BOOT_REVEAL_DELAY_S = 0.1;

declare global {
  interface Window {
    __skmngPreloaderStarted?: boolean;
  }
}

export function resetHomePreloaderStartFlag() {
  if (typeof window === "undefined") return;
  window.__skmngPreloaderStarted = false;
}

export function dispatchHomePreloaderStart() {
  if (typeof window === "undefined") return;
  window.__skmngPreloaderStarted = true;
  window.dispatchEvent(new Event(HOME_PRELOADER_START_EVENT));
}

export function hasHomePreloaderStarted() {
  return typeof window !== "undefined" && window.__skmngPreloaderStarted === true;
}
