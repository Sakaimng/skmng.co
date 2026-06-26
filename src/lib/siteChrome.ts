import { gsap } from "gsap";

export const DEFER_CHROME_REVEAL_KEY = "skmng-defer-chrome-reveal";

export function getNavChromeTargets(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLElement>("header.fixed, .live-indicator-wrap"),
  );
}

export function getScrollHintTargets(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLElement>(".scroll-hint-wrap"));
}

export function getSiteChromeTargets(): HTMLElement[] {
  return [...getNavChromeTargets(), ...getScrollHintTargets()];
}

function shouldShowScrollHint(): boolean {
  return typeof window !== "undefined" && window.location.pathname === "/";
}

export function markDeferChromeReveal() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DEFER_CHROME_REVEAL_KEY, "1");
  document.body.dataset.deferChromeReveal = "1";
}

export function shouldDeferChromeReveal(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(DEFER_CHROME_REVEAL_KEY) === "1";
}

export function clearDeferChromeReveal() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEFER_CHROME_REVEAL_KEY);
  delete document.body.dataset.deferChromeReveal;
}

/** Remove the CSS emergency hide so GSAP can tween chrome in. */
export function liftDeferChromeCssLock() {
  if (typeof document === "undefined") return;
  delete document.body.dataset.deferChromeReveal;
}

/** Force site chrome hidden without clearing prior tweens' end state. */
export function hideSiteChrome() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(DEFER_CHROME_REVEAL_KEY, "1");
    document.body.dataset.deferChromeReveal = "1";
  }
  const chrome = getSiteChromeTargets();
  if (!chrome.length) return;
  gsap.killTweensOf(chrome);
  gsap.set(chrome, { autoAlpha: 0 });
}

export function restoreSiteChromeVisibility() {
  const navChrome = getNavChromeTargets();
  const scrollHint = getScrollHintTargets();
  const targets = [...navChrome, ...scrollHint];
  if (!targets.length) return;

  gsap.killTweensOf(targets);

  if (navChrome.length) {
    gsap.set(navChrome, { autoAlpha: 1, clearProps: "opacity,visibility" });
  }

  if (scrollHint.length) {
    if (shouldShowScrollHint()) {
      gsap.set(scrollHint, { autoAlpha: 1, clearProps: "opacity,visibility" });
    } else {
      gsap.set(scrollHint, { autoAlpha: 0 });
    }
  }

  clearDeferChromeReveal();
}
