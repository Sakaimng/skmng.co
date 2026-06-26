import { gsap } from "gsap";

export const HARD_REFRESH_OUTRO_S = 0.34;
export const HARD_REFRESH_BLUR_PX = 18;
export const HARD_REFRESH_OUTRO_ATTR = "data-hard-refresh-outro";

let outroRunning = false;

export function isHardRefreshOutroRunning() {
  return outroRunning;
}

export function applyHardRefreshOutroInstant(
  pageShell: HTMLElement | null,
  overlay: HTMLElement | null,
) {
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute(HARD_REFRESH_OUTRO_ATTR, "1");

  const root = pageShell ?? document.body;
  const blur = `blur(${HARD_REFRESH_BLUR_PX}px)`;

  gsap.killTweensOf(root);
  gsap.set(root, { autoAlpha: 0, filter: blur });

  if (overlay) {
    gsap.killTweensOf(overlay);
    gsap.set(overlay, { autoAlpha: 1, visibility: "visible" });
  }
}

export function runHardRefreshOutro(
  pageShell: HTMLElement | null,
  overlay: HTMLElement | null,
  onComplete: () => void,
) {
  if (typeof document === "undefined") return;
  if (outroRunning) return;

  outroRunning = true;
  document.documentElement.setAttribute(HARD_REFRESH_OUTRO_ATTR, "1");

  const root = pageShell ?? document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    applyHardRefreshOutroInstant(pageShell, overlay);
    onComplete();
    return;
  }

  gsap.killTweensOf([root, overlay].filter(Boolean));
  gsap.set(root, { filter: "blur(0px)", willChange: "filter, opacity" });

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    onComplete: () => {
      gsap.set(root, { clearProps: "filter,willChange" });
      onComplete();
    },
  });

  tl.to(
    root,
    {
      autoAlpha: 0,
      filter: `blur(${HARD_REFRESH_BLUR_PX}px)`,
      duration: HARD_REFRESH_OUTRO_S,
    },
    0,
  );

  if (overlay) {
    tl.to(
      overlay,
      { autoAlpha: 1, visibility: "visible", duration: HARD_REFRESH_OUTRO_S },
      0,
    );
  }
}

export function isReloadKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.key === "F5") return true;
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r";
}
