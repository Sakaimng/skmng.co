"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";

type Seg = { type: "word" | "space"; value: string };

function parseSegments(text: string): Seg[] {
  const out: Seg[] = [];
  const re = /\S+|\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[0];
    out.push(/\S/.test(v) ? { type: "word", value: v } : { type: "space", value: v });
  }
  return out.length ? out : [{ type: "word", value: text }];
}

const SLOT_DURATION_IN = 0.62;
const SLOT_DURATION_OUT = 0.55;
const STAGGER_IN = 0.04;
const STAGGER_OUT = 0.03;

function SlotWord({
  word,
  trackIndex,
  setTrack,
}: {
  word: string;
  trackIndex: number;
  setTrack: (i: number, el: HTMLDivElement | null) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const track = outer?.querySelector<HTMLDivElement>("[data-slot-track]");
    if (!outer || !track) return;

    const measure = () => {
      const a = track.children[0] as HTMLElement | undefined;
      const b = track.children[1] as HTMLElement | undefined;
      if (!a) return;
      // One line box: leading-none + inherit so clip height matches a single 0.81em line
      const h = a.getBoundingClientRect().height;
      const w = Math.max(a.getBoundingClientRect().width, b?.getBoundingClientRect().width ?? 0);
      if (h > 0) outer.style.height = `${h}px`;
      if (w > 0) outer.style.width = `${w}px`;
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(track);
    }

    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [word]);

  return (
    <div
      ref={outerRef}
      className="inline-block overflow-hidden align-baseline text-inherit leading-none"
    >
      <div
        ref={(el) => setTrack(trackIndex, el)}
        data-slot-track=""
        className="flex flex-col flex-nowrap gap-0 will-change-transform"
      >
        <span className="block shrink-0 whitespace-nowrap text-inherit leading-none">
          {word}
        </span>
        <span className="block shrink-0 whitespace-nowrap text-inherit leading-none">
          {word}
        </span>
      </div>
    </div>
  );
}

type HoverSplitLabelProps = {
  text: string;
  className?: string;
};

/**
 * Word-based slot reels: hover moves each word strip up (duplicate line replaces).
 * Hover out reverses with stagger from the end.
 */
export function HoverSplitLabel({ text, className }: HoverSplitLabelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => parseSegments(text), [text]);

  const tracksRef = useRef<(HTMLDivElement | null)[]>([]);

  const setTrack = useCallback((i: number, el: HTMLDivElement | null) => {
    const arr = tracksRef.current;
    if (el == null) {
      if (i < arr.length) arr[i] = null;
      return;
    }
    if (arr.length <= i) arr.length = i + 1;
    arr[i] = el;
  }, []);

  const getTracks = useCallback(() => {
    return tracksRef.current.filter((t): t is HTMLDivElement => t != null);
  }, []);

  const prefersReducedMotion = useCallback(() => {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const playIn = useCallback(() => {
    if (prefersReducedMotion()) return;
    const tracks = getTracks();
    if (tracks.length === 0) return;
    gsap.killTweensOf(tracks);
    gsap.set(tracks, { yPercent: 0 });
    gsap.to(tracks, {
      yPercent: -50,
      duration: SLOT_DURATION_IN,
      ease: "power1.out",
      stagger: { each: STAGGER_IN, from: "start" },
      force3D: true,
    });
  }, [getTracks, prefersReducedMotion]);

  const playOut = useCallback(() => {
    if (prefersReducedMotion()) return;
    const tracks = getTracks();
    if (tracks.length === 0) return;
    gsap.killTweensOf(tracks);
    gsap.to(tracks, {
      yPercent: 0,
      duration: SLOT_DURATION_OUT,
      ease: "power2.inOut",
      stagger: { each: STAGGER_OUT, from: "end" },
      force3D: true,
    });
  }, [getTracks, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      const tracks = getTracks();
      gsap.killTweensOf(tracks);
      gsap.set(tracks, { clearProps: "transform" });
    };
  }, [getTracks]);

  const onEnterRef = useRef(playIn);
  const onLeaveRef = useRef(playOut);
  onEnterRef.current = playIn;
  onLeaveRef.current = playOut;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const hoverTarget =
      root.closest<HTMLElement>(
        'a, button, [role="button"], [role="link"], [data-glitch-hover-target]'
      ) ?? root;

    const onFocusIn = () => onEnterRef.current();
    const onFocusOut = () => onLeaveRef.current();
    const onPointerEnter = () => onEnterRef.current();
    const onPointerLeave = () => onLeaveRef.current();

    hoverTarget.addEventListener("focusin", onFocusIn);
    hoverTarget.addEventListener("focusout", onFocusOut);
    hoverTarget.addEventListener("pointerenter", onPointerEnter);
    hoverTarget.addEventListener("pointerleave", onPointerLeave);

    return () => {
      hoverTarget.removeEventListener("focusin", onFocusIn);
      hoverTarget.removeEventListener("focusout", onFocusOut);
      hoverTarget.removeEventListener("pointerenter", onPointerEnter);
      hoverTarget.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <span
      ref={rootRef}
      className={className ? `inline-flex items-baseline text-inherit ${className}` : "inline-flex items-baseline text-inherit"}
      data-glitch-label=""
      data-glitch-hover-target=""
    >
      {(() => {
        let wj = 0;
        return segments.map((seg, i) => {
          if (seg.type === "space") {
            return (
              <span key={`s-${i}`} className="whitespace-pre">
                {seg.value}
              </span>
            );
          }
          const idx = wj++;
          return (
            <SlotWord
              key={`w-${i}-${seg.value}`}
              word={seg.value}
              trackIndex={idx}
              setTrack={setTrack}
            />
          );
        });
      })()}
    </span>
  );
}
