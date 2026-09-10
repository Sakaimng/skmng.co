"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

import type { AssetImage } from "@/lib/assets";
import { archiveLightboxHref, markArchiveLightboxNavFromHome } from "@/lib/archiveLightboxLink";
import {
  markHomeGalleryIntroDone,
  markHomeGalleryIntroPending,
  clearHomeGalleryIntroPending,
  HOME_GALLERY_INTRO_DELAY_S,
  HOME_GALLERY_LEAVE_CLIP_S,
} from "@/lib/homeGalleryIntro";
import {
  clearHomeGalleryOverImagery,
  setHomeGalleryOverImagery,
} from "@/lib/homeGalleryChrome";
import { lightboxDisplayName } from "@/lib/lightboxLabel";
import {
  HOME_LEAVE_OUTRO_EVENT,
  usePageTransition,
  type HomeLeaveTransition,
} from "@/components/PageTransitionProvider";

const INTRO_DELAY_MS = Math.round(HOME_GALLERY_INTRO_DELAY_S * 1000);
const INTRO_DURATION_MS = 900;
/** Matches archive leave clip — close image upward */
const HOME_LEAVE_CLIP = "inset(0% 0% 100% 0)";
const HOME_LEAVE_STAGGER_S = 0.1;
/** Firefox (esp. SPA remount) fires scroll during programmatic scrollLeft + reports metrics late; smooth snap then animates across the loop. */
const SNAP_DEBOUNCE_MS = 140;
const SNAP_ENABLE_DELAY_MS = 420;
const MOBILE_BREAKPOINT_PX = 768;
const GALLERY_IMAGE_QUALITY = 80;
const GALLERY_BACKGROUND_IMAGE_QUALITY = 60;
const CARD_TAP_MOVE_THRESHOLD_PX = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function HomeGallery({
  images,
  animateIntro = false,
}: {
  images: AssetImage[];
  animateIntro?: boolean;
}) {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scaleRafRef = useRef<number | null>(null);
  const scaleLoopActiveRef = useRef(false);
  const idleTimeoutRef = useRef<number | null>(null);
  const introTimeoutRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const canFadeRef = useRef(false);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const cardPointerRef = useRef<{
    imageId: string;
    startX: number;
    startY: number;
    startScrollLeft: number;
    isTap: boolean;
  } | null>(null);
  const suppressImageClickRef = useRef(false);
  const scrollClickUnlockRef = useRef<number | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(!animateIntro);
  const { navigate } = usePageTransition();

  const isGalleryClickable = !isIdle && isIntroComplete;

  const completeGalleryIntro = useCallback(() => {
    introCompleteRef.current = true;
    setIsIntroComplete(true);
    markHomeGalleryIntroDone();
  }, []);

  const imageCount = images.length;
  const virtualSetCount = 3;
  const totalCardCount = imageCount * virtualSetCount;

  const galleryItems = useMemo(
    () =>
      Array.from({ length: virtualSetCount }, (_, copyIndex) =>
        images.map((image, imageIndex) => ({
          image,
          imageIndex,
          copyIndex,
        })),
      ).flat(),
    [images],
  );

  const introCommittedRef = useRef(false);
  const introCompleteRef = useRef(!animateIntro);
  const leaveTlRef = useRef<gsap.core.Timeline | null>(null);
  const isHomeLeaveOutroRef = useRef(false);

  const getCardsPerView = useCallback((scroller?: HTMLDivElement | null) => {
    const viewportWidth = scroller?.clientWidth ?? 0;
    if (!viewportWidth && typeof window === "undefined") return 3;

    const screenWidth = typeof window !== "undefined"
      ? window.innerWidth || viewportWidth
      : viewportWidth;

    return screenWidth < MOBILE_BREAKPOINT_PX ? 1 : 3;
  }, []);

  const getInitialLeadIndex = useCallback((scroller?: HTMLDivElement | null) => {
    return getCardsPerView(scroller) === 1 ? 1 : 0;
  }, [getCardsPerView]);

  const activateImage = useCallback(
    (imageId: string) => {
      markArchiveLightboxNavFromHome();
      navigate(archiveLightboxHref(imageId));
    },
    [navigate],
  );

  const handleCardPointerDown = useCallback(
    (imageId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isGalleryClickable) return;

      const scroller = scrollerRef.current;
      if (!scroller) return;

      if (event.pointerType !== "touch") {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      cardPointerRef.current = {
        imageId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scroller.scrollLeft,
        isTap: true,
      };
    },
    [isGalleryClickable],
  );

  const handleCardPointerMove = useCallback(
    (imageId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = cardPointerRef.current;
      const scroller = scrollerRef.current;
      if (!state || state.imageId !== imageId || !scroller) return;

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) > CARD_TAP_MOVE_THRESHOLD_PX) {
        state.isTap = false;
      }

      if (!state.isTap && event.pointerType !== "touch") {
        scroller.scrollLeft = state.startScrollLeft - dx;
      }
    },
    [],
  );

  const finishCardPointer = useCallback(
    (imageId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      const state = cardPointerRef.current;
      if (!state || state.imageId !== imageId) return;

      cardPointerRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (state.isTap && !suppressImageClickRef.current && isGalleryClickable) {
        activateImage(imageId);
      }
    },
    [activateImage, isGalleryClickable],
  );

  const handleCardPointerUp = useCallback(
    (imageId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      finishCardPointer(imageId, event);
    },
    [finishCardPointer],
  );

  const handleCardPointerCancel = useCallback(
    (imageId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      finishCardPointer(imageId, event);
    },
    [finishCardPointer],
  );

  const scrollToLeadIndex = useCallback((
    scroller: HTMLDivElement,
    behavior: ScrollBehavior = "auto",
  ) => {
    const viewportWidth = scroller.clientWidth;
    if (!viewportWidth || imageCount === 0) return;

    const cardsPerView = getCardsPerView(scroller);
    const exactCardWidth = viewportWidth / cardsPerView;
    const middleSetOffset = exactCardWidth * imageCount;
    const leadIndex = getInitialLeadIndex(scroller);

    scroller.style.setProperty("--home-gallery-card-width", `${exactCardWidth}px`);
    scroller.scrollTo({
      left: middleSetOffset + leadIndex * exactCardWidth,
      behavior,
    });
  }, [getCardsPerView, getInitialLeadIndex, imageCount]);

  const resetToFirstImage = useCallback((behavior: ScrollBehavior = "auto") => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scrollToLeadIndex(scroller, behavior);
  }, [scrollToLeadIndex]);

  const syncScrollerLayout = useCallback((scroller: HTMLDivElement) => {
    scrollToLeadIndex(scroller, "auto");
  }, [scrollToLeadIndex]);

  const getVisibleGalleryMedia = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || imageCount === 0) return [];

    const cardsPerView = getCardsPerView(scroller);
    const viewportWidth = scroller.clientWidth;
    if (!viewportWidth) return [];

    const cardWidth = viewportWidth / cardsPerView;
    const setWidth = cardWidth * imageCount;
    let scrollLeft = scroller.scrollLeft;

    while (scrollLeft < setWidth) scrollLeft += setWidth;
    while (scrollLeft >= setWidth * 2) scrollLeft -= setWidth;

    const leadIndex = Math.round((scrollLeft - setWidth) / cardWidth);
    const indices: number[] = [];
    for (let i = 0; i < cardsPerView; i++) {
      indices.push(clamp(leadIndex + i, 0, Math.max(imageCount - 1, 0)));
    }

    return [...new Set(indices)]
      .map((idx) =>
        scroller.querySelector<HTMLElement>(
          `.home-gallery-card[data-home-gallery-copy="1"][data-home-gallery-index="${idx}"] .home-gallery-media`,
        ),
      )
      .filter((node): node is HTMLElement => Boolean(node));
  }, [getCardsPerView, imageCount]);

  useEffect(() => {
    const onLeaveOutro = (event: Event) => {
      const { onComplete } =
        (event as CustomEvent<{ onComplete?: () => void; transition?: HomeLeaveTransition }>).detail ??
        {};
      if (!onComplete) return;

      const scroller = scrollerRef.current;
      if (!scroller) {
        onComplete();
        return;
      }

      if (scroller.classList.contains("home-gallery-is-idle")) {
        scroller.classList.add("home-gallery-leaving-complete");
        gsap.set(scroller, { autoAlpha: 0, visibility: "hidden" });
        onComplete();
        return;
      }

      isHomeLeaveOutroRef.current = true;

      leaveTlRef.current?.kill();
      leaveTlRef.current = null;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onComplete();
        return;
      }

      const media = getVisibleGalleryMedia();
      if (!media.length) {
        onComplete();
        return;
      }

      gsap.killTweensOf(scroller);
      scroller.style.transition = "none";
      scroller.classList.remove("home-gallery-is-idle");
      gsap.set(scroller, { opacity: 1 });
      setIsIdle(false);
      gsap.killTweensOf(media);

      media.forEach((el) => {
        gsap.set(el, {
          clipPath: "inset(0% 0 0 0)",
          webkitClipPath: "inset(0% 0 0 0)",
          willChange: "clip-path",
        });
      });

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          media.forEach((el) => {
            gsap.set(el, {
              clipPath: HOME_LEAVE_CLIP,
              webkitClipPath: HOME_LEAVE_CLIP,
            });
          });
          gsap.set(scroller, { autoAlpha: 0, visibility: "hidden" });
          scroller.classList.add("home-gallery-leaving-complete");
          scroller.style.removeProperty("transition");
          leaveTlRef.current = null;
          onComplete();
        },
      });

      leaveTlRef.current = tl;
      tl.to(media, {
        clipPath: HOME_LEAVE_CLIP,
        webkitClipPath: HOME_LEAVE_CLIP,
        duration: HOME_GALLERY_LEAVE_CLIP_S,
        stagger: { each: HOME_LEAVE_STAGGER_S, from: "start" },
      });
    };

    window.addEventListener(HOME_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
    return () => {
      window.removeEventListener(HOME_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
      leaveTlRef.current?.kill();
      leaveTlRef.current = null;
    };
  }, [getVisibleGalleryMedia]);

  /** Landing clip-path: wide viewports often report scrollWidth/clientWidth late (dvw/flex).
   *  ResizeObserver + rAF retry until metrics are stable — fixes SPA return above ~1488px. */
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || imageCount === 0) return;

    introCommittedRef.current = false;
    if (animateIntro) {
      introCompleteRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsIntroComplete(false);
      markHomeGalleryIntroPending();
    }

    let ro: ResizeObserver | null = null;
    let rafOuter = 0;
    let rafInner = 0;

    const ctx = gsap.context(() => {
      const commitIntro = () => {
        syncScrollerLayout(scroller);

        const cards = Array.from(
          scroller.querySelectorAll<HTMLElement>("[data-gallery-card='initial']"),
        );
        const media = cards
          .map((card) => card.querySelector<HTMLElement>(".home-gallery-media"))
          .filter((node): node is HTMLElement => Boolean(node));

        if (cards.length === 0 || media.length === 0) return;

        const cw = scroller.clientWidth;
        const cardsPerView = getCardsPerView(scroller);
        const step = (scroller.clientWidth / cardsPerView) * imageCount;
        if (cw < 2 || !step || step < 8) return;

        introCommittedRef.current = true;

        if (!animateIntro) {
          gsap.set(media, { clearProps: "clipPath,webkitClipPath,willChange" });
          completeGalleryIntro();
          return;
        }

        gsap.set(media, {
          clipPath: "inset(100% 0 0 0)",
          webkitClipPath: "inset(100% 0 0 0)",
          willChange: "clip-path",
        });

        gsap.to(media, {
          clipPath: "inset(0% 0 0 0)",
          webkitClipPath: "inset(0% 0 0 0)",
          duration: 1.05,
          delay: HOME_GALLERY_INTRO_DELAY_S,
          stagger: 0.12,
          ease: "power3.out",
          clearProps: "clipPath,webkitClipPath,willChange",
          onComplete: () => {
            completeGalleryIntro();
          },
        });
      };

      ro = new ResizeObserver(() => {
        if (!introCommittedRef.current) {
          commitIntro();
        } else {
          syncScrollerLayout(scroller);
        }
        scroller.dispatchEvent(new Event("scroll"));
      });
      ro.observe(scroller);

      commitIntro();
      rafOuter = requestAnimationFrame(() => {
        rafInner = requestAnimationFrame(() => {
          if (!introCommittedRef.current) commitIntro();
        });
      });
    }, scroller);

    return () => {
      ro?.disconnect();
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      if (isHomeLeaveOutroRef.current) {
        const scroller = scrollerRef.current;
        if (scroller) {
          gsap.set(scroller, { autoAlpha: 0, visibility: "hidden" });
        }
        ctx.kill();
      } else {
        ctx.revert();
      }
      introCommittedRef.current = false;
    };
  }, [animateIntro, getCardsPerView, imageCount, syncScrollerLayout, completeGalleryIntro]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || imageCount === 0) return;

    let snapEnabled = false;
    let userDroveScroll = false;
    let snapEnableTimeoutId = 0;

    const getCards = () =>
      Array.from(scroller.querySelectorAll<HTMLElement>(".home-gallery-card"));

    const resetFocusScales = () => {
      scroller.querySelectorAll<HTMLElement>(".home-gallery-scale-inner").forEach((inner) => {
        inner.style.transform = "scale3d(1, 1, 1)";
      });
    };

    const updateFocusScale = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const viewportCenter = scrollerRect.width / 2;
      const width = exactCardWidth();
      if (!width || !scrollerRect.width) return false;

      const inners = scroller.querySelectorAll<HTMLElement>(".home-gallery-scale-inner");
      if (!inners.length) return false;

      const strength = width >= scroller.clientWidth * 0.95 ? 0.16 : 0.24;

      inners.forEach((inner) => {
        const card = inner.closest<HTMLElement>(".home-gallery-card");
        if (!card) return;

        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left - scrollerRect.left + cardRect.width / 2;
        const signedOffset = (cardCenter - viewportCenter) / Math.max(width, 1);
        const distanceFromFocus = Math.min(1.35, Math.abs(signedOffset));
        const easedDistance = Math.pow(distanceFromFocus, 1.1);
        const scale = 1 + easedDistance * strength;

        inner.style.transform = `scale3d(${scale}, ${scale}, 1)`;
      });

      return true;
    };

    const stopScaleLoop = () => {
      scaleLoopActiveRef.current = false;
      if (scaleRafRef.current != null) {
        window.cancelAnimationFrame(scaleRafRef.current);
        scaleRafRef.current = null;
      }
    };

    const scaleLoop = () => {
      if (!scaleLoopActiveRef.current) return;
      updateFocusScale();
      scaleRafRef.current = window.requestAnimationFrame(scaleLoop);
    };

    const startScaleLoop = () => {
      stopScaleLoop();
      scaleLoopActiveRef.current = true;
      scaleLoop();
    };

    const exactCardWidth = () => {
      const viewportWidth = scroller.clientWidth;
      if (!viewportWidth) return 0;
      return viewportWidth / getCardsPerView(scroller);
    };

    const singleSetWidth = () => exactCardWidth() * imageCount;

    const syncCardWidth = () => {
      const width = exactCardWidth();
      if (!width) return;

      scroller.style.setProperty("--home-gallery-card-width", `${width}px`);
    };

    const normalizeToMiddleSet = (value: number) => {
      const setWidth = singleSetWidth();
      if (!setWidth) return value;

      const min = setWidth;
      const max = setWidth * 2;
      let normalized = value;

      while (normalized < min) {
        normalized += setWidth;
      }

      while (normalized >= max) {
        normalized -= setWidth;
      }

      return normalized;
    };

    const syncLoopPosition = () => {
      const normalized = normalizeToMiddleSet(scroller.scrollLeft);
      if (Math.abs(normalized - scroller.scrollLeft) > 0.5) {
        scroller.scrollLeft = normalized;
      }
    };

    const setIdleState = (next: boolean) => {
      setIsIdle((prev) => (prev === next ? prev : next));
    };

    const startIdleTimer = () => {
      if (!canFadeRef.current) return;
      setIdleState(false);
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      idleTimeoutRef.current = window.setTimeout(() => {
        setIdleState(true);
      }, 2200);
    };

    const queueSnap = () => {
      if (!snapEnabled) return;
      // Avoid fighting the clip-path intro / idle fade gating (same window as startIdleTimer).
      if (!canFadeRef.current) return;
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      snapTimeoutRef.current = window.setTimeout(() => {
        if (!snapEnabled) return;
        if (!canFadeRef.current) return;

        const width = exactCardWidth();
        const setWidth = singleSetWidth();
        if (!width || !setWidth) return;

        const normalized = normalizeToMiddleSet(scroller.scrollLeft);
        const indexWithinSet = Math.round((normalized - setWidth) / width);
        const snappedIndex = clamp(indexWithinSet, 0, Math.max(imageCount - 1, 0));
        const target = setWidth + snappedIndex * width;

        if (Math.abs(scroller.scrollLeft - target) < 0.5) return;

        scroller.scrollTo({
          left: target,
          behavior: userDroveScroll ? "smooth" : "auto",
        });
      }, SNAP_DEBOUNCE_MS);
    };

    const resetIdleTimer = () => {
      syncLoopPosition();
      startIdleTimer();
      queueSnap();
    };

    const onWheel = (event: WheelEvent) => {
      userDroveScroll = true;
      const delta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      scroller.scrollLeft += delta;
      resetIdleTimer();
      scheduleFocusScaleUpdate();
    };

    let lastScrollLeft = scroller.scrollLeft;

    const markScrollGesture = () => {
      suppressImageClickRef.current = true;
      if (scrollClickUnlockRef.current) {
        window.clearTimeout(scrollClickUnlockRef.current);
      }
      scrollClickUnlockRef.current = window.setTimeout(() => {
        suppressImageClickRef.current = false;
        scrollClickUnlockRef.current = null;
      }, 140);
    };

    const onScroll = () => {
      const nextScrollLeft = scroller.scrollLeft;
      if (Math.abs(nextScrollLeft - lastScrollLeft) > 0.5) {
        markScrollGesture();
        lastScrollLeft = nextScrollLeft;
      }
      syncLoopPosition();
      updateFocusScale();
      scheduleFocusScaleUpdate();
      startIdleTimer();
      queueSnap();
    };

    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button[data-image-id]")) return;

      // Touch events: let the browser's native scroll handle it — capturing touch
      // pointers kills iOS/Android momentum scroll entirely.
      if (event.pointerType === "touch") {
        userDroveScroll = true;
        startIdleTimer();
        scheduleFocusScaleUpdate();
        return;
      }
      userDroveScroll = true;
      dragStateRef.current = {
        active: true,
        startX: event.clientX,
        startScrollLeft: scroller.scrollLeft,
      };
      scroller.setPointerCapture(event.pointerId);
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      startIdleTimer();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.active) return;

      const delta = event.clientX - dragStateRef.current.startX;
      scroller.scrollLeft = dragStateRef.current.startScrollLeft - delta;
      syncLoopPosition();
      scheduleFocusScaleUpdate();
      startIdleTimer();
    };

    const endDrag = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      resetIdleTimer();
    };

    const resetFromVisibility = () => {
      if (document.visibilityState === "visible") {
        setIdleState(false);
        initializeLoop();
        syncLoopPosition();
        startIdleTimer();
        scheduleFocusScaleUpdate();
      }
    };

    const initializeLoop = () => {
      scrollToLeadIndex(scroller, "auto");
    };

    const resetOnPageShow = () => {
      setIdleState(false);
      initializeLoop();
      syncLoopPosition();
      startIdleTimer();
      scheduleFocusScaleUpdate();
    };

    const scheduleFocusScaleUpdate = () => {
      updateFocusScale();
    };

    let setupAttempts = 0;
    const setupGallery = () => {
      if (!scroller.querySelector(".home-gallery-scale-inner")) {
        setupAttempts += 1;
        if (setupAttempts < 120) {
          window.requestAnimationFrame(setupGallery);
        }
        return;
      }

      resetFocusScales();
      syncCardWidth();
      initializeLoop();
      startScaleLoop();
    };

    setupGallery();

    // Second pass after paint: Firefox often updates scrollWidth/card widths after SPA remount.
    let settleRafOuter = 0;
    let settleRafInner = 0;
    settleRafOuter = requestAnimationFrame(() => {
      settleRafInner = requestAnimationFrame(() => {
        syncCardWidth();
        initializeLoop();
        syncLoopPosition();
        startScaleLoop();
      });
    });

    snapEnableTimeoutId = window.setTimeout(() => {
      snapEnabled = true;
    }, SNAP_ENABLE_DELAY_MS);

    if (animateIntro) {
      introTimeoutRef.current = window.setTimeout(() => {
        canFadeRef.current = true;
        startIdleTimer();
      }, INTRO_DELAY_MS + INTRO_DURATION_MS);
    } else {
      canFadeRef.current = true;
      startIdleTimer();
    }

    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);
    scroller.addEventListener("pointerleave", endDrag);
    document.addEventListener("visibilitychange", resetFromVisibility);
    window.addEventListener("pageshow", resetOnPageShow);
    const onResize = () => {
      const previousWidth = exactCardWidth();
      const previousSetWidth = singleSetWidth();
      const previousNormalized = normalizeToMiddleSet(scroller.scrollLeft);
      const previousIndex = previousWidth
        ? Math.round((previousNormalized - previousSetWidth) / previousWidth)
        : 0;

      syncCardWidth();

      const nextWidth = exactCardWidth();
      const nextSetWidth = singleSetWidth();
      if (nextWidth && nextSetWidth) {
        const cardsPerView = getCardsPerView(scroller);
        const maxLeadIndex = Math.max(imageCount - cardsPerView, 0);
        const clampedIndex = clamp(previousIndex, 0, maxLeadIndex);
        scroller.scrollLeft = nextSetWidth + clampedIndex * nextWidth;
      }

      scheduleFocusScaleUpdate();
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(snapEnableTimeoutId);
      cancelAnimationFrame(settleRafOuter);
      cancelAnimationFrame(settleRafInner);
      stopScaleLoop();
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
      }
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      if (scrollClickUnlockRef.current) {
        window.clearTimeout(scrollClickUnlockRef.current);
      }
      canFadeRef.current = false;
      if (!isHomeLeaveOutroRef.current) {
        resetFocusScales();
      }
      scroller.style.removeProperty("--home-gallery-card-width");
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", endDrag);
      scroller.removeEventListener("pointercancel", endDrag);
      scroller.removeEventListener("pointerleave", endDrag);
      document.removeEventListener("visibilitychange", resetFromVisibility);
      window.removeEventListener("pageshow", resetOnPageShow);
      window.removeEventListener("resize", onResize);
    };
  }, [animateIntro, getCardsPerView, imageCount, scrollToLeadIndex, totalCardCount, pathname]);

  useEffect(() => {
    // Reset idle state immediately when the route/gallery mode changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIdle(false);
    if (pathname !== "/") return;

    if (!animateIntro) {
      introCompleteRef.current = true;
      setIsIntroComplete(true);
      markHomeGalleryIntroDone();
    } else {
      introCompleteRef.current = false;
      introCommittedRef.current = false;
      setIsIntroComplete(false);
      markHomeGalleryIntroPending();
    }
    canFadeRef.current = false;

    resetToFirstImage("auto");

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const timeoutId = window.setTimeout(() => {
      resetToFirstImage("auto");
      canFadeRef.current = true;
      const scrollerEl = scrollerRef.current;
      if (scrollerEl) {
        scrollerEl.dispatchEvent(new Event("scroll"));
      }
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      idleTimeoutRef.current = window.setTimeout(() => {
        setIsIdle(true);
      }, 2200);
    }, animateIntro ? INTRO_DELAY_MS + INTRO_DURATION_MS : 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [animateIntro, pathname, resetToFirstImage]);

  useLayoutEffect(() => {
    if (pathname !== "/") {
      clearHomeGalleryOverImagery();
      clearHomeGalleryIntroPending();
      return;
    }

    if (!isIntroComplete) {
      clearHomeGalleryOverImagery();
      return;
    }

    setHomeGalleryOverImagery(!isIdle);

    return () => {
      clearHomeGalleryOverImagery();
    };
  }, [pathname, isIdle, isIntroComplete]);

  const isMobileViewport =
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX;
  const initialLeadIndex = isMobileViewport ? 1 : 0;
  const initialRevealCount = isMobileViewport ? 1 : 3;

  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      <div
        ref={scrollerRef}
        className={`home-gallery-scroller ${isIdle ? "home-gallery-is-idle" : ""} ${
          isGalleryClickable ? "home-gallery-interactive" : ""
        }`}
        suppressHydrationWarning
      >
        <div className="flex h-screen w-max">
          {galleryItems.map(({ image, imageIndex, copyIndex }) => {
            const isMiddleSet = copyIndex === 1;
            const isFirstVisible = isMiddleSet && imageIndex === initialLeadIndex;
            const isInitialVisible =
              isMiddleSet &&
              imageIndex >= initialLeadIndex &&
              imageIndex < initialLeadIndex + 3;
            const isNearInitial = isMiddleSet && imageIndex < initialLeadIndex + 5;
            const isIntroCard =
              isMiddleSet &&
              imageIndex >= initialLeadIndex &&
              imageIndex < initialLeadIndex + initialRevealCount;

            return (
              <button
                type="button"
                key={`${copyIndex}-${image.id}`}
                data-gallery-card={isIntroCard ? "initial" : "default"}
                data-home-gallery-copy={copyIndex}
                data-home-gallery-index={imageIndex}
                data-image-id={image.id}
                onPointerDown={(event) => handleCardPointerDown(image.id, event)}
                onPointerMove={(event) => handleCardPointerMove(image.id, event)}
                onPointerUp={(event) => handleCardPointerUp(image.id, event)}
                onPointerCancel={(event) => handleCardPointerCancel(image.id, event)}
                aria-disabled={!isGalleryClickable}
                tabIndex={isGalleryClickable ? 0 : -1}
                aria-label={`View ${lightboxDisplayName(image.name)} in archive`}
                className={`home-gallery-card relative shrink-0 border-0 bg-transparent p-0 text-left ${
                  isGalleryClickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="home-gallery-media">
                  <div className="home-gallery-scale-inner">
                    <Image
                      src={image.url}
                      alt=""
                      fill
                      quality={
                        isInitialVisible ? GALLERY_IMAGE_QUALITY : GALLERY_BACKGROUND_IMAGE_QUALITY
                      }
                      sizes="(max-width: 767px) 100vw, 33vw"
                      preload={isFirstVisible}
                      loading={isFirstVisible ? undefined : isNearInitial ? "eager" : "lazy"}
                      fetchPriority={
                        isFirstVisible ? undefined : isInitialVisible ? "high" : "low"
                      }
                      decoding="async"
                      draggable={false}
                      className="home-gallery-image pointer-events-none object-cover select-none"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
