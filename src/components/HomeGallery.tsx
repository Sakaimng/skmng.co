"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Lenis from "lenis";

import { getAssetSrcSet, getAssetUrl } from "@/lib/assetUrls";
import type { AssetImage } from "@/lib/assets";

const INTRO_DELAY_MS = 950;
const INTRO_DURATION_MS = 1600;

export function HomeGallery({
  images,
  animateIntro = false,
}: {
  images: AssetImage[];
  animateIntro?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scaleRafRef = useRef<number | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const introTimeoutRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const canFadeRef = useRef(false);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const [isIdle, setIsIdle] = useState(false);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const ctx = gsap.context(() => {
      const cards = scroller.querySelectorAll<HTMLElement>(
        "[data-gallery-card='initial']",
      );

      if (cards?.length && animateIntro) {
        gsap.fromTo(
          cards,
          {
            autoAlpha: 0,
            yPercent: 20,
          },
          {
            autoAlpha: 1,
            yPercent: 0,
            duration: 1.2,
            delay: INTRO_DELAY_MS / 1000,
            stagger: 0.14,
            ease: "power3.out",
            clearProps: "transform,opacity,visibility",
          },
        );
      } else if (cards?.length) {
        gsap.set(cards, { autoAlpha: 1, yPercent: 0 });
      }
    }, scroller);

    return () => ctx.revert();
  }, [animateIntro, images.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track || images.length === 0) return;

    const getCards = () =>
      Array.from(scroller.querySelectorAll<HTMLElement>(".home-gallery-card"));

    const lenis = new Lenis({
      wrapper: scroller,
      content: track,
      orientation: "horizontal",
      gestureOrientation: "both",
      smoothWheel: true,
      syncTouch: true,
      lerp: 0.09,
      wheelMultiplier: 1,
    });

    const raf = (time: number) => {
      lenis.raf(time);
      rafRef.current = window.requestAnimationFrame(raf);
    };
    rafRef.current = window.requestAnimationFrame(raf);

    const singleSetWidth = () => scroller.scrollWidth / 3;
    const cardWidth = () => getCards()[0]?.offsetWidth ?? scroller.clientWidth;

    const normalizeToMiddleSet = (value: number) => {
      const setWidth = singleSetWidth();
      if (!setWidth) return value;

      const normalized =
        ((value - setWidth) % setWidth + setWidth) % setWidth + setWidth;

      return normalized;
    };

    const syncLoopPosition = () => {
      const normalized = normalizeToMiddleSet(scroller.scrollLeft);
      if (Math.abs(normalized - scroller.scrollLeft) > 1) {
        scroller.scrollLeft = normalized;
      }
    };

    const startIdleTimer = () => {
      if (!canFadeRef.current) return;
      setIsIdle(false);
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      idleTimeoutRef.current = window.setTimeout(() => {
        setIsIdle(true);
      }, 3000);
    };

    const resetIdleTimer = () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      syncLoopPosition();
      startIdleTimer();
      snapTimeoutRef.current = window.setTimeout(() => {
        const width = cardWidth();
        if (!width) return;
        const snapped = Math.round(scroller.scrollLeft / width) * width;
        const normalizedSnap = normalizeToMiddleSet(snapped);
        lenis.scrollTo(snapped, {
          duration: 0.85,
          immediate: false,
        });
        if (Math.abs(normalizedSnap - snapped) > 1) {
          window.setTimeout(() => {
            scroller.scrollLeft = normalizedSnap;
          }, 900);
        }
      }, 140);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY !== 0 || event.deltaX !== 0) resetIdleTimer();
    };

    const onScroll = () => {
      syncLoopPosition();
      scheduleFocusScaleUpdate();
      startIdleTimer();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragStateRef.current = {
        active: true,
        startX: event.clientX,
        startScrollLeft: scroller.scrollLeft,
      };
      scroller.setPointerCapture(event.pointerId);
      resetIdleTimer();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.active) return;

      const delta = event.clientX - dragStateRef.current.startX;
      lenis.scrollTo(dragStateRef.current.startScrollLeft - delta, {
        immediate: true,
      });
      resetIdleTimer();
    };

    const endDrag = () => {
      dragStateRef.current.active = false;
      resetIdleTimer();
    };

    const resetFromVisibility = () => {
      if (document.visibilityState === "visible") {
        setIsIdle(false);
        startIdleTimer();
      }
    };

    const initializeLoop = () => {
      const setWidth = singleSetWidth();
      if (!setWidth) return;
      lenis.scrollTo(setWidth, { immediate: true });
    };

    const updateFocusScale = () => {
      const cards = getCards();
      const viewportCenter = scroller.clientWidth / 2;
      const width = cardWidth();

      cards.forEach((card) => {
        const image = card.querySelector<HTMLElement>(".home-gallery-image");
        if (!image) return;

        const cardCenter =
          card.offsetLeft - scroller.scrollLeft + card.offsetWidth / 2;
        const signedOffset = (cardCenter - viewportCenter) / Math.max(width, 1);
        const normalizedDistance = Math.min(1, Math.abs(signedOffset));
        const easedDistance = Math.pow(normalizedDistance, 1.15);

        let scale = 1;
        if (signedOffset < 0) {
          const leftStrength = width >= scroller.clientWidth * 0.95 ? 0.12 : 0.18;
          scale = 1 + easedDistance * leftStrength;
        } else if (signedOffset > 0) {
          const rightStrength = width >= scroller.clientWidth * 0.95 ? 0.08 : 0.12;
          scale = 1 - easedDistance * rightStrength;
        }

        image.style.transform = `scale3d(${scale}, ${scale}, 1)`;
      });
    };

    const scheduleFocusScaleUpdate = () => {
      if (scaleRafRef.current) return;
      scaleRafRef.current = window.requestAnimationFrame(() => {
        scaleRafRef.current = null;
        updateFocusScale();
      });
    };

    initializeLoop();
    scheduleFocusScaleUpdate();
    if (animateIntro) {
      introTimeoutRef.current = window.setTimeout(() => {
        canFadeRef.current = true;
        startIdleTimer();
      }, INTRO_DELAY_MS + INTRO_DURATION_MS);
    } else {
      canFadeRef.current = true;
      startIdleTimer();
    }

    scroller.addEventListener("wheel", onWheel, { passive: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);
    scroller.addEventListener("pointerleave", endDrag);
    document.addEventListener("visibilitychange", resetFromVisibility);
    window.addEventListener("resize", scheduleFocusScaleUpdate);

    return () => {
      if (scaleRafRef.current) {
        window.cancelAnimationFrame(scaleRafRef.current);
      }
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
      }
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      canFadeRef.current = false;
      lenis.destroy();
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", endDrag);
      scroller.removeEventListener("pointercancel", endDrag);
      scroller.removeEventListener("pointerleave", endDrag);
      document.removeEventListener("visibilitychange", resetFromVisibility);
      window.removeEventListener("resize", scheduleFocusScaleUpdate);
    };
  }, [animateIntro, images.length]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      <div
        ref={scrollerRef}
        className={`home-gallery-scroller ${isIdle ? "home-gallery-is-idle" : ""}`}
      >
        <div ref={trackRef} className="flex h-screen w-max">
          {[0, 1, 2].flatMap((copyIndex) =>
            images.map((image, imageIndex) => (
              <figure
                key={`${copyIndex}-${image.id}`}
                data-gallery-card={
                  copyIndex === 1 && imageIndex < 3 ? "initial" : "default"
                }
                className="home-gallery-card relative shrink-0 overflow-hidden bg-black"
              >
                <div className="home-gallery-media h-full w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAssetUrl(image.name, 960, 74)}
                    srcSet={getAssetSrcSet(image.name, [480, 768, 960, 1280], 74)}
                    sizes="(max-width: 767px) 100vw, 33vw"
                    alt=""
                    decoding="async"
                    loading={copyIndex === 1 && imageIndex < 3 ? "eager" : "lazy"}
                    fetchPriority={copyIndex === 1 && imageIndex < 2 ? "high" : "auto"}
                    draggable={false}
                    className="home-gallery-image pointer-events-none h-full w-full object-cover select-none"
                  />
                </div>
              </figure>
            )),
          )}
        </div>
      </div>
    </section>
  );
}
