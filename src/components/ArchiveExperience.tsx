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
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { gsap } from "gsap";

import type { AssetImage } from "@/lib/assets";
import {
  ARCHIVE_LIGHTBOX_IMAGE_QUERY,
  consumeArchiveLightboxNavFromHome,
  findArchiveImageIndex,
  shouldSkipArchiveEnterAnimations,
} from "@/lib/archiveLightboxLink";
import {
  clearDeferChromeReveal,
  getNavChromeTargets,
  hideSiteChrome,
  liftDeferChromeCssLock,
  restoreSiteChromeVisibility,
} from "@/lib/siteChrome";
import {
  clearArchiveChromeBright,
  syncArchiveChromeBright,
} from "@/lib/archiveChrome";
import {
  clearArchiveLightboxOpen,
  setArchiveLightboxOpen,
} from "@/lib/archiveLightboxChrome";
import { LightboxCrossfadeImage } from "@/components/LightboxCrossfadeImage";
import { LightboxSlotFilename } from "@/components/LightboxSlotFilename";
import { lightboxDisplayName } from "@/lib/lightboxLabel";
import { ARCHIVE_LEAVE_OUTRO_EVENT } from "@/components/PageTransitionProvider";

const BUFFER_ROWS = 2;
/** Rows visible in the archive scroller — must match `--archive-visible-rows` in globals.css */
const ARCHIVE_VISIBLE_ROWS = 3;
/** Grid gap — must match `--archive-grid-gap` / `.archive-grid { gap }` */
const GRID_GAP = 1;
/** Per-column scroll chase — lower = more lag (wave). */
const WAVE_COL_SMOOTH_STEP = 0.028;
const WAVE_SMOOTH_BASE = 0.2;
const WAVE_SMOOTH_MIN = 0.05;
const WAVE_SETTLE_PX = 0.35;
/** Stable viewport for SSR + first client paint — real metrics applied in layout effects only */
const ARCHIVE_LAYOUT_SNAPSHOT_VH = 800;

/** Row track height so `ARCHIVE_VISIBLE_ROWS` rows + gaps fill the scroller exactly. */
function archiveRowHeightPx(
  viewportH: number,
  visibleRows = ARCHIVE_VISIBLE_ROWS,
): number {
  if (viewportH <= 0 || visibleRows <= 0) return 0;
  return (viewportH - (visibleRows - 1) * GRID_GAP) / visibleRows;
}

function archiveCellWidth(gridWidth: number, cols: number): number {
  if (gridWidth <= 0 || cols <= 0) return 0;
  return (gridWidth - Math.max(0, cols - 1) * GRID_GAP) / cols;
}

function archiveColFromX(x: number, gridWidth: number, cols: number): number {
  const cellW = archiveCellWidth(gridWidth, cols);
  if (cellW <= 0) return 0;
  for (let c = 0; c < cols; c++) {
    const left = c * (cellW + GRID_GAP);
    if (x >= left && x < left + cellW) return c;
  }
  return Math.min(cols - 1, Math.max(0, cols - 1));
}

function columnWaveSmoothFactor(col: number): number {
  return Math.max(WAVE_SMOOTH_MIN, WAVE_SMOOTH_BASE - col * WAVE_COL_SMOOTH_STEP);
}

function chaseColumnWaveScroll(
  scrollTop: number,
  colCount: number,
  colY: number[],
): boolean {
  let animating = false;
  for (let c = 0; c < colCount; c++) {
    const prev = colY[c] ?? scrollTop;
    const next = prev + (scrollTop - prev) * columnWaveSmoothFactor(c);
    colY[c] = next;
    if (Math.abs(scrollTop - next) > WAVE_SETTLE_PX) animating = true;
  }
  return animating;
}

function columnWaveOffsets(scrollTop: number, colY: number[]): number[] {
  return colY.map((y) => scrollTop - y);
}

/** Archive -> lightbox transition timings. */
const ARCHIVE_LIGHTBOX_CLIP_S = 0.52;
const ARCHIVE_LIGHTBOX_FADE_S = 0.3;
const ARCHIVE_LIGHTBOX_CHROME_FADE_S = 0.28;
const ARCHIVE_LIGHTBOX_CLOSE_FADE_S = 0.22;
const ARCHIVE_LIGHTBOX_IMAGE_CLIP = "inset(0% 0% 100% 0%)";
const ARCHIVE_LANDING_CLIP_S = 0.4;
const ARCHIVE_LANDING_CLIP_STAGGER_EACH = 0.03;
const ARCHIVE_LIGHTBOX_IMAGE_QUALITY = 80;
const ARCHIVE_GRID_IMAGE_QUALITY = 40;
const LIGHTBOX_WHEEL_STEP_PX = 48;

/**
 * Map pointer coords to a gallery index without `elementFromPoint` (Chrome forces layout
 * on every call; geometry + bounding rect is cheaper and matches the painted grid box).
 * rowPitch = rh + GRID_GAP (distance between consecutive row tops in scroll space).
 */
function hitTestArchiveGrid(
  clientX: number,
  clientY: number,
  gridRect: DOMRectReadOnly,
  params: {
    cols: number;
    rowCount: number;
    rowPitch: number;
    rMin: number;
    rMax: number;
    imagesLength: number;
    waveOffsets?: number[];
  },
): number | null {
  const { cols, rowCount, rowPitch, rMin, rMax, imagesLength, waveOffsets } = params;
  const x = clientX - gridRect.left;
  const y = clientY - gridRect.top;
  const w = gridRect.width;
  const h = gridRect.height;
  if (x < 0 || y < 0 || x >= w || y >= h || w <= 0 || h <= 0) return null;

  const rowsInStrip = rMax - rMin + 1;
  if (rowsInStrip <= 0 || cols <= 0 || !rowPitch) return null;

  const col = archiveColFromX(x, w, cols);
  const waveY = waveOffsets?.[col] ?? 0;
  const rowOffset = Math.min(
    rowsInStrip - 1,
    Math.max(0, Math.floor((y - waveY) / rowPitch)),
  );

  const gr = rMin + rowOffset;
  const dataRow = mod(gr, rowCount);
  const idx = dataRow * cols + col;
  if (idx < 0 || idx >= imagesLength) return null;
  return idx;
}

/**
 * Virtual row window for the infinite grid; kept pure for scroll coalescing.
 * rowPitch = rh + GRID_GAP — the distance between consecutive row tops.
 */
function computeWindow(
  scrollTop: number,
  rowPitch: number,
  viewportH: number,
  maxGlobalRow: number,
): { rMin: number; rMax: number } {
  if (!rowPitch) return { rMin: 0, rMax: 0 };
  const vh = viewportH > 0 ? viewportH : ARCHIVE_LAYOUT_SNAPSHOT_VH;
  const rPixelTop = scrollTop;
  const rPixelBottom = scrollTop + vh;
  let r0 = Math.floor(rPixelTop / rowPitch) - BUFFER_ROWS;
  let r1 = Math.ceil(rPixelBottom / rowPitch - 1e-9) + BUFFER_ROWS;
  r0 = Math.max(0, r0);
  r1 = Math.min(maxGlobalRow, r1);
  if (r1 < r0) r1 = r0;
  return { rMin: r0, rMax: r1 };
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

type ArchiveGridCellProps = {
  imageId: string;
  imageName: string;
  imageUrl: string;
  imageIdx: number;
  localRow: number;
  col: number;
  eager: boolean;
  preload: boolean;
  fetchPriority: "high" | "low" | "auto";
};

const ArchiveGridCell = memo(function ArchiveGridCell({
  imageId,
  imageName,
  imageUrl,
  imageIdx,
  localRow,
  col,
  eager,
  preload,
  fetchPriority,
}: ArchiveGridCellProps) {
  return (
    <button
      type="button"
      data-image-id={imageId}
      data-image-idx={imageIdx}
      data-archive-col={col}
      className="archive-grid-card"
      style={{
        gridRow: localRow,
        gridColumn: col + 1,
        contain: "layout paint style",
      }}
    >
      <div className="archive-grid-image">
        <Image
          src={imageUrl}
          alt={imageName}
          fill
          quality={ARCHIVE_GRID_IMAGE_QUALITY}
          sizes="(max-width: 767px) 50vw, (max-width: 1400px) 16vw, 200px"
          preload={preload}
          loading={preload ? undefined : eager ? "eager" : "lazy"}
          fetchPriority={preload ? undefined : fetchPriority}
          decoding="async"
          className="object-cover"
        />
      </div>
    </button>
  );
});

const ArchiveLightbox = memo(function ArchiveLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: AssetImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number } | null>(null);
  const wheelAccumRef = useRef(0);

  const goNext = useCallback(() => {
    setNavDirection(1);
    setActiveIndex((current) => (current + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setNavDirection(-1);
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  }, [images.length]);

  const requestClose = useCallback(() => {
    const btn = closeBtnRef.current;
    if (!btn || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }

    gsap.killTweensOf(btn);
    gsap.to(btn, {
      autoAlpha: 0,
      duration: ARCHIVE_LIGHTBOX_CLOSE_FADE_S,
      ease: "power1.inOut",
      onComplete: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || images.length < 2) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;

      wheelAccumRef.current += delta;
      if (Math.abs(wheelAccumRef.current) < LIGHTBOX_WHEEL_STEP_PX) return;

      if (wheelAccumRef.current > 0) goNext();
      else goPrev();
      wheelAccumRef.current = 0;
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [goNext, goPrev, images.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, requestClose]);

  const handleSwipeDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      swipeRef.current = { x: e.clientX };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleSwipeUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const start = swipeRef.current;
      swipeRef.current = null;
      if (!start) return;
      const delta = e.clientX - start.x;
      if (Math.abs(delta) < 48) return;
      if (delta < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  const handleSwipeCancel = useCallback(() => {
    swipeRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const btn = closeBtnRef.current;
    if (!btn) return;
    gsap.set(btn, { autoAlpha: 1 });
  }, []);

  const activeImage = images[activeIndex];
  const activeLabel = activeImage ? lightboxDisplayName(activeImage.name) : "";

  return (
    <div className="relative h-full min-h-0 w-full bg-background max-md:h-[100dvh]">
      <button
        ref={closeBtnRef}
        type="button"
        onClick={requestClose}
        aria-label="Close lightbox"
        className="archive-lightbox-close fixed right-[max(2vw,env(safe-area-inset-right))] top-[max(2.5%,env(safe-area-inset-top))] z-[60] font-semibold uppercase leading-none tracking-[0.14em] text-foreground hover:text-foreground"
      >
        CLOSE
      </button>

      {/* Same vertical band as site header (`siteWideGrid` + `items-center` at 50vh) */}
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-between pl-[max(2vw,env(safe-area-inset-left))] pr-[max(2vw,env(safe-area-inset-right))] max-md:pl-[max(3vw,env(safe-area-inset-left))] max-md:pr-[max(3vw,env(safe-area-inset-right))]">
        <button
          type="button"
          onClick={goPrev}
          className="archive-lightbox-prev pointer-events-auto shrink-0 font-semibold uppercase leading-none tracking-[0.14em] text-foreground hover:text-foreground"
        >
          PREV
        </button>
        <button
          type="button"
          onClick={goNext}
          className="archive-lightbox-next pointer-events-auto shrink-0 font-semibold uppercase leading-none tracking-[0.14em] text-foreground hover:text-foreground"
        >
          NEXT
        </button>
      </div>

      {activeLabel ? (
        <LightboxSlotFilename targetLabel={activeLabel} />
      ) : null}

      <div
        ref={viewportRef}
        className="relative h-full w-full overflow-hidden"
        onPointerDown={handleSwipeDown}
        onPointerUp={handleSwipeUp}
        onPointerCancel={handleSwipeCancel}
        style={{ touchAction: "none" }}
      >
        {images.length > 0 ? (
          <LightboxCrossfadeImage
            images={images}
            index={activeIndex}
            direction={navDirection}
            quality={ARCHIVE_LIGHTBOX_IMAGE_QUALITY}
          />
        ) : null}
      </div>
    </div>
  );
});

export function ArchiveExperience({ images }: { images: AssetImage[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingImageId = searchParams.get(ARCHIVE_LIGHTBOX_IMAGE_QUERY);
  const initialDeepLinkIndex = useMemo(
    () => (pendingImageId ? findArchiveImageIndex(images, pendingImageId) : null),
    [images, pendingImageId],
  );

  const [reduceMotion, setReduceMotion] = useState(false);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(initialDeepLinkIndex);
  const [cols, setCols] = useState(6);
  /** Column-wave is disabled on mobile so native momentum scroll stays smooth. */
  const waveDisabledRef = useRef(false);
  const [rowHeight, setRowHeight] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Grid + scroller — faded out while the lightbox is open. */
  const archiveMainLayerRef = useRef<HTMLDivElement>(null);
  const lightboxLayerRef = useRef<HTMLDivElement>(null);
  const archiveImageClipsRef = useRef<HTMLElement[]>([]);
  const lightboxTransitionTlRef = useRef<gsap.core.Timeline | null>(null);
  const archiveNavLeaveTlRef = useRef<gsap.core.Timeline | null>(null);
  const lightboxIndexRef = useRef<number | null>(null);
  const gridRootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef(0);
  const introCtxRef = useRef<ReturnType<typeof gsap.context> | null>(null);
  const scrollFrameRef = useRef(0);
  const pointerMoveRafRef = useRef(0);
  const pendingPointerMoveRef = useRef<{ x: number; y: number } | null>(null);
  const colWaveYRef = useRef<number[]>([]);
  const waveOffsetsRef = useRef<number[]>([]);
  const waveCardsByColRef = useRef<HTMLElement[][]>([]);
  const lastAppliedWaveOffsetsRef = useRef<number[]>([]);

  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerInsideRef = useRef(false);
  /** Hover dim + bright tracking — desktop fine pointer only. */
  const archiveHoverDimEnabledRef = useRef(false);
  const brightElRef = useRef<HTMLElement | null>(null);
  /** True only after landing intro finishes — enables dim/hover and cell interaction. */
  const archiveInteractiveReadyRef = useRef(initialDeepLinkIndex !== null);
  /** Clears scroll lock + `inert` from landing; set when landing starts, cleared when interaction unlocks or on cleanup. */
  const archiveLandingCleanupRef = useRef<(() => void) | null>(null);
  const skipLandingForDeepLinkRef = useRef(initialDeepLinkIndex !== null);
  /** Persists for the whole lightbox session — cleared only when the lightbox closes. */
  const lightboxOpenedFromHomeRef = useRef(
    typeof window !== "undefined" && shouldSkipArchiveEnterAnimations(),
  );
  const deepLinkHandledRef = useRef(false);
  const lastVirtualWindowRef = useRef<{ rMin: number; rMax: number }>({
    rMin: -1,
    rMax: -1,
  });
  const layoutMetricsRef = useRef({ rowPitch: 1, vh: 800, maxGlobalRow: 0 });
  const imagesRef = useRef(images);
  const archiveLayoutRef = useRef({
    rowPitch: 1,
    cols: 6,
    rowCount: 1,
    rMin: 0,
    rMax: 0,
    waveOffsets: [] as number[],
  });

  const layoutKey = `${images.length}-${cols}`;

  useLayoutEffect(() => {
    const imageId = searchParams.get(ARCHIVE_LIGHTBOX_IMAGE_QUERY);
    if (!imageId || deepLinkHandledRef.current) return;

    const idx = findArchiveImageIndex(images, imageId);
    if (idx === null) {
      consumeArchiveLightboxNavFromHome();
      return;
    }

    deepLinkHandledRef.current = true;
    skipLandingForDeepLinkRef.current = true;
    if (consumeArchiveLightboxNavFromHome()) {
      lightboxOpenedFromHomeRef.current = true;
    }
    hideSiteChrome();
    archiveInteractiveReadyRef.current = true;
    archiveLandingCleanupRef.current?.();
    gridRootRef.current?.setAttribute("data-archive-interactive", "1");
    gridRootRef.current?.removeAttribute("data-archive-dim");
    scrollerRef.current?.removeAttribute("data-archive-landing");
    gridRef.current?.removeAttribute("data-archive-intro");
    introCtxRef.current?.revert();
    introCtxRef.current = null;
    if (archiveMainLayerRef.current) {
      archiveMainLayerRef.current.style.removeProperty("visibility");
      gsap.set(archiveMainLayerRef.current, { autoAlpha: 0 });
    }
    if (lightboxIndex !== idx) {
      setLightboxIndex(idx);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete(ARCHIVE_LIGHTBOX_IMAGE_QUERY);
    const nextPath = `${url.pathname}${url.search}`;
    router.replace(nextPath, { scroll: false });
  }, [images, router, searchParams]);

  useLayoutEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      archiveHoverDimEnabledRef.current = mq.matches;
      if (!mq.matches) {
        gridRootRef.current?.removeAttribute("data-archive-dim");
        brightElRef.current?.removeAttribute("data-archive-bright");
        brightElRef.current = null;
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const syncCols = () => {
      waveDisabledRef.current = mq.matches;
      setCols(mq.matches ? 2 : 6);
    };
    syncCols();
    mq.addEventListener("change", syncCols);
    return () => mq.removeEventListener("change", syncCols);
  }, []);

  useLayoutEffect(() => {
    const root = gridRootRef.current;
    if (!root) return;

    const sync = () => syncArchiveChromeBright(root);
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-archive-dim", "data-archive-interactive"],
    });

    return () => {
      observer.disconnect();
      clearArchiveChromeBright();
    };
  }, [layoutKey]);

  const rowCount = useMemo(
    () => Math.max(1, Math.ceil(images.length / cols)),
    [images.length, cols],
  );

  const measureArchiveLayout = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const vh = scroller.clientHeight;
    if (vh <= 0) return;
    setViewportH(vh);
    setRowHeight(archiveRowHeightPx(vh));
  }, []);

  useLayoutEffect(() => {
    measureArchiveLayout();
  }, [cols, measureArchiveLayout]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    measureArchiveLayout();
    const ro = new ResizeObserver(() => {
      measureArchiveLayout();
    });
    ro.observe(scroller);
    window.addEventListener("resize", measureArchiveLayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureArchiveLayout);
    };
  }, [measureArchiveLayout]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
      if (pointerMoveRafRef.current) cancelAnimationFrame(pointerMoveRafRef.current);
      lightboxTransitionTlRef.current?.kill();
      // Ensure no stale ref to an unmounted element
      brightElRef.current = null;
    };
  }, []);

  const snapshotRh = archiveRowHeightPx(ARCHIVE_LAYOUT_SNAPSHOT_VH);
  const rh = rowHeight > 0 ? rowHeight : snapshotRh;
  // rowPitch = card height + gap — the scroll distance between consecutive row tops
  const rowPitch = rh + GRID_GAP;
  const period = rowCount * rowPitch;
  const totalVirtualHeight = period * 3;
  const maxGlobalRow = rowCount * 3 - 1;

  useLayoutEffect(() => {
    periodRef.current = period;
  }, [period]);

  const applyBrightFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const grid = gridRef.current;
    if (
      !grid ||
      !pointerInsideRef.current ||
      !archiveInteractiveReadyRef.current ||
      !archiveHoverDimEnabledRef.current
    ) {
      return;
    }
    const rect = grid.getBoundingClientRect();
    const { cols, rowCount, rowPitch: rp, rMin, rMax } = archiveLayoutRef.current;
    const list = imagesRef.current;
    const idx = hitTestArchiveGrid(clientX, clientY, rect, {
      cols,
      rowCount,
      rowPitch: rp,
      rMin,
      rMax,
      imagesLength: list.length,
      waveOffsets: archiveLayoutRef.current.waveOffsets,
    });

    const nextId = idx !== null ? (list[idx]?.id ?? null) : null;
    const prevEl = brightElRef.current;

    if (nextId === null) {
      if (prevEl) {
        prevEl.removeAttribute("data-archive-bright");
        brightElRef.current = null;
      }
      return;
    }

    // querySelector is O(n) over visible cells (~30-70 nodes) — far cheaper than
    // a React re-render + full cells-memo pass over the same set.
    const nextEl = grid.querySelector<HTMLElement>(`button[data-image-id="${nextId}"]`);
    if (nextEl === prevEl) return;
    if (prevEl) prevEl.removeAttribute("data-archive-bright");
    if (nextEl) {
      nextEl.setAttribute("data-archive-bright", "1");
      brightElRef.current = nextEl;
    } else {
      brightElRef.current = null;
    }
  }, []);

  const retargetHoverFromLastPointer = useCallback(() => {
    const p = lastPointerRef.current;
    if (!p || !pointerInsideRef.current) return;
    applyBrightFromClientPoint(p.x, p.y);
  }, [applyBrightFromClientPoint]);

  const handleRootPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointerInsideRef.current = true;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (!archiveInteractiveReadyRef.current) return;
      if (!archiveHoverDimEnabledRef.current) return;
      gridRootRef.current?.setAttribute("data-archive-dim", "1");
      applyBrightFromClientPoint(event.clientX, event.clientY);
    },
    [applyBrightFromClientPoint],
  );

  const handleRootPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (!pointerInsideRef.current) return;
      if (!archiveInteractiveReadyRef.current) return;
      if (!archiveHoverDimEnabledRef.current) return;
      pendingPointerMoveRef.current = { x: event.clientX, y: event.clientY };
      if (pointerMoveRafRef.current) return;
      pointerMoveRafRef.current = requestAnimationFrame(() => {
        pointerMoveRafRef.current = 0;
        const p = pendingPointerMoveRef.current;
        if (!p || !pointerInsideRef.current) return;
        applyBrightFromClientPoint(p.x, p.y);
      });
    },
    [applyBrightFromClientPoint],
  );

  const clearBright = useCallback(() => {
    const el = brightElRef.current;
    if (el) {
      el.removeAttribute("data-archive-bright");
      brightElRef.current = null;
    }
  }, []);

  const handleRootPointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (
      next != null &&
      next instanceof Node &&
      gridRootRef.current?.contains(next)
    ) {
      return;
    }
    pointerInsideRef.current = false;
    gridRootRef.current?.removeAttribute("data-archive-dim");
    lastPointerRef.current = null;
    clearBright();
  }, [clearBright]);

  const handleRootPointerCancel = useCallback(() => {
    pointerInsideRef.current = false;
    gridRootRef.current?.removeAttribute("data-archive-dim");
    lastPointerRef.current = null;
    clearBright();
  }, [clearBright]);

  const vhForWindow = viewportH > 0 ? viewportH : ARCHIVE_LAYOUT_SNAPSHOT_VH;

  useLayoutEffect(() => {
    layoutMetricsRef.current = { rowPitch, vh: vhForWindow, maxGlobalRow };
  }, [rowPitch, vhForWindow, maxGlobalRow]);

  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const w = computeWindow(sc.scrollTop, rowPitch, vhForWindow, maxGlobalRow);
    lastVirtualWindowRef.current = { rMin: w.rMin, rMax: w.rMax };
  }, [rowPitch, vhForWindow, maxGlobalRow]);

  const { rMin, rMax } = useMemo(
    () => computeWindow(scrollTop, rowPitch, vhForWindow, maxGlobalRow),
    [scrollTop, rowPitch, vhForWindow, maxGlobalRow],
  );

  useLayoutEffect(() => {
    imagesRef.current = images;
    archiveLayoutRef.current = {
      rowPitch,
      cols,
      rowCount,
      rMin,
      rMax,
      waveOffsets: waveOffsetsRef.current,
    };
  }, [images, rowPitch, cols, rowCount, rMin, rMax]);

  const rowsInWindow = rMax - rMin + 1;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const byCol = Array.from({ length: cols }, () => [] as HTMLElement[]);
    grid.querySelectorAll<HTMLElement>("button.archive-grid-card").forEach((card) => {
      const col = Number(card.dataset.archiveCol);
      if (Number.isFinite(col) && col >= 0 && col < cols) {
        byCol[col]!.push(card);
      }
    });
    waveCardsByColRef.current = byCol;
    lastAppliedWaveOffsetsRef.current = [];
  }, [rMin, rMax, cols, rowsInWindow, images.length]);

  const applyColumnWave = useCallback(() => {
    const sc = scrollerRef.current;
    const grid = gridRef.current;
    if (!sc || !grid) return false;

    const scroll = sc.scrollTop;
    const colCount = cols;

    if (
      reduceMotion ||
      waveDisabledRef.current ||
      sc.getAttribute("data-archive-landing") === "1"
    ) {
      colWaveYRef.current = Array(colCount).fill(scroll);
      waveOffsetsRef.current = Array(colCount).fill(0);
      archiveLayoutRef.current.waveOffsets = waveOffsetsRef.current;
      const byCol = waveCardsByColRef.current;
      for (let c = 0; c < colCount; c++) {
        const cards = byCol[c];
        if (!cards) continue;
        for (let i = 0; i < cards.length; i++) {
          cards[i]!.style.transform = "translateZ(0)";
        }
      }
      lastAppliedWaveOffsetsRef.current = Array(colCount).fill(0);
      grid.removeAttribute("data-archive-wave");
      return false;
    }

    if (colWaveYRef.current.length !== colCount) {
      colWaveYRef.current = Array(colCount).fill(scroll);
      lastAppliedWaveOffsetsRef.current = [];
    }

    const animating = chaseColumnWaveScroll(scroll, colCount, colWaveYRef.current);
    const offsets = columnWaveOffsets(scroll, colWaveYRef.current);
    waveOffsetsRef.current = offsets;
    archiveLayoutRef.current.waveOffsets = offsets;

    const last = lastAppliedWaveOffsetsRef.current;
    const byCol = waveCardsByColRef.current;
    for (let c = 0; c < colCount; c++) {
      const oy = offsets[c] ?? 0;
      if (last[c] === oy) continue;
      last[c] = oy;
      const transform = `translate3d(0,${oy}px,0) translateZ(0)`;
      const cards = byCol[c];
      if (!cards) continue;
      for (let i = 0; i < cards.length; i++) {
        cards[i]!.style.transform = transform;
      }
    }

    if (animating) {
      grid.setAttribute("data-archive-wave", "1");
    } else {
      grid.removeAttribute("data-archive-wave");
    }

    return animating;
  }, [cols, reduceMotion]);

  const runScrollFrame = useCallback(() => {
    scrollFrameRef.current = 0;

    const sc = scrollerRef.current;
    const grid = gridRef.current;
    const p = periodRef.current;
    if (!sc || !p) return;

    const prevScroll = sc.scrollTop;
    let jumped = false;
    if (prevScroll < p * 0.5) {
      sc.scrollTop = prevScroll + p;
      jumped = true;
    } else if (prevScroll > p * 1.5) {
      sc.scrollTop = prevScroll - p;
      jumped = true;
    }
    const next = sc.scrollTop;
    const scrollDelta = next - prevScroll;

    if (jumped && grid) {
      if (colWaveYRef.current.length === cols) {
        colWaveYRef.current = colWaveYRef.current.map((y) => y + scrollDelta);
      } else {
        colWaveYRef.current = Array(cols).fill(next);
      }
      const m = layoutMetricsRef.current;
      const w = computeWindow(next, m.rowPitch, m.vh, m.maxGlobalRow);
      lastVirtualWindowRef.current = { rMin: w.rMin, rMax: w.rMax };
      grid.style.transform = `translate3d(0, ${w.rMin * m.rowPitch}px, 0)`;
      setScrollTop(next);
    }

    const m = layoutMetricsRef.current;
    const w = computeWindow(next, m.rowPitch, m.vh, m.maxGlobalRow);
    const prev = lastVirtualWindowRef.current;
    if (w.rMin !== prev.rMin || w.rMax !== prev.rMax) {
      lastVirtualWindowRef.current = { rMin: w.rMin, rMax: w.rMax };
      setScrollTop(next);
    }

    const animating = applyColumnWave();
    if (animating && !scrollFrameRef.current) {
      scrollFrameRef.current = requestAnimationFrame(runScrollFrame);
    }
  }, [applyColumnWave, cols]);

  const scheduleScrollFrame = useCallback(() => {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(runScrollFrame);
  }, [runScrollFrame]);

  // Re-target hover when the virtual window shifts during scroll
  useEffect(() => {
    if (!pointerInsideRef.current) return;
    retargetHoverFromLastPointer();
  }, [rMin, rMax, retargetHoverFromLastPointer]);

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let hoverDebounce: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      scheduleScrollFrame();
      if (!pointerInsideRef.current) return;
      clearTimeout(hoverDebounce);
      hoverDebounce = setTimeout(() => {
        retargetHoverFromLastPointer();
      }, 140);
    };
    const onScrollEnd = () => {
      scheduleScrollFrame();
      if (pointerInsideRef.current) retargetHoverFromLastPointer();
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    sc.addEventListener("scrollend", onScrollEnd as EventListener, { passive: true });
    scheduleScrollFrame();
    return () => {
      sc.removeEventListener("scroll", onScroll);
      sc.removeEventListener("scrollend", onScrollEnd as EventListener);
      clearTimeout(hoverDebounce);
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = 0;
    };
  }, [retargetHoverFromLastPointer, scheduleScrollFrame]);

  useEffect(() => {
    colWaveYRef.current = [];
    scheduleScrollFrame();
  }, [cols, scheduleScrollFrame]);

  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const vh =
      sc.clientHeight > 0 ? sc.clientHeight : ARCHIVE_LAYOUT_SNAPSHOT_VH;
    const rhNow = rowHeight > 0 ? rowHeight : archiveRowHeightPx(vh);
    const rowPitchNow = rhNow + GRID_GAP;
    const rc = Math.max(1, Math.ceil(images.length / cols));
    const p = rc * rowPitchNow;
    if (!p) return;
    sc.scrollTop = p;
    const maxG = rc * 3 - 1;
    const w = computeWindow(p, rowPitchNow, vh, maxG);
    lastVirtualWindowRef.current = { rMin: w.rMin, rMax: w.rMax };
    // Mirror DOM scroll into virtual window state before the archive grid intro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrollTop(p);
  }, [layoutKey, images.length, cols, rowHeight]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const gridRoot = gridRootRef.current;

    introCtxRef.current?.revert();
    introCtxRef.current = null;

    let cancelled = false;
    let raf = 0;
    let attempts = 0;
    const maxAttempts = 160;

    const step = () => {
      if (cancelled) return;
      if (skipLandingForDeepLinkRef.current) {
        archiveInteractiveReadyRef.current = true;
        gridRootRef.current?.setAttribute("data-archive-interactive", "1");
        scheduleScrollFrame();
        return;
      }
      attempts += 1;
      const grid = gridRef.current;
      const sc = scrollerRef.current;
      const p = periodRef.current;
      const rc = Math.max(1, Math.ceil(images.length / cols));
      if (!grid || !sc || !p) {
        if (attempts < maxAttempts) raf = requestAnimationFrame(step);
        return;
      }
      const vhEst =
        sc.clientHeight > 0
          ? sc.clientHeight
          : typeof window !== "undefined"
            ? window.innerHeight
            : ARCHIVE_LAYOUT_SNAPSHOT_VH;
      const rhFallback = archiveRowHeightPx(vhEst);
      const rhEst = p > 0 && rc > 0 ? p / rc - GRID_GAP : rhFallback;
      const rowPitchEst = rhEst + GRID_GAP;
      const tol = Math.max(56, rowPitchEst);
      if (Math.abs(sc.scrollTop - p) > tol) {
        if (attempts < maxAttempts) raf = requestAnimationFrame(step);
        return;
      }
      const cards = grid.querySelectorAll<HTMLElement>("button.archive-grid-card");
      if (!cards.length) {
        if (attempts < maxAttempts) raf = requestAnimationFrame(step);
        return;
      }
      introCtxRef.current?.revert();
      introCtxRef.current = gsap.context(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        const cardEls = Array.from(cards);
        const imageClips = cardEls
          .map((card) => card.querySelector<HTMLElement>(".archive-grid-image"))
          .filter((el): el is HTMLElement => el !== null);

        const beginLandingLock = () => {
          archiveInteractiveReadyRef.current = false;
          gridRootRef.current?.removeAttribute("data-archive-interactive");
          archiveLandingCleanupRef.current?.();

          const sc = scrollerRef.current;
          const root = gridRootRef.current;
          if (sc) {
            const lockTop = sc.scrollTop;
            sc.setAttribute("data-archive-landing", "1");
            const fixScroll = () => {
              if (Math.abs(sc.scrollTop - lockTop) > 0.5) sc.scrollTop = lockTop;
            };
            sc.addEventListener("scroll", fixScroll, { passive: true });
            const preventWheel = (e: WheelEvent) => {
              e.preventDefault();
            };
            const preventTouchMove = (e: TouchEvent) => {
              e.preventDefault();
            };
            sc.addEventListener("wheel", preventWheel, { passive: false });
            sc.addEventListener("touchmove", preventTouchMove, { passive: false });
            archiveLandingCleanupRef.current = () => {
              sc.removeEventListener("scroll", fixScroll);
              sc.removeEventListener("wheel", preventWheel);
              sc.removeEventListener("touchmove", preventTouchMove);
              sc.removeAttribute("data-archive-landing");
              root?.removeAttribute("inert");
              archiveLandingCleanupRef.current = null;
            };
          } else {
            archiveLandingCleanupRef.current = () => {
              root?.removeAttribute("inert");
              archiveLandingCleanupRef.current = null;
            };
          }
          root?.setAttribute("inert", "");
        };

        const unlockArchiveInteraction = () => {
          if (cancelled) return;
          archiveInteractiveReadyRef.current = true;
          archiveLandingCleanupRef.current?.();
          gridRootRef.current?.setAttribute("data-archive-interactive", "1");
          requestAnimationFrame(() => {
            if (cancelled || !pointerInsideRef.current) return;
            const p = lastPointerRef.current;
            if (!p || !archiveHoverDimEnabledRef.current) return;
            gridRootRef.current?.setAttribute("data-archive-dim", "1");
            applyBrightFromClientPoint(p.x, p.y);
          });
        };

        beginLandingLock();
        grid.setAttribute("data-archive-intro", "1");

        const finishIntro = () => {
          if (cancelled) return;
          grid.removeAttribute("data-archive-intro");
          if (imageClips.length) {
            gsap.set(imageClips, { clearProps: "clipPath,webkitClipPath,willChange" });
          }
          gsap.set(grid, { pointerEvents: "", clearProps: "pointerEvents" });
          unlockArchiveInteraction();
          scheduleScrollFrame();
        };

        gsap.set(grid, { pointerEvents: "none" });

        if (reduceMotion) {
          if (imageClips.length) {
            gsap.set(imageClips, { clipPath: "inset(0% 0% 0% 0%)" });
          }
          finishIntro();
          return;
        }

        if (imageClips.length) {
          gsap.set(imageClips, {
            clipPath: ARCHIVE_LIGHTBOX_IMAGE_CLIP,
            willChange: "clip-path",
          });
        }

        gsap.timeline({
          defaults: { ease: "power3.inOut" },
          onComplete: finishIntro,
        }).to(imageClips, {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: ARCHIVE_LANDING_CLIP_S,
          stagger: { each: ARCHIVE_LANDING_CLIP_STAGGER_EACH, from: "random" },
        });
      }, grid);
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      if (!skipLandingForDeepLinkRef.current) {
        archiveInteractiveReadyRef.current = false;
      }
      archiveLandingCleanupRef.current?.();
      cancelAnimationFrame(raf);
      introCtxRef.current?.revert();
      introCtxRef.current = null;
      grid?.removeAttribute("data-archive-intro");
      gridRoot?.removeAttribute("data-archive-dim");
      gridRoot?.removeAttribute("data-archive-interactive");
      brightElRef.current?.removeAttribute("data-archive-bright");
      brightElRef.current = null;
    };
  }, [layoutKey, images.length, cols, applyBrightFromClientPoint, reduceMotion, scheduleScrollFrame]);

  const gridWindowHeight = rowsInWindow * rh + Math.max(0, rowsInWindow - 1) * GRID_GAP;

  const closeLightbox = useCallback(() => {
    const archive = archiveMainLayerRef.current;
    const lb = lightboxLayerRef.current;
    const imageClips = archiveImageClipsRef.current;
    const openedFromHome = lightboxOpenedFromHomeRef.current;

    lightboxTransitionTlRef.current?.kill();

    const finishClose = () => {
      lightboxOpenedFromHomeRef.current = false;
      setLightboxIndex(null);
      restoreSiteChromeVisibility();
      lightboxTransitionTlRef.current = null;
    };

    if (reduceMotion) {
      gsap.killTweensOf([archive, lb, ...imageClips].filter(Boolean));
      if (archive) {
        archive.style.removeProperty("visibility");
        gsap.set(archive, {
          autoAlpha: 1,
          clearProps: "willChange,clipPath",
        });
      }
      if (imageClips.length) {
        gsap.set(imageClips, {
          clipPath: "inset(0% 0% 0% 0%)",
          clearProps: "willChange",
        });
      }
      if (lb) gsap.set(lb, { autoAlpha: 0, clearProps: "willChange" });
      finishClose();
      return;
    }

    if (!archive || !lb) {
      finishClose();
      return;
    }

    gsap.killTweensOf([archive, lb, ...imageClips].filter(Boolean));

    if (openedFromHome) {
      archive.style.removeProperty("visibility");
      gsap.set(archive, { autoAlpha: 1, clearProps: "willChange,clipPath" });
      if (imageClips.length) {
        gsap.set(imageClips, {
          clipPath: "inset(0% 0% 0% 0%)",
          clearProps: "clipPath,willChange",
        });
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: finishClose,
      });

      lightboxTransitionTlRef.current = tl;
      tl.to(lb, {
        autoAlpha: 0,
        duration: ARCHIVE_LIGHTBOX_CLOSE_FADE_S,
      });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        gsap.set(archive, {
          clearProps: "willChange,autoAlpha",
        });
        if (imageClips.length) {
          gsap.set(imageClips, { clearProps: "clipPath,willChange" });
        }
        gsap.set(lb, { clearProps: "autoAlpha,willChange" });
        finishClose();
      },
    });

    lightboxTransitionTlRef.current = tl;

    tl.set([archive, lb, ...imageClips].filter(Boolean), { willChange: "opacity,clip-path" })
      .to(lb, {
        autoAlpha: 0,
        duration: ARCHIVE_LIGHTBOX_FADE_S * 0.9,
      }, 0)
      .to(archive, {
        autoAlpha: 1,
        duration: 0.01,
      }, 0.04)
      .to(imageClips, {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: ARCHIVE_LIGHTBOX_CLIP_S,
        stagger: 0,
      }, 0.04);
  }, [reduceMotion]);

  useLayoutEffect(() => {
    if (lightboxIndex === null) return;

    const archive = archiveMainLayerRef.current;
    const lb = lightboxLayerRef.current;
    if (!archive || !lb) return;

    const imageClips = Array.from(
      archive.querySelectorAll<HTMLElement>(".archive-grid-image"),
    );
    archiveImageClipsRef.current = imageClips;

    const reduced = reduceMotion;
    const fadeInFromHome = lightboxOpenedFromHomeRef.current;

    lightboxTransitionTlRef.current?.kill();
    gsap.killTweensOf([archive, lb, ...imageClips].filter(Boolean));

    if (reduced) {
      if (fadeInFromHome) {
        archive.style.removeProperty("visibility");
        gsap.set(archive, { autoAlpha: 0, clearProps: "willChange" });
        gsap.set(lb, { autoAlpha: 1, clearProps: "willChange" });
        restoreSiteChromeVisibility();
        return;
      }

      gsap.set(archive, {
        autoAlpha: 1,
        clearProps: "willChange",
      });
      if (imageClips.length) {
        gsap.set(imageClips, {
          clipPath: ARCHIVE_LIGHTBOX_IMAGE_CLIP,
          clearProps: "willChange",
        });
      }
      gsap.set(lb, { autoAlpha: 1, clearProps: "willChange" });
      return;
    }

    if (fadeInFromHome) {
      archive.style.removeProperty("visibility");
      gsap.set(archive, { autoAlpha: 0, clearProps: "willChange" });
      if (imageClips.length) {
        gsap.set(imageClips, {
          clipPath: ARCHIVE_LIGHTBOX_IMAGE_CLIP,
          clearProps: "clipPath,willChange",
        });
      }
      gsap.set(lb, { autoAlpha: 0, willChange: "opacity" });

      const chrome = getNavChromeTargets();
      gsap.killTweensOf(chrome);
      liftDeferChromeCssLock();
      gsap.set(chrome, { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          gsap.set(lb, { clearProps: "willChange" });
          if (chrome.length) {
            gsap.set(chrome, { clearProps: "opacity,visibility,willChange" });
          }
          clearDeferChromeReveal();
          lightboxTransitionTlRef.current = null;
        },
      });

      lightboxTransitionTlRef.current = tl;
      tl.to(lb, {
        autoAlpha: 1,
        duration: ARCHIVE_LIGHTBOX_FADE_S,
      });
      if (chrome.length) {
        tl.to(chrome, {
          autoAlpha: 1,
          duration: ARCHIVE_LIGHTBOX_CHROME_FADE_S,
          ease: "power2.inOut",
        });
      }
      return;
    }

    gsap.set(archive, {
      autoAlpha: 1,
      willChange: "opacity",
    });
    if (imageClips.length) {
      gsap.set(imageClips, {
        clipPath: "inset(0% 0% 0% 0%)",
        willChange: "clip-path",
      });
    }
    gsap.set(lb, {
      autoAlpha: 0,
      willChange: "opacity",
    });

    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        gsap.set(archive, { clearProps: "willChange" });
        if (imageClips.length) {
          gsap.set(imageClips, { clearProps: "willChange" });
        }
        gsap.set(lb, { clearProps: "willChange" });
        lightboxTransitionTlRef.current = null;
      },
    });

    lightboxTransitionTlRef.current = tl;

    const archiveHideDone = 0.08 + ARCHIVE_LIGHTBOX_CLIP_S;

    tl.to(imageClips, {
      clipPath: ARCHIVE_LIGHTBOX_IMAGE_CLIP,
      duration: ARCHIVE_LIGHTBOX_CLIP_S,
      stagger: 0,
    }, 0.08)
      .to(lb, {
        autoAlpha: 1,
        duration: ARCHIVE_LIGHTBOX_FADE_S,
      }, archiveHideDone);

    return () => {
      tl.kill();
    };
  }, [lightboxIndex, reduceMotion]);

  useEffect(() => {
    const archive = archiveMainLayerRef.current;
    const lb = lightboxLayerRef.current;

    return () => {
      const imageClips = archiveImageClipsRef.current;
      lightboxTransitionTlRef.current?.kill();
      archiveNavLeaveTlRef.current?.kill();
      gsap.killTweensOf([archive, lb, ...imageClips].filter(Boolean));
    };
  }, []);

  useLayoutEffect(() => {
    lightboxIndexRef.current = lightboxIndex;
  }, [lightboxIndex]);

  useLayoutEffect(() => {
    setArchiveLightboxOpen(lightboxIndex !== null);
    return () => clearArchiveLightboxOpen();
  }, [lightboxIndex]);

  /** Internal navigation off archive: same grid outro as opening the lightbox (image clip). */
  useEffect(() => {
    type ArchiveLeaveDetail = { onComplete: () => void };

    const onLeaveOutro = (event: Event) => {
      const { onComplete } = (event as CustomEvent<ArchiveLeaveDetail>).detail ?? {};
      if (!onComplete) return;

      if (lightboxIndexRef.current !== null) {
        onComplete();
        return;
      }

      if (reduceMotion) {
        onComplete();
        return;
      }

      archiveNavLeaveTlRef.current?.kill();
      lightboxTransitionTlRef.current?.kill();

      const archive = archiveMainLayerRef.current;
      if (!archive) {
        onComplete();
        return;
      }

      const imageClips = Array.from(
        archive.querySelectorAll<HTMLElement>(".archive-grid-image"),
      );

      gsap.killTweensOf([archive, ...imageClips].filter(Boolean));

      if (imageClips.length === 0) {
        onComplete();
        return;
      }

      gsap.set(imageClips, { willChange: "clip-path" });

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          gsap.set(imageClips, { clearProps: "willChange" });
          archiveNavLeaveTlRef.current = null;
          onComplete();
        },
      });

      archiveNavLeaveTlRef.current = tl;

      tl.to(
        imageClips,
        {
          clipPath: ARCHIVE_LIGHTBOX_IMAGE_CLIP,
          duration: ARCHIVE_LIGHTBOX_CLIP_S,
          stagger: 0,
        },
        0,
      );
    };

    window.addEventListener(ARCHIVE_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
    return () => {
      window.removeEventListener(ARCHIVE_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
    };
  }, [reduceMotion]);

  const handleGridClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const btn = (event.target as HTMLElement).closest("button[data-image-idx]");
    if (!btn) return;
    const raw = btn.getAttribute("data-image-idx");
    if (raw == null) return;
    const idx = Number(raw);
    if (Number.isFinite(idx)) setLightboxIndex(idx);
  }, []);

  const windowSpec = useMemo(() => {
    const out: Array<{
      key: string;
      gr: number;
      c: number;
      localRow: number;
      idx: number;
    }> = [];
    for (let gr = rMin; gr <= rMax; gr++) {
      const dataRow = mod(gr, rowCount);
      const localRow = gr - rMin + 1;
      for (let c = 0; c < cols; c++) {
        const idx = dataRow * cols + c;
        out.push({
          key: idx < images.length ? `${idx}-${c}` : `empty-${dataRow}-${c}`,
          gr,
          c,
          localRow,
          idx,
        });
      }
    }
    return out;
  }, [rMin, rMax, cols, rowCount, images.length]);

  const cells = useMemo(() => {
    const prewarm = cols * 2;
    return windowSpec.map((spec) => {
      if (spec.idx >= images.length) {
        return (
          <div
            key={spec.key}
            className="archive-grid-card pointer-events-none opacity-0"
            style={{ gridRow: spec.localRow, gridColumn: spec.c + 1 }}
            aria-hidden
          />
        );
      }
      const image = images[spec.idx]!;
      const visibleLandingRow = spec.localRow >= 3 && spec.localRow <= 5;
      const eager = visibleLandingRow || spec.idx < prewarm;
      const preload = visibleLandingRow && spec.localRow === 3;
      const fetchPriority: "high" | "low" | "auto" =
        visibleLandingRow ? "high" : spec.idx < prewarm ? "auto" : "low";
      return (
        <ArchiveGridCell
          key={spec.key}
          imageId={image.id}
          imageName={image.name}
          imageUrl={image.url}
          imageIdx={spec.idx}
          localRow={spec.localRow}
          col={spec.c}
          eager={eager}
          preload={preload}
          fetchPriority={fetchPriority}
        />
      );
    });
  }, [windowSpec, images, cols]);

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-background text-foreground">
      <div data-page-content className="relative h-[100dvh]">
        <div
          ref={archiveMainLayerRef}
          className="relative h-[100dvh]"
          style={initialDeepLinkIndex !== null ? { visibility: "hidden" } : undefined}
        >
          <div
            ref={scrollerRef}
            className="archive-page-scroller h-[100dvh] overflow-y-auto overflow-x-hidden"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "none",
              contain: "layout style",
              scrollBehavior: "auto",
              overflowAnchor: "none",
              touchAction: "pan-y",
            }}
          >
            <div
              ref={gridRootRef}
              className="archive-grid-root relative w-full"
              style={{
                height: totalVirtualHeight,
                contain: "layout paint style",
              }}
              onPointerEnter={handleRootPointerEnter}
              onPointerMove={handleRootPointerMove}
              onPointerLeave={handleRootPointerLeave}
              onPointerCancel={handleRootPointerCancel}
            >
              <div
                ref={gridRef}
                role="presentation"
                className="archive-grid pointer-events-auto absolute left-0 right-0 w-full"
                style={{
                  transform: `translate3d(0px, ${rMin * rowPitch}px, 0px)`,
                  height: gridWindowHeight,
                  gridTemplateRows: `repeat(${rowsInWindow}, ${rh}px)`,
                  contain: "layout paint style",
                }}
                suppressHydrationWarning
                onClick={handleGridClick}
              >
                {cells}
              </div>
            </div>
          </div>
        </div>

        {lightboxIndex !== null && (
          <div
            ref={lightboxLayerRef}
            className="fixed inset-0 z-50"
            style={{ opacity: 0 }}
          >
            <ArchiveLightbox
              images={images}
              initialIndex={lightboxIndex}
              onClose={closeLightbox}
            />
          </div>
        )}
      </div>
    </main>
  );
}
