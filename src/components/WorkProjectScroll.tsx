"use client";

import Image from "next/image";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { WorkProjectGallery } from "@/components/WorkProjectGallery";
import { COVER_IMAGE_QUALITY } from "@/lib/imageQuality";
import {
  getWorkCoverSrc,
  releaseWorkCoverAfterPaint,
} from "@/lib/workCoverImage";
import { clearWorkEntryCover } from "@/lib/workNavEvents";
import type { WorkProject } from "@/lib/works";
import { getOrderedProjects } from "@/lib/works";

const DESKTOP_EDGE_PX = 32;
const MOBILE_EDGE_PX = 52;
const DESKTOP_MAX_PULL_PX = 185;
const DESKTOP_PULL_START_PX = 36;
const MOBILE_MAX_PULL_PX = 124;
const MOBILE_PULL_START_PX = 12;
/** Touch pulls map finger travel → pull distance more generously on mobile. */
const MOBILE_TOUCH_PULL_GAIN = 1.7;
const MOBILE_MQ = "(max-width: 767px)";
const HOLD_AT_MAX_MS = 580;
const HOLD_AT_MAX_MOBILE_MS = 480;
const WHEEL_PULL_STEP = 0.38;
const WHEEL_IDLE_MS = 200;
/** Incomplete pull release — ease-out settle (ms scales with pull distance). */
const SNAP_BACK_MIN_MS = 380;
const SNAP_BACK_MAX_MS = 760;
const MOBILE_SNAP_BACK_MIN_MS = 560;
const MOBILE_SNAP_BACK_MAX_MS = 980;

function isMobilePullViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
}

function getMaxPullPx() {
  return isMobilePullViewport() ? MOBILE_MAX_PULL_PX : DESKTOP_MAX_PULL_PX;
}

function getPullStartPx() {
  return isMobilePullViewport() ? MOBILE_PULL_START_PX : DESKTOP_PULL_START_PX;
}

function getEdgePx() {
  return isMobilePullViewport() ? MOBILE_EDGE_PX : DESKTOP_EDGE_PX;
}

function getTouchPullGain() {
  return isMobilePullViewport() ? MOBILE_TOUCH_PULL_GAIN : 1;
}

function getHoldAtMaxMs() {
  return isMobilePullViewport() ? HOLD_AT_MAX_MOBILE_MS : HOLD_AT_MAX_MS;
}

function pullToProgress(px: number) {
  const start = getPullStartPx();
  const max = getMaxPullPx();
  if (px < start) return 0;
  return Math.min(1, (px - start) / (max - start));
}

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

function getSnapBackDurationMs(startPx: number) {
  const maxPull = getMaxPullPx();
  const min = isMobilePullViewport() ? MOBILE_SNAP_BACK_MIN_MS : SNAP_BACK_MIN_MS;
  const maxMs = isMobilePullViewport() ? MOBILE_SNAP_BACK_MAX_MS : SNAP_BACK_MAX_MS;
  if (!maxPull) return min;
  return min + (maxMs - min) * Math.min(1, startPx / maxPull);
}

function easeSnapBack(t: number) {
  if (isMobilePullViewport()) {
    return 1 - Math.pow(1 - t, 4);
  }
  return easeOutQuint(t);
}

type WorkProjectScrollProps = {
  project: WorkProject;
  projects: WorkProject[];
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  onAdvanceToNext: (
    fromSlug: string,
    toSlug: string,
    commit: () => void,
  ) => void;
  onInitialHeroReady?: () => void;
  /** Wait until parent has synced session flags before firing hero ready. */
  deferHeroReady?: boolean;
};

function getScrollEndOffset(root: HTMLElement, endEl: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  const endRect = endEl.getBoundingClientRect();
  return root.scrollTop + (endRect.bottom - rootRect.top);
}

export const WorkProjectScroll = memo(function WorkProjectScroll({
  project,
  projects,
  scrollRootRef,
  onAdvanceToNext,
  onInitialHeroReady,
  deferHeroReady = false,
}: WorkProjectScrollProps) {
  const heroEndRef = useRef<HTMLDivElement>(null);
  const lastImageRef = useRef<HTMLDivElement>(null);
  const maxScrollRef = useRef(0);
  const pullPxRef = useRef(0);
  const transitioningRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activeTouchCountRef = useRef(0);
  const wheelPullActiveRef = useRef(false);
  const wheelPullTimerRef = useRef<number | null>(null);
  const bottomArmedRef = useRef(false);
  const dragStartYRef = useRef<number | null>(null);
  const touchDragStartYRef = useRef<number | null>(null);
  const touchPullAtStartRef = useRef(0);
  const pullAtStartRef = useRef(0);
  const holdAtMaxTimerRef = useRef<number | null>(null);
  const holdFillRafRef = useRef<number | null>(null);
  const snapBackRafRef = useRef<number | null>(null);
  const initialHeroReadyRef = useRef(false);
  const onAdvanceToNextRef = useRef(onAdvanceToNext);
  const onInitialHeroReadyRef = useRef(onInitialHeroReady);
  const deferHeroReadyRef = useRef(deferHeroReady);

  /** Pull transform + clip are written straight to the DOM (no per-frame React
   *  re-render) so the gesture stays smooth on mobile. */
  const scrollInnerRef = useRef<HTMLDivElement>(null);
  const nextZoneRef = useRef<HTMLDivElement>(null);
  const labelFillRef = useRef<HTMLSpanElement>(null);
  const willChangeActiveRef = useRef(false);

  /** Hide the bridge thumbnail once the optimized hero image has painted. */
  const [heroLoaded, setHeroLoaded] = useState(false);

  onAdvanceToNextRef.current = onAdvanceToNext;
  onInitialHeroReadyRef.current = onInitialHeroReady;
  deferHeroReadyRef.current = deferHeroReady;

  const nextSlug = useMemo(() => {
    const ordered = getOrderedProjects(projects);
    if (ordered.length <= 1) return null;

    const index = ordered.findIndex((entry) => entry.slug === project.slug);
    if (index < 0) return null;

    return ordered[(index + 1) % ordered.length].slug;
  }, [project.slug, projects]);

  const getScrollEndElement = useCallback(() => {
    return lastImageRef.current ?? heroEndRef.current;
  }, []);

  const syncMaxScroll = useCallback(() => {
    if (pullPxRef.current > 0) return;

    const root = scrollRootRef.current;
    const end = getScrollEndElement();
    if (!root || !end) return;

    const scrollEnd = getScrollEndOffset(root, end);
    maxScrollRef.current = Math.max(0, scrollEnd - root.clientHeight);
  }, [getScrollEndElement, scrollRootRef]);

  const isAtBottom = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root) return false;
    return root.scrollTop >= maxScrollRef.current - getEdgePx();
  }, [scrollRootRef]);

  const updateBottomArmed = useCallback(() => {
    bottomArmedRef.current = isAtBottom();
  }, [isAtBottom]);

  const isGestureHolding = useCallback(() => {
    return (
      pointerActiveRef.current ||
      activeTouchCountRef.current > 0 ||
      wheelPullActiveRef.current
    );
  }, []);

  const cancelSnapBack = useCallback(() => {
    if (snapBackRafRef.current != null) {
      cancelAnimationFrame(snapBackRafRef.current);
      snapBackRafRef.current = null;
    }
  }, []);

  /** Cancel both the hold-to-advance timer and its fill animation. */
  const cancelHold = useCallback(() => {
    if (holdAtMaxTimerRef.current != null) {
      window.clearTimeout(holdAtMaxTimerRef.current);
      holdAtMaxTimerRef.current = null;
    }
    if (holdFillRafRef.current != null) {
      cancelAnimationFrame(holdFillRafRef.current);
      holdFillRafRef.current = null;
    }
  }, []);

  /** Set the label fill (clip wipe) — driven by the hold timer, not the pull. */
  const setFill = useCallback((progress: number) => {
    const fill = labelFillRef.current;
    if (fill) fill.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
  }, []);

  /** Write the pull transform + label reveal directly to the DOM. `will-change`
   *  is kept on for the whole gesture (incl. the snap-back settle) so the layer
   *  is never de-promoted mid-animation (which caused a recomposite flicker).
   *  Pass `fill` to also set the label fill; omit it to leave the fill alone
   *  (the hold-fill rAF owns it while holding at max). */
  const applyPull = useCallback(
    (px: number, fill?: number) => {
      const active = px > 0;
      const inner = scrollInnerRef.current;
      const zone = nextZoneRef.current;

      if (active !== willChangeActiveRef.current) {
        willChangeActiveRef.current = active;
        if (inner) inner.style.willChange = active ? "transform" : "";
        // The label is fixed and only fades in — promote opacity, not transform.
        if (zone) zone.style.willChange = active ? "opacity" : "";
      }

      // Only the scrolled content moves with the pull; the "NEXT PROJECT" label
      // stays fixed and is revealed (fades in) by the pull instead of sliding.
      if (inner) inner.style.transform = active ? `translate3d(0, -${px}px, 0)` : "";
      if (zone) {
        const start = getPullStartPx();
        zone.style.opacity = active
          ? String(Math.min(1, px / Math.max(1, start)))
          : "0";
      }
      if (fill !== undefined) setFill(fill);
    },
    [setFill],
  );

  const clearPullState = useCallback(() => {
    dragStartYRef.current = null;
    touchDragStartYRef.current = null;
    pullAtStartRef.current = 0;
    touchPullAtStartRef.current = 0;
    wheelPullActiveRef.current = false;
    if (wheelPullTimerRef.current != null) {
      window.clearTimeout(wheelPullTimerRef.current);
      wheelPullTimerRef.current = null;
    }
    cancelHold();
    pullPxRef.current = 0;
    applyPull(0, 0);

    const root = scrollRootRef.current;
    if (root) {
      delete root.dataset.workPullEngaged;
      root.style.touchAction = "";
    }
  }, [applyPull, cancelHold, scrollRootRef]);

  const resetPull = useCallback(() => {
    cancelSnapBack();
    clearPullState();
  }, [cancelSnapBack, clearPullState]);

  const animateSnapBack = useCallback(() => {
    cancelSnapBack();

    const startPx = pullPxRef.current;
    if (startPx <= 0) {
      clearPullState();
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      clearPullState();
      return;
    }

    // Stop any hold-to-advance fill; the label fades out via the zone opacity
    // as the content settles back (reset to empty in clearPullState).
    cancelHold();

    const root = scrollRootRef.current;
    if (root) {
      delete root.dataset.workPullEngaged;
      root.style.touchAction = nextSlug ? "pan-y" : "";
    }

    const duration = getSnapBackDurationMs(startPx);
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeSnapBack(t);
      const px = startPx * (1 - eased);

      pullPxRef.current = px;
      applyPull(px);

      if (t < 1) {
        snapBackRafRef.current = requestAnimationFrame(tick);
        return;
      }

      snapBackRafRef.current = null;
      clearPullState();
    };

    snapBackRafRef.current = requestAnimationFrame(tick);
  }, [applyPull, cancelHold, cancelSnapBack, clearPullState, nextSlug, scrollRootRef]);

  const lockPullAtMax = useCallback(() => {
    const maxPull = getMaxPullPx();
    dragStartYRef.current = null;
    touchDragStartYRef.current = null;
    pullAtStartRef.current = maxPull;
    touchPullAtStartRef.current = maxPull;
    wheelPullActiveRef.current = false;
    if (wheelPullTimerRef.current != null) {
      window.clearTimeout(wheelPullTimerRef.current);
      wheelPullTimerRef.current = null;
    }
    cancelHold();
    pullPxRef.current = maxPull;
    applyPull(maxPull, 1);
  }, [applyPull, cancelHold]);

  const completeAdvance = useCallback(() => {
    if (!nextSlug || transitioningRef.current) return;

    transitioningRef.current = true;
    pointerActiveRef.current = false;
    activePointerIdRef.current = null;
    lockPullAtMax();

    onAdvanceToNextRef.current(project.slug, nextSlug, () => {
      transitioningRef.current = false;
    });
  }, [lockPullAtMax, nextSlug, project.slug]);

  const scheduleHoldAtMaxAdvance = useCallback(() => {
    if (holdFillRafRef.current != null) return; // hold fill already running

    const holdMs = getHoldAtMaxMs();
    let lastFrame = performance.now();
    let heldMs = 0;

    // The fill accumulates ONLY time spent actively holding at max — it pauses
    // the instant the pull is released/idle, and advances once it fills.
    const tick = (now: number) => {
      holdFillRafRef.current = null;
      if (transitioningRef.current) return;
      if (!isGestureHolding() || pullPxRef.current < getMaxPullPx() - 0.5) {
        return;
      }

      heldMs += now - lastFrame;
      lastFrame = now;
      const p = Math.min(1, heldMs / holdMs);
      setFill(p);

      if (p >= 1) {
        completeAdvance();
        return;
      }
      holdFillRafRef.current = requestAnimationFrame(tick);
    };

    lastFrame = performance.now();
    holdFillRafRef.current = requestAnimationFrame(tick);
  }, [completeAdvance, isGestureHolding, setFill]);

  const setPull = useCallback(
    (px: number) => {
      if (transitioningRef.current) return;

      cancelSnapBack();

      const maxPull = getMaxPullPx();
      const pullStart = getPullStartPx();
      const next = Math.max(0, Math.min(maxPull, px));
      pullPxRef.current = next;

      const root = scrollRootRef.current;
      const holding = isGestureHolding();

      if (root) {
        if (next >= pullStart && holding) {
          root.dataset.workPullEngaged = "1";
          root.style.touchAction = "none";
        } else if (next <= 0) {
          delete root.dataset.workPullEngaged;
          root.style.touchAction = "";
        }
      }

      // Filling the label is driven by HOLDING at max, not by pull distance.
      const atMaxHold =
        holding && next >= pullStart && pullToProgress(next) >= 1;

      if (atMaxHold) {
        // Leave the fill to the hold rAF (omit the fill arg).
        applyPull(next);
        scheduleHoldAtMaxAdvance();
      } else {
        cancelHold();
        applyPull(next, 0);
      }
    },
    [
      applyPull,
      cancelHold,
      cancelSnapBack,
      isGestureHolding,
      scheduleHoldAtMaxAdvance,
      scrollRootRef,
    ],
  );

  const clampScroll = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root || transitioningRef.current) return;

    if (pullPxRef.current <= 0) {
      syncMaxScroll();
    }

    updateBottomArmed();

    if (pullPxRef.current > 0) {
      if (Math.abs(root.scrollTop - maxScrollRef.current) > 0.5) {
        root.scrollTop = maxScrollRef.current;
      }
      return;
    }

    const max = maxScrollRef.current;
    if (root.scrollTop > max + 0.5) {
      root.scrollTop = max;
    }
  }, [scrollRootRef, syncMaxScroll, updateBottomArmed]);

  const commitGestureEnd = useCallback(() => {
    if (transitioningRef.current) return;
    if (isGestureHolding()) return;

    pointerActiveRef.current = false;
    activePointerIdRef.current = null;
    dragStartYRef.current = null;
    touchDragStartYRef.current = null;

    const px = pullPxRef.current;
    if (px > 0 && pullToProgress(px) < 1) {
      animateSnapBack();
      return;
    }

    resetPull();
  }, [animateSnapBack, isGestureHolding, resetPull]);

  const beginPullGesture = useCallback(
    (clientY: number, pointerId: number) => {
      if (pointerActiveRef.current && activePointerIdRef.current === pointerId) {
        return;
      }

      pointerActiveRef.current = true;
      activePointerIdRef.current = pointerId;
      dragStartYRef.current = clientY;
      pullAtStartRef.current = pullPxRef.current;

      const root = scrollRootRef.current;
      if (root && !root.hasPointerCapture(pointerId)) {
        root.setPointerCapture(pointerId);
      }
    },
    [scrollRootRef],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!nextSlug || transitioningRef.current) return;
      if (event.pointerType === "touch") return;
      if (event.button !== 0) return;

      syncMaxScroll();
      updateBottomArmed();
      if (!bottomArmedRef.current) return;

      event.preventDefault();
      beginPullGesture(event.clientY, event.pointerId);
    },
    [beginPullGesture, nextSlug, syncMaxScroll, updateBottomArmed],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (transitioningRef.current || !nextSlug) return;
      if (event.pointerType === "touch") return;

      if (!pointerActiveRef.current) {
        syncMaxScroll();
        updateBottomArmed();
        if (!bottomArmedRef.current || event.buttons === 0) return;

        event.preventDefault();
        beginPullGesture(event.clientY, event.pointerId);
      }

      if (
        !pointerActiveRef.current ||
        dragStartYRef.current == null ||
        activePointerIdRef.current !== event.pointerId
      ) {
        return;
      }

      const delta = dragStartYRef.current - event.clientY;
      if (delta <= 0 && pullPxRef.current <= 0) return;

      event.preventDefault();
      setPull(pullAtStartRef.current + delta);

      const root = scrollRootRef.current;
      if (root) {
        root.scrollTop = maxScrollRef.current;
        root.style.touchAction = "none";
      }
    },
    [beginPullGesture, nextSlug, scrollRootRef, setPull, syncMaxScroll, updateBottomArmed],
  );

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!nextSlug || transitioningRef.current || event.touches.length !== 1) return;

      syncMaxScroll();
      updateBottomArmed();
      if (!bottomArmedRef.current) return;

      touchDragStartYRef.current = event.touches[0]!.clientY;
      touchPullAtStartRef.current = pullPxRef.current;
      activeTouchCountRef.current = event.touches.length;
    },
    [nextSlug, syncMaxScroll, updateBottomArmed],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!nextSlug || transitioningRef.current || event.touches.length !== 1) return;

      const touch = event.touches[0]!;

      if (touchDragStartYRef.current == null) {
        syncMaxScroll();
        updateBottomArmed();
        if (!bottomArmedRef.current) return;

        touchDragStartYRef.current = touch.clientY;
        touchPullAtStartRef.current = pullPxRef.current;
      }

      const delta =
        (touchDragStartYRef.current - touch.clientY) * getTouchPullGain();
      if (delta <= 0 && pullPxRef.current <= 0) return;

      event.preventDefault();
      pointerActiveRef.current = true;
      setPull(touchPullAtStartRef.current + delta);

      const root = scrollRootRef.current;
      if (root) {
        root.scrollTop = maxScrollRef.current;
        root.style.touchAction = "none";
      }
    },
    [nextSlug, scrollRootRef, setPull, syncMaxScroll, updateBottomArmed],
  );

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      activeTouchCountRef.current = event.touches.length;
      touchDragStartYRef.current = null;

      if (event.touches.length > 0) return;
      if (pullPxRef.current < getPullStartPx()) return;

      pointerActiveRef.current = false;
      activePointerIdRef.current = null;
      dragStartYRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(commitGestureEnd);
      });
    },
    [commitGestureEnd],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;

      const root = scrollRootRef.current;
      if (root?.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId);
      }

      if (pullPxRef.current >= getPullStartPx()) {
        pointerActiveRef.current = false;
        activePointerIdRef.current = null;
        dragStartYRef.current = null;
        requestAnimationFrame(() => {
          requestAnimationFrame(commitGestureEnd);
        });
        return;
      }

      pointerActiveRef.current = false;
      activePointerIdRef.current = null;
      dragStartYRef.current = null;
      commitGestureEnd();
    },
    [commitGestureEnd, scrollRootRef],
  );

  const onPointerCancel = useCallback((event: PointerEvent) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    if (pullPxRef.current >= getPullStartPx() || activeTouchCountRef.current > 0) return;

    pointerActiveRef.current = false;
    activePointerIdRef.current = null;
    dragStartYRef.current = null;
  }, []);

  const onLostPointerCapture = useCallback(
    (event: PointerEvent) => {
      if (
        pullPxRef.current < getPullStartPx() ||
        activePointerIdRef.current !== event.pointerId
      ) {
        return;
      }

      if (isGestureHolding()) {
        scrollRootRef.current?.setPointerCapture(event.pointerId);
      }
    },
    [isGestureHolding, scrollRootRef],
  );

  const onWheel = useCallback(
    (event: WheelEvent) => {
      if (!nextSlug || transitioningRef.current) return;

      syncMaxScroll();
      updateBottomArmed();
      if (!bottomArmedRef.current || event.deltaY <= 0) return;

      event.preventDefault();
      wheelPullActiveRef.current = true;
      setPull(pullPxRef.current + event.deltaY * WHEEL_PULL_STEP);

      const root = scrollRootRef.current;
      if (root) root.scrollTop = maxScrollRef.current;

      if (wheelPullTimerRef.current != null) {
        window.clearTimeout(wheelPullTimerRef.current);
      }
      const idleMs =
        pullPxRef.current >= getMaxPullPx() - 0.5
          ? getHoldAtMaxMs() + WHEEL_IDLE_MS
          : WHEEL_IDLE_MS;
      wheelPullTimerRef.current = window.setTimeout(() => {
        wheelPullActiveRef.current = false;
        wheelPullTimerRef.current = null;
        if (!transitioningRef.current) {
          commitGestureEnd();
        }
      }, idleMs);
    },
    [commitGestureEnd, nextSlug, scrollRootRef, setPull, syncMaxScroll, updateBottomArmed],
  );

  const tryInitialHeroReady = useCallback(() => {
    if (initialHeroReadyRef.current || deferHeroReadyRef.current) return;
    initialHeroReadyRef.current = true;
    onInitialHeroReadyRef.current?.();
  }, []);

  const handleHeroLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      tryInitialHeroReady();

      void releaseWorkCoverAfterPaint(event.currentTarget).then(() => {
        setHeroLoaded(true);
        clearWorkEntryCover();
      });
    },
    [tryInitialHeroReady],
  );

  const handleImageLayout = useCallback(() => {
    if (pullPxRef.current > 0) return;
    syncMaxScroll();
    clampScroll();
  }, [clampScroll, syncMaxScroll]);

  // Cancel the hold timer + fill rAF if the project unmounts mid-gesture.
  useEffect(() => cancelHold, [cancelHold]);

  useLayoutEffect(() => {
    initialHeroReadyRef.current = false;
    setHeroLoaded(false);
    resetPull();
    transitioningRef.current = false;

    const root = scrollRootRef.current;
    if (root) root.scrollTop = 0;

    syncMaxScroll();
    updateBottomArmed();
    requestAnimationFrame(() => {
      syncMaxScroll();
      updateBottomArmed();
    });
  }, [
    project.slug,
    resetPull,
    scrollRootRef,
    syncMaxScroll,
    updateBottomArmed,
  ]);

  useLayoutEffect(() => {
    if (initialHeroReadyRef.current) return;

    const probe = new window.Image();
    probe.src = project.thumbnailUrl;
    if (probe.complete) {
      tryInitialHeroReady();
    }
  }, [project.slug, project.thumbnailUrl, tryInitialHeroReady]);

  useLayoutEffect(() => {
    if (!deferHeroReady) {
      tryInitialHeroReady();
    }
  }, [deferHeroReady, tryInitialHeroReady]);

  useEffect(() => {
    const syncTouches = (event: TouchEvent) => {
      activeTouchCountRef.current = event.touches.length;
    };

    window.addEventListener("touchstart", syncTouches, { passive: true });
    window.addEventListener("touchmove", syncTouches, { passive: true });

    return () => {
      window.removeEventListener("touchstart", syncTouches);
      window.removeEventListener("touchmove", syncTouches);
    };
  }, []);

  useEffect(() => {
    const onWindowPointerUp = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      onPointerUp(event);
    };

    const onWindowPointerCancel = (event: PointerEvent) => {
      onPointerCancel(event);
    };

    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);

    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
    };
  }, [onPointerCancel, onPointerUp]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const ro = new ResizeObserver(() => {
      if (pullPxRef.current > 0) return;
      syncMaxScroll();
      clampScroll();
    });

    ro.observe(root);
    const end = getScrollEndElement();
    if (end) ro.observe(end);

    root.addEventListener("scroll", clampScroll, { passive: true });
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerCancel);
    root.addEventListener("lostpointercapture", onLostPointerCapture);
    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    if (nextSlug) {
      root.dataset.workPullReady = "1";
      root.style.touchAction = "pan-y";
    } else {
      delete root.dataset.workPullReady;
      root.style.touchAction = "";
    }

    return () => {
      ro.disconnect();
      root.removeEventListener("scroll", clampScroll);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
      root.removeEventListener("lostpointercapture", onLostPointerCapture);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      delete root.dataset.workPullReady;
      root.style.touchAction = "";

      if (wheelPullTimerRef.current != null) {
        window.clearTimeout(wheelPullTimerRef.current);
        wheelPullTimerRef.current = null;
      }
      cancelSnapBack();
    };
  }, [
    clampScroll,
    cancelSnapBack,
    getScrollEndElement,
    onLostPointerCapture,
    onPointerCancel,
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
    onWheel,
    project.slug,
    nextSlug,
    scrollRootRef,
    syncMaxScroll,
  ]);

  useEffect(() => {
    const end = getScrollEndElement();
    if (!end) return;

    const ro = new ResizeObserver(handleImageLayout);
    ro.observe(end);
    return () => ro.disconnect();
  }, [getScrollEndElement, handleImageLayout, project.slug]);

  const coverSrc = useMemo(
    () => getWorkCoverSrc(project.thumbnailUrl),
    [project.thumbnailUrl],
  );

  return (
    <div className="work-project-scroll relative z-10 w-full">
      <div ref={scrollInnerRef} className="work-project-scroll-inner">
        <section
          data-work-project={project.slug}
          className="work-project-section w-full"
        >
          <div
            ref={heroEndRef}
            className="work-project-hero relative h-[100dvh] w-full shrink-0"
          >
            {!heroLoaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverSrc}
                alt=""
                aria-hidden
                draggable={false}
                decoding="sync"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : null}
            <Image
              src={project.thumbnailUrl}
              alt=""
              fill
              quality={COVER_IMAGE_QUALITY}
              sizes="100vw"
              priority
              className="object-cover object-center"
              draggable={false}
              onLoad={handleHeroLoad}
            />
          </div>

          <WorkProjectGallery
            project={project}
            lastImageRef={lastImageRef}
            onImageLayout={handleImageLayout}
          />
        </section>
      </div>

      {nextSlug ? (
        <div
          ref={nextZoneRef}
          className="work-next-project-zone pointer-events-none fixed inset-x-0 bottom-0 z-20 flex min-h-[min(28dvh,10rem)] items-center justify-center pb-[max(2.5%,env(safe-area-inset-bottom))]"
        >
          <div className="work-chrome-difference">
            <p className="work-next-project-label site-chrome-text relative m-0 uppercase leading-none tracking-[0.14em]">
              <span className="work-next-project-label-base" aria-hidden>
                next project
              </span>
              <span
                ref={labelFillRef}
                className="work-next-project-label-fill"
                style={{ clipPath: "inset(0 100% 0 0)" }}
              >
                next project
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
});
