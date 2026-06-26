"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";

import {
  WorkHoverBackground,
  type WorkHoverBackgroundHandle,
} from "@/components/WorkHoverBackground";
import { WorkProjectScroll } from "@/components/WorkProjectScroll";
import { WORK_LEAVE_OUTRO_EVENT } from "@/components/PageTransitionProvider";
import { useLocale } from "@/components/LocaleProvider";
import { useWorkNavAlign } from "@/hooks/useWorkNavAlign";
import {
  clearWorkTitlePins,
  readWorkTitlePins,
  saveWorkTitlePins,
  type WorkTitlePins,
} from "@/lib/workTitlePin";
import { getWorkCoverSrc, preloadWorkCover } from "@/lib/workCoverImage";
import {
  clearWorkActiveSlug,
  clearWorkEntryCover,
  consumeWorkReturnReveal,
  consumeWorkProjectTitleReveal,
  dispatchWorkProjectLoading,
  markWorkProjectEnter,
  markWorkProjectTitleReveal,
  markWorkReturnEnter,
  markWorkReturnReveal,
  readWorkActiveSlug,
  readWorkEntryCoverSlug,
  saveWorkActiveSlug,
  saveWorkEntryCoverSlug,
  saveWorkEntryCoverUrl,
  WORK_NAV_LOADING_FADE_OUT_S,
  WORK_RETURN_DIRECTORY_EVENT,
} from "@/lib/workNavEvents";
import type { WorkProject } from "@/lib/works";
import {
  WORK_PROJECT_TITLE_BUTTON_CLASS,
  WORK_PROJECT_TITLE_TEXT_CLASS,
} from "@/lib/workProjectTitle";
import { groupProjectsByCategory, workProjectPath } from "@/lib/works";
import { setWorkChrome } from "@/lib/workChrome";
import {
  resetWorkChromeRegistry,
  syncWorkChromeRegistry,
} from "@/lib/workChromeStore";
import { workTitleRefs } from "@/lib/workTitleRefs";

const WORK_CLIP_VISIBLE = "inset(0% 0% 0% 0%)";
const WORK_CLIP_HIDDEN = "inset(0% 0% 100% 0%)";
/** Pre-reveal state: clipped from the top so the title reveals bottom→top (slides
 *  up) as the clip opens. Opacity stays 1 throughout — the clip alone hides it,
 *  so there's no opacity toggling (which caused the double-blink). */
const WORK_CLIP_REVEAL_HIDDEN = "inset(100% 0% 0% 0%)";
const WORK_TITLE_REVEAL_IN_S = 0.58;
const WORK_TITLE_EXIT_S = 0.45;
const WORK_TITLE_EXIT_STAGGER = 0.05;
const WORK_OVERLAY_IN_S = 0.32;
const WORK_OVERLAY_OUT_S = 0.32;
const WORK_PROJECT_LOAD_HOLD_S = 1.5;
const WORK_LEAVE_OUTRO_S = 0.34;
const WORK_LEAVE_BLUR_PX = 18;
const WORK_RETURN_PAGE_FADE_S = 0.34;
const WORK_TITLE_LANDING_S = 0.38;
const WORK_TITLE_LANDING_STAGGER_S = 0.04;
const WORK_TITLE_LANDING_LEAD_S = 0.04;

type WorkExperienceProps = {
  projects: WorkProject[];
  selectedSlug: string | null;
};

function prepClipTargets(targets: HTMLElement[]) {
  targets.forEach((el) => {
    el.style.animation = "none";
    gsap.set(el, {
      clipPath: WORK_CLIP_VISIBLE,
      overflow: "hidden",
      willChange: "clip-path",
    });
  });
}

function hideProjectTitleForReveal(el: HTMLElement) {
  gsap.killTweensOf(el);
  gsap.set(el, {
    clipPath: WORK_CLIP_REVEAL_HIDDEN,
    autoAlpha: 1,
    visibility: "visible",
    willChange: "clip-path",
  });
}

function finishProjectTitleReveal(el: HTMLElement) {
  gsap.set(el, {
    clipPath: WORK_CLIP_VISIBLE,
    clearProps: "opacity,visibility,willChange,clip-path",
  });
}

function countDirectoryLandingItems(groups: ReturnType<typeof groupProjectsByCategory>) {
  return groups.reduce(
    (count, group) => count + 1 + group.projects.length,
    0,
  );
}

function workDirectoryLandingDurationMs(itemCount: number) {
  if (itemCount <= 0) return 0;
  const lastDelay =
    (itemCount - 1) * WORK_TITLE_LANDING_STAGGER_S + WORK_TITLE_LANDING_LEAD_S;
  return (lastDelay + WORK_TITLE_LANDING_S) * 1000;
}

/** Drop project page from transition targets so GSAP cannot restore its opacity during /work enter. */
function detachProjectPageBeforeWorkReturn(root: HTMLDivElement | null) {
  if (!root) return;
  gsap.killTweensOf(root);
  gsap.set(root, { autoAlpha: 0, visibility: "hidden" });
  root.dataset.workLeaving = "1";
  root.removeAttribute("data-page-content");
}

export function WorkExperience({ projects, selectedSlug }: WorkExperienceProps) {
  const router = useRouter();
  const { messages } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const standaloneTitleRef = useRef<HTMLParagraphElement>(null);
  const titleRevealTlRef = useRef<gsap.core.Timeline | null>(null);
  const titleRevealInProgressRef = useRef(false);
  const overlayOutTlRef = useRef<gsap.core.Tween | null>(null);
  const bgRef = useRef<WorkHoverBackgroundHandle>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const titlePinRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const categoryLabelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const categoryBlockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const leaveTlRef = useRef<gsap.core.Timeline | null>(null);
  const selectingRef = useRef(false);
  const returningToDirectoryRef = useRef(false);
  const returnDirectoryChromeRef = useRef(false);
  const hoverSlugRef = useRef<string | null>(null);

  // NOTE: pins + pending-reveal must start null/false to match the server render
  // (sessionStorage is client-only — reading it in the initial state caused a
  // hydration mismatch on the directory). They're populated in layout effects
  // below, post-hydration.
  const [titlePins, setTitlePins] = useState<WorkTitlePins | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(selectedSlug ?? null);
  const [returningToDirectory, setReturningToDirectory] = useState(false);
  const [returnLandingActive, setReturnLandingActive] = useState(false);
  const [pendingProjectTitleReveal, setPendingProjectTitleReveal] = useState(false);
  const [titleRevealInProgress, setTitleRevealInProgress] = useState(false);
  const [entryBridgeSlug, setEntryBridgeSlug] = useState<string | null>(null);
  const [titleRevealSyncSlug, setTitleRevealSyncSlug] = useState<string | null>(null);
  const [pinsReady, setPinsReady] = useState(() => !selectedSlug);

  const titleRevealSynced =
    !selectedSlug || titleRevealSyncSlug === selectedSlug;

  const listRef = useWorkNavAlign(14, !selectedSlug || returningToDirectory);
  const projectTitleRef = useWorkNavAlign(14, Boolean(selectedSlug && !titlePins));

  const categoryGroups = useMemo(
    () => groupProjectsByCategory(projects),
    [projects],
  );

  const displaySlug = activeSlug ?? selectedSlug;
  const activeProject =
    displaySlug != null
      ? projects.find((project) => project.slug === displaySlug) ?? null
      : null;

  const showWorkBackground = !selectedSlug && !returningToDirectory;
  const showGallery = Boolean(selectedSlug && !returningToDirectory);
  const showDirectory = !selectedSlug || returningToDirectory;
  const skipDirectoryLanding = Boolean(titlePins && !returnLandingActive);

  useLayoutEffect(() => {
    setWorkChrome(true);
  }, []);

  const getActiveProjectTitleEl = useCallback(() => {
    const slug = displaySlug ?? selectedSlug;
    if (slug && workTitleRefs.current.get(slug)) {
      return workTitleRefs.current.get(slug) ?? null;
    }
    return standaloneTitleRef.current;
  }, [displaySlug, selectedSlug]);

  const finishInitialHeroReady = useCallback(
    (options?: { syncOverlayFadeOut?: boolean }) => {
      setEntryBridgeSlug(null);
      dispatchWorkProjectLoading(false, {
        fadeOutDuration: options?.syncOverlayFadeOut
          ? WORK_NAV_LOADING_FADE_OUT_S
          : undefined,
      });
    },
    [],
  );

  const fadeOverlayOut = useCallback(
    (onComplete?: () => void) => {
      const overlay = overlayRef.current;
      if (!overlay) {
        finishInitialHeroReady({ syncOverlayFadeOut: true });
        onComplete?.();
        return;
      }

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      overlayOutTlRef.current?.kill();
      titleRevealTlRef.current?.kill();
      titleRevealTlRef.current = null;

      if (reduceMotion) {
        gsap.set(overlay, { autoAlpha: 0, visibility: "hidden" });
        overlayOutTlRef.current = null;
        finishInitialHeroReady();
        onComplete?.();
        return;
      }

      finishInitialHeroReady({ syncOverlayFadeOut: true });

      gsap.killTweensOf(overlay);
      gsap.set(overlay, { visibility: "visible" });
      overlayOutTlRef.current = gsap.to(overlay, {
        autoAlpha: 0,
        duration: WORK_OVERLAY_OUT_S,
        ease: "power2.inOut",
        delay: WORK_NAV_LOADING_FADE_OUT_S,
        onComplete: () => {
          gsap.set(overlay, { visibility: "hidden" });
          overlayOutTlRef.current = null;
          onComplete?.();
        },
      });
    },
    [finishInitialHeroReady],
  );

  const revealProjectTitleOutro = useCallback(() => {
    const overlay = overlayRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const runReveal = (titleEl: HTMLElement | null) => {
      titleRevealTlRef.current?.kill();
      titleRevealTlRef.current = null;
      overlayOutTlRef.current?.kill();
      overlayOutTlRef.current = null;

      if (!overlay) {
        titleRevealInProgressRef.current = false;
        finishInitialHeroReady();
        setPendingProjectTitleReveal(false);
        setTitleRevealInProgress(false);
        return;
      }

      if (reduceMotion || !titleEl) {
        titleRevealInProgressRef.current = false;
        finishInitialHeroReady();
        setPendingProjectTitleReveal(false);
        setTitleRevealInProgress(false);
        gsap.set(overlay, { autoAlpha: 0, visibility: "hidden" });
        if (titleEl) {
          finishProjectTitleReveal(titleEl);
        }
        return;
      }

      titleRevealInProgressRef.current = true;
      setTitleRevealInProgress(true);

      finishInitialHeroReady({ syncOverlayFadeOut: true });

      gsap.killTweensOf(overlay);
      gsap.set(overlay, { visibility: "visible" });
      hideProjectTitleForReveal(titleEl);

      titleRevealTlRef.current = gsap.timeline({
        onComplete: () => {
          gsap.set(overlay, { autoAlpha: 0, visibility: "hidden" });
          finishProjectTitleReveal(titleEl);
          titleRevealInProgressRef.current = false;
          setPendingProjectTitleReveal(false);
          setTitleRevealInProgress(false);
          titleRevealTlRef.current = null;
        },
      });

      titleRevealTlRef.current.to(
        overlay,
        {
          autoAlpha: 0,
          duration: WORK_OVERLAY_OUT_S,
          ease: "power2.inOut",
        },
        WORK_NAV_LOADING_FADE_OUT_S,
      );

      titleRevealTlRef.current.to(
        titleEl,
        {
          clipPath: WORK_CLIP_VISIBLE,
          duration: WORK_TITLE_REVEAL_IN_S,
          ease: "power3.out",
        },
        ">",
      );
    };

    let attempts = 0;
    const waitForTitleEl = () => {
      const titleEl = getActiveProjectTitleEl();
      if (titleEl || attempts >= 24) {
        runReveal(titleEl);
        return;
      }
      attempts += 1;
      requestAnimationFrame(waitForTitleEl);
    };

    waitForTitleEl();
  }, [finishInitialHeroReady, getActiveProjectTitleEl]);

  useLayoutEffect(() => {
    if (!selectedSlug) {
      titleRevealInProgressRef.current = false;
      setTitleRevealSyncSlug(null);
      setPendingProjectTitleReveal(false);
      setTitleRevealInProgress(false);
      return;
    }

    const pendingReveal = consumeWorkProjectTitleReveal();
    setPendingProjectTitleReveal(pendingReveal);

    const overlay = overlayRef.current;
    if (overlay && pendingReveal) {
      gsap.set(overlay, { autoAlpha: 1, visibility: "visible" });
    }

    setTitleRevealSyncSlug(selectedSlug);
  }, [selectedSlug]);

  useLayoutEffect(() => {
    if (
      !pendingProjectTitleReveal ||
      !selectedSlug ||
      titleRevealInProgress ||
      titleRevealInProgressRef.current
    ) {
      return;
    }

    const titleEl = getActiveProjectTitleEl();
    if (!titleEl || gsap.isTweening(titleEl)) return;

    hideProjectTitleForReveal(titleEl);
  }, [
    getActiveProjectTitleEl,
    pendingProjectTitleReveal,
    selectedSlug,
    titleRevealInProgress,
  ]);

  useLayoutEffect(() => {
    if (selectedSlug) {
      selectingRef.current = false;
      returningToDirectoryRef.current = false;
      setReturningToDirectory(false);
      setReturnLandingActive(false);
      setTitlePins(readWorkTitlePins());
      setActiveSlug(selectedSlug);
      saveWorkActiveSlug(selectedSlug);
      const coverSlug = readWorkEntryCoverSlug();
      if (coverSlug) {
        setEntryBridgeSlug(coverSlug);
      } else {
        setEntryBridgeSlug(selectedSlug);
        saveWorkEntryCoverSlug(selectedSlug);
      }
      setPinsReady(true);
      return;
    }

    selectingRef.current = false;
    setEntryBridgeSlug(null);
    clearWorkEntryCover();

    const storedPins = readWorkTitlePins();
    const storedActiveSlug = readWorkActiveSlug();
    if (storedPins) {
      setTitlePins(storedPins);
    }
    if (storedActiveSlug) {
      setActiveSlug(storedActiveSlug);
    }

    if (storedPins && consumeWorkReturnReveal()) {
      setReturnLandingActive(true);
    }

    if (returningToDirectoryRef.current || storedPins) {
      returningToDirectoryRef.current = false;
      if (returningToDirectory) setReturningToDirectory(false);
      setPinsReady(true);
      return;
    }

    if (!selectingRef.current) {
      clearWorkTitlePins();
      clearWorkActiveSlug();
      setTitlePins(null);
      setActiveSlug(null);
    }

    setPinsReady(true);
  }, [selectedSlug]);

  useEffect(() => {
    if (!returnLandingActive || selectedSlug) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setReturnLandingActive(false);
      return;
    }

    const durationMs = workDirectoryLandingDurationMs(
      countDirectoryLandingItems(categoryGroups),
    );
    const timer = window.setTimeout(() => {
      setReturnLandingActive(false);
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [categoryGroups, returnLandingActive, selectedSlug]);

  const collectDirectoryTargets = useCallback(
    (slug: string) => {
      const targets: HTMLElement[] = [];

      categoryGroups.forEach((group) => {
        const selectedInGroup = group.projects.some((p) => p.slug === slug);

        if (!selectedInGroup) {
          const block = categoryBlockRefs.current.get(group.id);
          if (block) targets.push(block);
          return;
        }

        const label = categoryLabelRefs.current.get(group.id);
        if (label) targets.push(label);

        group.projects.forEach((project) => {
          if (project.slug === slug) return;
          const row = rowRefs.current.get(project.slug);
          if (row) targets.push(row);
        });
      });

      return targets;
    },
    [categoryGroups],
  );

  const handleProjectTransition = useCallback(
    (fromSlug: string, toSlug: string, commit: () => void) => {
      if (fromSlug === toSlug) {
        commit();
        return;
      }

      const overlay = overlayRef.current;
      const fromTitle = workTitleRefs.current.get(fromSlug);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const navigate = () => {
        saveWorkActiveSlug(toSlug);
        commit();
        markWorkProjectEnter();
        markWorkProjectTitleReveal();
        router.push(workProjectPath(toSlug));
      };

      if (reduceMotion || !overlay) {
        navigate();
        return;
      }

      dispatchWorkProjectLoading(true);
      gsap.killTweensOf([overlay, fromTitle].filter(Boolean) as HTMLElement[]);
      gsap.set(overlay, { autoAlpha: 0, visibility: "visible" });

      const tl = gsap.timeline({ onComplete: navigate });

      tl.to(
        overlay,
        { autoAlpha: 1, duration: WORK_OVERLAY_IN_S, ease: "power2.inOut" },
        0,
      );

      if (fromTitle) {
        // Outgoing title slides DOWN and hides (top edge sweeps down), the
        // mirror of the incoming title's slide-up reveal. Opacity stays 1.
        gsap.set(fromTitle, {
          clipPath: WORK_CLIP_VISIBLE,
          autoAlpha: 1,
          willChange: "clip-path",
        });
        tl.to(
          fromTitle,
          {
            clipPath: WORK_CLIP_REVEAL_HIDDEN,
            duration: WORK_OVERLAY_IN_S,
            ease: "power3.inOut",
          },
          0,
        );
      }

      tl.to({}, { duration: WORK_PROJECT_LOAD_HOLD_S });
    },
    [router],
  );

  const captureTitlePins = useCallback(() => {
    const pins: WorkTitlePins = {};
    titlePinRefs.current.forEach((anchor, slug) => {
      const rect = anchor.getBoundingClientRect();
      pins[slug] = { top: rect.top, left: rect.left };
    });
    return pins;
  }, []);

  useLayoutEffect(() => {
    if (selectedSlug) {
      returnDirectoryChromeRef.current = false;
      return;
    }
    if (!titlePins || returnDirectoryChromeRef.current) return;

    returnDirectoryChromeRef.current = true;

    hoverSlugRef.current = null;
    bgRef.current?.setActive(null, true);

    let outerRaf = 0;
    let innerRaf = 0;
    const syncPins = () => {
      const next = captureTitlePins();
      if (Object.keys(next).length === 0) return;
      saveWorkTitlePins(next);
      setTitlePins(next);
    };

    outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(syncPins);
    });

    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [captureTitlePins, selectedSlug, titlePins]);

  const setHoverSlug = useCallback(
    (slug: string | null) => {
      if (
        selectedSlug ||
        selectingRef.current ||
        entryBridgeSlug ||
        hoverSlugRef.current === slug
      ) {
        return;
      }
      hoverSlugRef.current = slug;
      bgRef.current?.setActive(slug);
    },
    [entryBridgeSlug, selectedSlug],
  );

  const onListPointerOver = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (selectedSlug || selectingRef.current || entryBridgeSlug) return;
      const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-work-slug]");
      if (!btn) return;
      setHoverSlug(btn.dataset.workSlug ?? null);
    },
    [entryBridgeSlug, selectedSlug, setHoverSlug],
  );

  const onListPointerOut = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (selectedSlug || selectingRef.current || entryBridgeSlug) return;
      const related = event.relatedTarget as Node | null;
      if (listRef.current?.contains(related)) return;
      hoverSlugRef.current = null;
      bgRef.current?.setActive(null);
    },
    [entryBridgeSlug, listRef, selectedSlug],
  );

  useEffect(() => {
    if (selectedSlug) return;

    projects.forEach((project) => {
      void preloadWorkCover(project.thumbnailUrl);
    });
  }, [projects, selectedSlug]);

  const enterProject = useCallback(
    (slug: string) => {
      if (selectingRef.current || selectedSlug) return;

      const row = rowRefs.current.get(slug);
      if (!row) return;

      const thumbUrl =
        projects.find((project) => project.slug === slug)?.thumbnailUrl ?? null;
      const coverSrc = thumbUrl ? getWorkCoverSrc(thumbUrl) : null;
      const preloadThumb = thumbUrl
        ? preloadWorkCover(thumbUrl)
        : Promise.resolve();

      selectingRef.current = true;
      setEntryBridgeSlug(slug);
      saveWorkEntryCoverSlug(slug);
      if (coverSrc) saveWorkEntryCoverUrl(coverSrc);

      hoverSlugRef.current = slug;
      bgRef.current?.setActive(slug, true);

      const pins = captureTitlePins();
      saveWorkTitlePins(pins);
      setTitlePins(pins);
      setActiveSlug(slug);
      saveWorkActiveSlug(slug);

      const targets = collectDirectoryTargets(slug);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const navigate = () => {
        markWorkProjectEnter();
        void preloadThumb.then(() => {
          router.push(workProjectPath(slug));
        });
      };

      if (reduceMotion || !targets.length) {
        navigate();
        return;
      }

      prepClipTargets(targets);
      gsap.killTweensOf(targets);
      gsap.to(targets, {
        clipPath: WORK_CLIP_HIDDEN,
        duration: WORK_TITLE_EXIT_S,
        ease: "power3.inOut",
        stagger: WORK_TITLE_EXIT_STAGGER,
        onComplete: () => {
          gsap.set(targets, { clearProps: "willChange" });
          navigate();
        },
      });
    },
    [captureTitlePins, collectDirectoryTargets, projects, router, selectedSlug],
  );

  useEffect(() => {
    const onReturnDirectory = (event: Event) => {
      const { onComplete } =
        (event as CustomEvent<{ onComplete?: () => void }>).detail ?? {};
      if (!onComplete || !selectedSlug) {
        onComplete?.();
        return;
      }

      returningToDirectoryRef.current = true;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const finishReturn = () => {
        detachProjectPageBeforeWorkReturn(rootRef.current);
        markWorkReturnReveal();
        markWorkReturnEnter();
        onComplete();
      };

      const scroll = rootRef.current?.querySelector<HTMLElement>(
        ".work-project-scroll",
      );
      if (!scroll || reduceMotion) {
        finishReturn();
        return;
      }

      gsap.killTweensOf(scroll);
      gsap.set(scroll, { willChange: "opacity" });
      gsap.to(scroll, {
        autoAlpha: 0,
        duration: WORK_RETURN_PAGE_FADE_S,
        ease: "power2.inOut",
        onComplete: () => {
          gsap.set(scroll, { clearProps: "willChange" });
          finishReturn();
        },
      });
    };

    const onLeaveOutro = (event: Event) => {
      const { onComplete } =
        (event as CustomEvent<{ onComplete?: () => void }>).detail ?? {};
      if (!onComplete) return;

      clearWorkTitlePins();
      clearWorkActiveSlug();
      clearWorkEntryCover();
      resetWorkChromeRegistry();

      const root = rootRef.current;
      if (!root) {
        onComplete();
        return;
      }

      leaveTlRef.current?.kill();
      leaveTlRef.current = null;
      gsap.killTweensOf(root);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        gsap.to(root, {
          autoAlpha: 0,
          duration: 0.18,
          ease: "power2.in",
          onComplete,
        });
        return;
      }

      gsap.set(root, { filter: "blur(0px)", willChange: "filter, opacity" });

      leaveTlRef.current = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          gsap.set(root, { clearProps: "filter,willChange" });
          leaveTlRef.current = null;
          onComplete();
        },
      });

      leaveTlRef.current.to(
        root,
        {
          autoAlpha: 0,
          filter: `blur(${WORK_LEAVE_BLUR_PX}px)`,
          duration: WORK_LEAVE_OUTRO_S,
        },
        0,
      );
    };

    window.addEventListener(
      WORK_RETURN_DIRECTORY_EVENT,
      onReturnDirectory as EventListener,
    );
    window.addEventListener(WORK_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
    return () => {
      window.removeEventListener(
        WORK_RETURN_DIRECTORY_EVENT,
        onReturnDirectory as EventListener,
      );
      window.removeEventListener(WORK_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
      leaveTlRef.current?.kill();
      leaveTlRef.current = null;
      titleRevealTlRef.current?.kill();
      titleRevealTlRef.current = null;
      titleRevealInProgressRef.current = false;
    };
  }, [selectedSlug]);

  useLayoutEffect(() => {
    syncWorkChromeRegistry({
      projects,
      interactive: !selectedSlug && showDirectory,
      clipHidden: Boolean(pendingProjectTitleReveal && selectedSlug),
      titleRevealInProgress,
      onSelect: enterProject,
      onHover: setHoverSlug,
    });
  }, [
    enterProject,
    pendingProjectTitleReveal,
    projects,
    selectedSlug,
    setHoverSlug,
    showDirectory,
    titleRevealInProgress,
  ]);

  let revealIndex = 0;

  const directoryList = (
    <div
      ref={listRef}
      className="work-project-list pointer-events-auto relative z-30 flex max-h-[calc(100dvh-50%)] w-full flex-col items-start overflow-y-auto pb-[max(2.5%,env(safe-area-inset-bottom))] pr-[max(2vw,env(safe-area-inset-right))] md:max-h-[calc(100dvh-42%)]"
      onPointerOver={onListPointerOver}
      onPointerOut={onListPointerOut}
      onFocus={(event) => {
        const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-work-slug]");
        if (btn) setHoverSlug(btn.dataset.workSlug ?? null);
      }}
      onBlur={(event) => {
        if (selectingRef.current || entryBridgeSlug) return;
        const related = event.relatedTarget as Node | null;
        if (listRef.current?.contains(related)) return;
        hoverSlugRef.current = null;
        bgRef.current?.setActive(null);
      }}
    >
      {categoryGroups.map((group) => (
        <div
          key={group.id}
          ref={(node) => {
            if (node) categoryBlockRefs.current.set(group.id, node);
            else categoryBlockRefs.current.delete(group.id);
          }}
          className="work-category-block mb-4 flex w-full max-w-[min(100%,28rem)] flex-col items-start gap-3 overflow-hidden"
        >
          <div
            ref={(node) => {
              if (node) categoryLabelRefs.current.set(group.id, node);
              else categoryLabelRefs.current.delete(group.id);
            }}
            className="work-category-label-row w-full overflow-hidden"
          >
            <p className="work-category-label work-chrome-difference site-chrome-text m-0 uppercase leading-none tracking-[0.14em]">
              <span
                className={`inline-block leading-none${
                  skipDirectoryLanding ? "" : " work-title-reveal"
                }`}
                style={
                  skipDirectoryLanding
                    ? undefined
                    : {
                        animationDelay: `${revealIndex++ * WORK_TITLE_LANDING_STAGGER_S + WORK_TITLE_LANDING_LEAD_S}s`,
                      }
                }
              >
                {messages.work.categories[group.id] ?? group.label}
              </span>
            </p>
          </div>

          {group.projects.map((project) => {
            const delay = `${revealIndex++ * WORK_TITLE_LANDING_STAGGER_S + WORK_TITLE_LANDING_LEAD_S}s`;
            const isPinned =
              titlePins &&
              displaySlug === project.slug &&
              Boolean(selectedSlug || showDirectory);
            const showTitleLanding = !skipDirectoryLanding && !isPinned;

            return (
              <div
                key={project.slug}
                ref={(node) => {
                  if (node) rowRefs.current.set(project.slug, node);
                  else rowRefs.current.delete(project.slug);
                }}
                className={`work-project-row w-full overflow-hidden${
                  isPinned ? " work-project-row-pinned invisible" : ""
                }`}
              >
                <div
                  ref={(node) => {
                    if (node) titlePinRefs.current.set(project.slug, node);
                    else titlePinRefs.current.delete(project.slug);
                  }}
                  className="work-chrome-difference w-fit"
                >
                  <button
                    type="button"
                    data-work-slug={project.slug}
                    onClick={() => enterProject(project.slug)}
                    className={WORK_PROJECT_TITLE_BUTTON_CLASS}
                  >
                    <span
                      className={`${WORK_PROJECT_TITLE_TEXT_CLASS}${
                        showTitleLanding ? " work-title-reveal" : ""
                      }`}
                      style={
                        showTitleLanding ? { animationDelay: delay } : undefined
                      }
                    >
                      {project.title}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div
        ref={rootRef}
        data-page-content
        className={`relative min-h-[100dvh] bg-transparent ${
          selectedSlug && !returningToDirectory
            ? "h-[100dvh] overflow-x-hidden overflow-y-auto overscroll-y-none"
            : "overflow-hidden"
        }`}
      >
        {showWorkBackground ? (
          <WorkHoverBackground ref={bgRef} projects={projects} />
        ) : null}

        <div
          ref={overlayRef}
          className="work-project-transition-overlay pointer-events-none fixed inset-0 z-[15] bg-background opacity-0 invisible"
          aria-hidden
        />

        {showGallery ? (
          <>
            {pinsReady && !titlePins && activeProject ? (
              <div
                ref={projectTitleRef}
                className="work-chrome-difference work-project-title-row pointer-events-none z-20 w-full max-w-[min(100%,28rem)]"
              >
                <p
                  ref={standaloneTitleRef}
                  className={`${WORK_PROJECT_TITLE_BUTTON_CLASS} pointer-events-none`}
                >
                  <span className={WORK_PROJECT_TITLE_TEXT_CLASS}>
                    {activeProject.title}
                  </span>
                </p>
              </div>
            ) : null}

            {activeProject ? (
              <WorkProjectScroll
                key={selectedSlug}
                project={activeProject}
                projects={projects}
                scrollRootRef={rootRef}
                onAdvanceToNext={handleProjectTransition}
                onInitialHeroReady={() => {
                  if (pendingProjectTitleReveal) {
                    requestAnimationFrame(() => {
                      revealProjectTitleOutro();
                    });
                    return;
                  }

                  fadeOverlayOut();
                }}
                deferHeroReady={!titleRevealSynced}
              />
            ) : null}
          </>
        ) : null}

        {showDirectory ? directoryList : null}
      </div>
    </>
  );
}
