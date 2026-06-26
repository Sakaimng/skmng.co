"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

import {
  HOME_LEAVE_OUTRO_EVENT,
  usePageTransition,
} from "@/components/PageTransitionProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import {
  hasHomePreloaderStarted,
  HOME_PRELOADER_START_EVENT,
  PRELOADER_COUNTER_DELAY_S,
} from "@/lib/homeBoot";
import {
  HOME_GALLERY_INTRO_CLIP_S,
  HOME_GALLERY_INTRO_DELAY_S,
  HOME_GALLERY_INTRO_DONE_EVENT,
  HOME_GALLERY_INTRO_PENDING_ATTR,
  HOME_GALLERY_INTRO_PENDING_EVENT,
  HOME_GALLERY_LEAVE_CLIP_S,
} from "@/lib/homeGalleryIntro";
import { SCRAMBLE_CHARS } from "@/lib/scrambleChars";
import { hideSiteChrome, shouldDeferChromeReveal } from "@/lib/siteChrome";
import { clearWorkChrome, setWorkChrome } from "@/lib/workChrome";
import { WORK_PROJECT_LOADING_EVENT, WORK_NAV_LOADING_FADE_OUT_S } from "@/lib/workNavEvents";

gsap.registerPlugin(SplitText);

const navItems = [
  { href: "/work", label: "Work" },
  { href: "/archive", label: "Archive" },
  { href: "/info-contact", label: "Info" },
] as const;

const NAV_TARGET_LABELS = ["SKMNG", ...navItems.map((item) => item.label)];
const NAV_ITEM_LABELS = navItems.map((item) => item.label);
const WORK_NAV_LOADING_FADE_IN_S = 0.22;
const WORK_NAV_LOADING_OPACITY = 0.88;
const MOBILE_MQ = "(max-width: 767px)";

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
}

function revertSplits(splits: SplitText[] | null) {
  if (!splits?.length) return;
  splits.forEach((s) => s.revert());
}

function resetNavTargetText(targets: HTMLElement[]) {
  targets.forEach((el, i) => {
    const text = NAV_TARGET_LABELS[i];
    if (text === undefined) return;
    el.replaceChildren(document.createTextNode(text));
  });
}

function resetNavItemText(els: HTMLElement[]) {
  els.forEach((el, i) => {
    const text = NAV_ITEM_LABELS[i];
    if (text !== undefined) el.replaceChildren(document.createTextNode(text));
  });
}

// ─── Scramble ────────────────────────────────────────────────────────────────

/** Same red as LIVE dot + preloader 100% (`globals.css` / `PRELOADER_COMPLETE_RED`) */
const NAV_SCRAMBLE_RED = "#e02020";

function getForegroundColor(): string {
  if (typeof document === "undefined") return "#f6f6f6";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
  return v || "#f6f6f6";
}

/** Fade inline nav red back to theme foreground, then drop inline color for `text-foreground`. */
function fadeNavLabelColorOut(el: HTMLElement) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.style.removeProperty("color");
    return;
  }
  gsap.killTweensOf(el);
  const fg = getForegroundColor();
  gsap.to(el, {
    color: fg,
    duration: 0.32,
    ease: "power2.out",
    onComplete: () => {
      el.style.removeProperty("color");
    },
  });
}

/** Type in `text` one character at a time; each new glyph scrambles briefly then locks (preloader SKMNG). */
function runTypewriterScrambleReveal(
  el: HTMLElement,
  text: string,
  options?: {
    /** When false, keeps `NAV_SCRAMBLE_RED` after typing so the label can fade to foreground later (e.g. after the hero logo is gone). Default true. */
    fadeToForegroundWhenDone?: boolean;
    onDone?: () => void;
  },
): () => void {
  const fadeToForegroundWhenDone = options?.fadeToForegroundWhenDone !== false;
  const onDone = options?.onDone;

  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = text;
    el.style.removeProperty("color");
    onDone?.();
    return () => {};
  }

  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const clearAllTimers = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
  };

  const schedule = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
  };

  /** Pause after each settled character (typewriter cadence). */
  const CHAR_PAUSE_MS = 52;
  const SCRAMBLE_TICK_MS = 28;
  const SCRAMBLE_TICKS_PER_CHAR = 5;

  el.textContent = "";
  el.style.color = NAV_SCRAMBLE_RED;

  const finish = () => {
    if (cancelled) return;
    el.textContent = text;
    el.style.color = NAV_SCRAMBLE_RED;
    if (fadeToForegroundWhenDone) {
      fadeNavLabelColorOut(el);
    }
    onDone?.();
  };

  const runChar = (i: number) => {
    if (cancelled) return;
    if (i >= text.length) {
      finish();
      return;
    }

    const ch = text[i]!;
    if (ch === " ") {
      el.textContent = text.slice(0, i + 1);
      schedule(() => runChar(i + 1), CHAR_PAUSE_MS);
      return;
    }

    let tick = 0;
    const scrambleStep = () => {
      if (cancelled) return;
      tick++;
      const prefix = text.slice(0, i);
      if (tick <= SCRAMBLE_TICKS_PER_CHAR) {
        const randomCh = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]!;
        el.textContent = prefix + randomCh;
        schedule(scrambleStep, SCRAMBLE_TICK_MS);
      } else {
        el.textContent = text.slice(0, i + 1);
        schedule(() => runChar(i + 1), CHAR_PAUSE_MS);
      }
    };

    schedule(scrambleStep, SCRAMBLE_TICK_MS);
  };

  schedule(() => runChar(0), 0);

  return () => {
    cancelled = true;
    clearAllTimers();
    gsap.killTweensOf(el);
    el.textContent = text;
    if (fadeToForegroundWhenDone) {
      el.style.removeProperty("color");
    }
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SiteHeader({
  currentPath,
  playLandingReveal = false,
  onLandingRevealDone,
  isPreloading = false,
}: {
  currentPath: string;
  playLandingReveal?: boolean;
  onLandingRevealDone?: () => void;
  isPreloading?: boolean;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const navBlurRef = useRef<HTMLElement>(null);
  const scrollHintWrapRef = useRef<HTMLDivElement>(null);
  const chromeTogglesWrapRef = useRef<HTMLDivElement>(null);
  const scrollHintTweenRef = useRef<gsap.core.Tween | null>(null);
  const workLoadingRef = useRef<HTMLSpanElement>(null);
  const workLoadingTweenRef = useRef<gsap.core.Tween | null>(null);
  const workLoadingFadeOutActiveRef = useRef(false);
  /** True once the label has faded in for the current loading session — prevents
   *  a re-fade flicker when the route changes (project→project) mid-load. */
  const workLoadingShownRef = useRef(false);
  const splitsRef = useRef<SplitText[] | null>(null);
  const { navigate } = usePageTransition();
  const { messages } = useLocale();
  const [homeGalleryIntroDone, setHomeGalleryIntroDone] = useState(
    () => typeof window === "undefined" || window.location.pathname !== "/",
  );
  const [workProjectLoading, setWorkProjectLoading] = useState(false);
  const [showWorkLoadingLabel, setShowWorkLoadingLabel] = useState(false);

  const isNavInteractive =
    !isPreloading && (currentPath !== "/" || homeGalleryIntroDone);

  const workChromeDifference = /^\/work(\/|$)/.test(currentPath);

  const pointerNavigationLockRef = useRef<string | null>(null);

  const activateNav = useCallback(
    (href: string) => {
      if (!isNavInteractive) return;
      navigate(href);
    },
    [isNavInteractive, navigate],
  );

  const handleNavPointerDown = useCallback(
    (href: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!isNavInteractive) {
        event.preventDefault();
        return;
      }
      if (event.button !== 0) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      pointerNavigationLockRef.current = href;
      event.preventDefault();
      activateNav(href);
    },
    [activateNav, isNavInteractive],
  );

  const handleNavClick = useCallback(
    (href: string) => () => {
      if (!isNavInteractive) return;
      if (pointerNavigationLockRef.current === href) {
        pointerNavigationLockRef.current = null;
        return;
      }

      activateNav(href);
    },
    [activateNav, isNavInteractive],
  );

  const cancelSkmngIntroRef = useRef<() => void>(() => {});

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelSkmngIntroRef.current();
    };
  }, []);

  useEffect(() => {
    pointerNavigationLockRef.current = null;
  }, [currentPath]);

  useLayoutEffect(() => {
    const onWork = /^\/work(\/|$)/.test(currentPath);
    if (onWork) {
      setWorkChrome(true);
      return;
    }
    clearWorkChrome();
  }, [currentPath]);

  useEffect(() => {
    if (currentPath !== "/") {
      setHomeGalleryIntroDone(true);
      return;
    }
    setHomeGalleryIntroDone(false);
  }, [currentPath]);

  useEffect(() => {
    const fadeOutWorkLoadingLabel = (duration: number) => {
      const el = workLoadingRef.current;
      if (!el) return;

      workLoadingFadeOutActiveRef.current = true;
      workLoadingShownRef.current = false;
      workLoadingTweenRef.current?.kill();

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion) {
        gsap.set(el, { autoAlpha: 0 });
        workLoadingFadeOutActiveRef.current = false;
        setShowWorkLoadingLabel(false);
        return;
      }

      gsap.set(el, { visibility: "visible" });
      workLoadingTweenRef.current = gsap.to(el, {
        autoAlpha: 0,
        duration,
        ease: "power2.inOut",
        onComplete: () => {
          workLoadingTweenRef.current = null;
          workLoadingFadeOutActiveRef.current = false;
          setShowWorkLoadingLabel(false);
        },
      });
    };

    const onWorkLoading = (event: Event) => {
      const { loading, fadeOutDuration } =
        (event as CustomEvent<{ loading: boolean; fadeOutDuration?: number }>)
          .detail ?? {};
      const next = Boolean(loading);

      if (next) {
        workLoadingFadeOutActiveRef.current = false;
        // New loading session — fade in fresh (the route-change re-run holds steady).
        workLoadingShownRef.current = false;
        setWorkProjectLoading(true);
        if (!isMobileViewport()) {
          setShowWorkLoadingLabel(true);
        }
        return;
      }

      setWorkProjectLoading(false);

      fadeOutWorkLoadingLabel(
        typeof fadeOutDuration === "number"
          ? fadeOutDuration
          : WORK_NAV_LOADING_FADE_OUT_S,
      );
    };

    window.addEventListener(WORK_PROJECT_LOADING_EVENT, onWorkLoading as EventListener);
    return () => {
      window.removeEventListener(
        WORK_PROJECT_LOADING_EVENT,
        onWorkLoading as EventListener,
      );
    };
  }, []);

  useLayoutEffect(() => {
    if (!workProjectLoading || workLoadingFadeOutActiveRef.current) return;
    if (isMobileViewport()) return;

    const el = workLoadingRef.current;
    if (!el || !/^\/work\/[^/]+$/.test(currentPath)) return;

    // Already faded in this loading session (route changed mid-load on a
    // project→project switch): hold at target opacity, never re-fade — re-running
    // fromTo({autoAlpha:0}) here snapped the visible label back to 0 (flicker).
    if (workLoadingShownRef.current) {
      workLoadingTweenRef.current?.kill();
      workLoadingTweenRef.current = null;
      gsap.set(el, { autoAlpha: WORK_NAV_LOADING_OPACITY });
      return;
    }

    workLoadingShownRef.current = true;
    workLoadingTweenRef.current?.kill();
    workLoadingTweenRef.current = null;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      gsap.set(el, { autoAlpha: WORK_NAV_LOADING_OPACITY });
      return;
    }

    workLoadingTweenRef.current = gsap.fromTo(
      el,
      { autoAlpha: 0 },
      {
        autoAlpha: WORK_NAV_LOADING_OPACITY,
        duration: WORK_NAV_LOADING_FADE_IN_S,
        ease: "power2.out",
      },
    );
  }, [currentPath, workProjectLoading]);

  useEffect(() => {
    if (!/^\/work\/[^/]+$/.test(currentPath)) {
      setWorkProjectLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    return () => {
      workLoadingTweenRef.current?.kill();
      workLoadingTweenRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onPending = () => {
      setHomeGalleryIntroDone(false);
    };
    const onDone = () => {
      setHomeGalleryIntroDone(true);
    };

    window.addEventListener(HOME_GALLERY_INTRO_PENDING_EVENT, onPending);
    window.addEventListener(HOME_GALLERY_INTRO_DONE_EVENT, onDone);

    return () => {
      window.removeEventListener(HOME_GALLERY_INTRO_PENDING_EVENT, onPending);
      window.removeEventListener(HOME_GALLERY_INTRO_DONE_EVENT, onDone);
    };
  }, []);

  const fadeInScrollHint = useCallback(() => {
    if (currentPath !== "/") return;
    const el = scrollHintWrapRef.current;
    if (!el) return;

    scrollHintTweenRef.current?.kill();
    gsap.set(el, { autoAlpha: 0 });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { autoAlpha: 1, clearProps: "opacity,visibility" });
      return;
    }

    scrollHintTweenRef.current = gsap.to(el, {
      autoAlpha: 1,
      delay: HOME_GALLERY_INTRO_DELAY_S,
      duration: HOME_GALLERY_INTRO_CLIP_S,
      ease: "power3.out",
      clearProps: "opacity,visibility",
    });
  }, [currentPath]);

  const hideScrollHint = useCallback((instant = false) => {
    const el = scrollHintWrapRef.current;
    if (!el) return;

    scrollHintTweenRef.current?.kill();
    scrollHintTweenRef.current = null;

    if (
      instant ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      gsap.set(el, { autoAlpha: 0 });
      return;
    }

    scrollHintTweenRef.current = gsap.to(el, {
      autoAlpha: 0,
      duration: HOME_GALLERY_LEAVE_CLIP_S,
      ease: "power3.inOut",
    });
  }, []);

  useLayoutEffect(() => {
    const el = scrollHintWrapRef.current;
    if (!el) return;

    if (currentPath !== "/" || isPreloading) {
      scrollHintTweenRef.current?.kill();
      scrollHintTweenRef.current = null;
      gsap.set(el, { autoAlpha: 0 });
    }
  }, [currentPath, isPreloading]);

  useEffect(() => {
    const onPending = () => {
      fadeInScrollHint();
    };
    const onDone = () => {
      if (currentPath !== "/") return;
      const el = scrollHintWrapRef.current;
      if (!el) return;
      scrollHintTweenRef.current?.kill();
      scrollHintTweenRef.current = null;
      gsap.set(el, { autoAlpha: 1, clearProps: "opacity,visibility" });
    };

    window.addEventListener(HOME_GALLERY_INTRO_PENDING_EVENT, onPending);
    window.addEventListener(HOME_GALLERY_INTRO_DONE_EVENT, onDone);

    if (
      currentPath === "/" &&
      !isPreloading &&
      !document.body.hasAttribute(HOME_GALLERY_INTRO_PENDING_ATTR)
    ) {
      const el = scrollHintWrapRef.current;
      if (el) {
        gsap.set(el, { autoAlpha: 1, clearProps: "opacity,visibility" });
      }
    } else if (
      currentPath === "/" &&
      !isPreloading &&
      document.body.hasAttribute(HOME_GALLERY_INTRO_PENDING_ATTR)
    ) {
      fadeInScrollHint();
    }

    return () => {
      window.removeEventListener(HOME_GALLERY_INTRO_PENDING_EVENT, onPending);
      window.removeEventListener(HOME_GALLERY_INTRO_DONE_EVENT, onDone);
    };
  }, [currentPath, fadeInScrollHint, isPreloading]);

  useEffect(() => {
    const onLeaveOutro = (event: Event) => {
      if (currentPath !== "/") return;

      const scroller = document.querySelector<HTMLElement>(".home-gallery-scroller");
      const galleryIdle = scroller?.classList.contains("home-gallery-is-idle") ?? false;

      hideScrollHint(galleryIdle);
    };

    window.addEventListener(HOME_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
    return () => {
      window.removeEventListener(HOME_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
      scrollHintTweenRef.current?.kill();
      scrollHintTweenRef.current = null;
    };
  }, [currentPath, hideScrollHint]);

  useLayoutEffect(() => {
    const nav = navBlurRef.current;
    const scrollHint = scrollHintWrapRef.current;
    const chromeToggles = chromeTogglesWrapRef.current;
    if (!nav || !scrollHint) return;

    const mobileMq = window.matchMedia(MOBILE_MQ);

    const syncChromeX = () => {
      const firstNavLink = nav.querySelector<HTMLElement>(".nav-link");

      if (mobileMq.matches) {
        scrollHint.style.removeProperty("left");
        chromeToggles?.style.removeProperty("left");
      } else if (firstNavLink) {
        const left = `${firstNavLink.getBoundingClientRect().left}px`;
        scrollHint.style.left = left;
        if (chromeToggles) chromeToggles.style.left = left;
      } else {
        scrollHint.style.removeProperty("left");
        chromeToggles?.style.removeProperty("left");
      }
    };

    syncChromeX();

    const observer = new ResizeObserver(syncChromeX);
    observer.observe(nav);
    window.addEventListener("resize", syncChromeX);
    mobileMq.addEventListener("change", syncChromeX);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncChromeX);
      mobileMq.removeEventListener("change", syncChromeX);
    };
  }, [currentPath, isPreloading, playLandingReveal, isNavInteractive]);

  // ── Link hover — soft opacity fade (header chrome only; not contact links) ─
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const HOVER_OPACITY = 0.46;
    const cleanups: Array<() => void> = [];

    header
      .querySelectorAll<HTMLElement>(".nav-split-target, .glitch-hover-target")
      .forEach((spanEl) => {
        if (spanEl.closest(".nav-link") || spanEl.closest(".scroll-hint-label")) return;

        const triggerEl =
          (spanEl.closest(
            'a, button, [role="button"], [role="link"], [data-glitch-hover-target]'
          ) as HTMLElement | null) ?? spanEl;

        gsap.set(spanEl, { opacity: 1, y: 0 });

        const onEnter = () => {
          if (splitsRef.current) return;
          gsap.killTweensOf(spanEl);
          if (reduceMotion) {
            gsap.set(spanEl, { opacity: HOVER_OPACITY });
            return;
          }
          gsap.to(spanEl, {
            opacity: HOVER_OPACITY,
            y: -0.5,
            duration: 0.48,
            ease: "power1.out",
          });
        };

        const onLeave = () => {
          gsap.killTweensOf(spanEl);
          if (reduceMotion) {
            gsap.set(spanEl, { opacity: 1, y: 0 });
            return;
          }
          gsap.to(spanEl, {
            opacity: 1,
            y: 0,
            duration: 0.58,
            ease: "power2.inOut",
          });
        };

        triggerEl.addEventListener("pointerenter", onEnter);
        triggerEl.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          gsap.killTweensOf(spanEl);
          gsap.set(spanEl, { clearProps: "opacity,transform" });
          triggerEl.removeEventListener("pointerenter", onEnter);
          triggerEl.removeEventListener("pointerleave", onLeave);
        });
      });

    return () => cleanups.forEach((fn) => fn());
  }, [currentPath]);

  // Home → archive lightbox: keep chrome hidden across route change until the
  // archive lightbox fade brings it back (prevents one-frame nav flash).
  useLayoutEffect(() => {
    if (!shouldDeferChromeReveal()) return;
    hideSiteChrome();
  }, [currentPath]);

  // ── Nav reveal ────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const allTargets = Array.from(
      header.querySelectorAll<HTMLElement>(".nav-split-target"),
    );
    if (!allTargets.length) return;
    const [skmngTarget, ...navTargets] = allTargets;

    // ── Case 1: preloader is active ────────────────────────────────────────
    // SKMNG is visible (this IS the real nav element, shown above the preloader).
    // Nav items stay hidden — they'll animate in after the preloader.
    // Typewriter starts only when the preloader mounts (after theme gate), in sync
    // with the counter / logo intro delay.
    if (isPreloading) {
      navTargets.forEach((el) => gsap.set(el, { autoAlpha: 0 }));

      if (skmngTarget) {
        gsap.set(skmngTarget, { autoAlpha: 0 });
        cancelSkmngIntroRef.current();

        const startSkmngIntro = () => {
          if (!skmngTarget) return;
          gsap.set(skmngTarget, { autoAlpha: 1 });
          cancelSkmngIntroRef.current();
          cancelSkmngIntroRef.current = runTypewriterScrambleReveal(skmngTarget, "SKMNG", {
            fadeToForegroundWhenDone: false,
          });
        };

        let introDelay: gsap.core.Tween | null = null;

        const onPreloaderStart = () => {
          introDelay?.kill();
          introDelay = gsap.delayedCall(PRELOADER_COUNTER_DELAY_S, startSkmngIntro);
        };

        window.addEventListener(HOME_PRELOADER_START_EVENT, onPreloaderStart);
        if (hasHomePreloaderStarted()) {
          onPreloaderStart();
        }

        return () => {
          window.removeEventListener(HOME_PRELOADER_START_EVENT, onPreloaderStart);
          introDelay?.kill();
          cancelSkmngIntroRef.current();
          cancelSkmngIntroRef.current = () => {};
        };
      }

      return;
    }

    // ── Case 2: no landing reveal (internal navigation, etc.) ─────────────
    if (!playLandingReveal) {
      resetNavTargetText(allTargets);
      gsap.set(allTargets, { autoAlpha: 1 });
      if (shouldDeferChromeReveal()) {
        hideSiteChrome();
      }
      return;
    }

    // ── Case 3: post-preloader landing reveal ──────────────────────────────
    // SKMNG was already visible (case 1) — keep it, skip its animation.
    if (skmngTarget) {
      skmngTarget.replaceChildren(document.createTextNode("SKMNG"));
      gsap.set(skmngTarget, { autoAlpha: 1 });
      skmngTarget.style.color = NAV_SCRAMBLE_RED;
      fadeNavLabelColorOut(skmngTarget);
    }

    if (!navTargets.length) return;

    // CRITICAL: reset parent span opacity/visibility before SplitText.
    // Case 1 left navTargets at autoAlpha:0 via inline style. If we split and
    // animate words without resetting the parent, the animated words are visible
    // but their invisible parent container swallows them entirely.
    navTargets.forEach((el) => gsap.set(el, { autoAlpha: 1 }));
    resetNavItemText(navTargets);

    const splits: SplitText[] = [];
    const allWords: HTMLElement[] = [];

    navTargets.forEach((el) => {
      const split = new SplitText(el, {
        type: "words",
        wordsClass: "nav-split-word",
      });
      splits.push(split);
      allWords.push(...(split.words as HTMLElement[]));
    });

    splitsRef.current = splits;

    gsap.set(allWords, { autoAlpha: 0, yPercent: 110 });
    gsap.to(allWords, {
      autoAlpha: 1,
      yPercent: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.1,
      onComplete: () => {
        revertSplits(splitsRef.current);
        splitsRef.current = null;
        resetNavItemText(navTargets);
        onLandingRevealDone?.();
      },
    });

    return () => {
      gsap.killTweensOf(allWords);
      if (splitsRef.current) {
        revertSplits(splitsRef.current);
        splitsRef.current = null;
        resetNavItemText(navTargets);
      }
    };
  }, [onLandingRevealDone, playLandingReveal, isPreloading]);

  return (
    <>
      {/* Language — fixed top-left (all viewports) */}
      <div
        ref={chromeTogglesWrapRef}
        className={`chrome-toggles-wrap fixed top-[max(2.5%,env(safe-area-inset-top))] left-0 z-40 pointer-events-auto select-none transition-opacity duration-300 pl-[max(2vw,env(safe-area-inset-left))] md:pl-0 ${
          workChromeDifference ? "work-chrome-difference" : ""
        } ${isPreloading ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <LanguageToggle />
      </div>

      {/* LIVE — top right */}
      <div
        className={`live-indicator-wrap fixed right-[max(2vw,env(safe-area-inset-right))] top-[max(2.5%,env(safe-area-inset-top))] z-40 flex items-center pointer-events-none select-none transition-opacity duration-300 ${isPreloading ? "opacity-0" : "opacity-100"}`}
      >
        <span className="live-indicator flex items-center gap-2" aria-label={messages.a11y.live}>
          <span className="live-indicator-dot" aria-hidden />
          <span
            className={`site-chrome-text font-semibold uppercase leading-none tracking-[0.14em]${
              workChromeDifference ? " work-chrome-difference" : ""
            }`}
          >
            {messages.chrome.online}
          </span>
        </span>
      </div>

      {/* Bottom-left scroll / swipe hint — home gallery; fades out on route change (stay mounted for CSS transition) */}
      <div
        ref={scrollHintWrapRef}
        data-scroll-hint-active={currentPath === "/" ? "1" : undefined}
        className="scroll-hint-wrap fixed bottom-[max(2.5%,env(safe-area-inset-bottom))] left-0 z-[60] flex flex-col gap-1.5 pointer-events-none max-md:left-[max(2vw,env(safe-area-inset-left))] max-md:right-auto max-md:w-full max-md:max-w-[calc(100vw-4vw)] md:right-[max(2vw,env(safe-area-inset-right))]"
        aria-hidden
      >
        <span className="scroll-hint-label site-chrome-text block w-fit font-semibold uppercase leading-none tracking-[0.14em]">
          SWIPE/SCROLL
        </span>
        <div className="scroll-hint-track">
          <div className="scroll-hint-beam" />
        </div>
      </div>

      {/* Header — raised above preloader (z-[130]) while the preloader is active
          so the SKMNG nav element is visible at its final position throughout. */}
      <header
        ref={headerRef}
        data-nav-interactive={isNavInteractive ? "1" : "0"}
        className={`fixed inset-0 pointer-events-none ${
          workChromeDifference ? "work-chrome-difference" : ""
        } ${isPreloading ? "z-[130]" : "z-50"}`}
      >
        <div className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2">
          <div className="siteWideGrid site-header-grid items-center max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-start max-md:gap-4 max-md:pl-[max(2vw,env(safe-area-inset-left))] max-md:pr-[max(2vw,env(safe-area-inset-right))]">
            <button
              type="button"
              onPointerDown={handleNavPointerDown("/")}
              onClick={handleNavClick("/")}
              className={`nav-link site-chrome-text w-fit shrink-0 cursor-auto whitespace-nowrap leading-none transition max-md:order-1 md:col-start-1 md:justify-self-end ${
                isNavInteractive ? "pointer-events-auto" : "pointer-events-none"
              }`}
              aria-disabled={!isNavInteractive}
              aria-label="Home"
              data-nav-href="/"
            >
              <span className="nav-split-target inline-block overflow-hidden uppercase leading-none">
                SKMNG
              </span>
            </button>

            {showWorkLoadingLabel ? (
              <span
                ref={workLoadingRef}
                className="work-nav-loading site-chrome-text pointer-events-none uppercase leading-none tracking-[0.14em] max-md:hidden md:col-start-2 md:justify-self-center md:self-center"
                aria-live="polite"
              >
                LOADING
              </span>
            ) : null}

            <nav
              ref={navBlurRef}
              className={`site-chrome-text flex w-max shrink-0 items-center gap-4 md:gap-3 max-md:order-2 md:col-start-3 md:justify-self-start ${
                isNavInteractive ? "pointer-events-auto" : "pointer-events-none"
              }`}
            >
              {navItems.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onPointerDown={handleNavPointerDown(item.href)}
                    onClick={handleNavClick(item.href)}
                    aria-label={item.label}
                    aria-disabled={!isNavInteractive}
                    data-nav-href={item.href}
                    className="nav-link site-chrome-text w-fit shrink-0 cursor-auto whitespace-nowrap leading-none transition"
                  >
                    <span className="nav-split-target inline-block overflow-hidden uppercase leading-none">
                      {item.label}
                    </span>
                  </button>
              ))}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
