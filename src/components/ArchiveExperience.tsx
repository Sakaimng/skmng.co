"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import Lenis from "lenis";

import { SiteHeader } from "@/components/SiteHeader";
import { getAssetSrcSet, getAssetUrl } from "@/lib/assetUrls";
import type { AssetImage } from "@/lib/assets";

function ArchiveLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: AssetImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const tripledImages = useMemo(
    () => [0, 1, 2].flatMap((copy) => images.map((image) => ({ ...image, copy }))),
    [images],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track || images.length === 0) return;

    const lenis = new Lenis({
      wrapper: scroller,
      content: track,
      orientation: "horizontal",
      gestureOrientation: "both",
      smoothWheel: true,
      syncTouch: true,
      lerp: 0.1,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    const setWidth = () => scroller.scrollWidth / 3;
    const slideWidth = () => scroller.clientWidth;
    const normalizeToMiddleSet = (value: number) => {
      const width = setWidth();
      if (!width) return value;

      return ((value - width) % width + width) % width + width;
    };

    const syncLoop = () => {
      const normalized = normalizeToMiddleSet(scroller.scrollLeft);
      if (Math.abs(normalized - scroller.scrollLeft) > 1) {
        scroller.scrollLeft = normalized;
      }
    };

    const updateActive = () => {
      const width = slideWidth();
      if (!width) return;
      const nearest = Math.round(scroller.scrollLeft / width);
      const wrapped = ((nearest % images.length) + images.length) % images.length;
      setActiveIndex(wrapped);
    };

    const queueSnap = () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      snapTimeoutRef.current = window.setTimeout(() => {
        const width = slideWidth();
        if (!width) return;
        const snapped = Math.round(scroller.scrollLeft / width) * width;
        const normalizedSnap = normalizeToMiddleSet(snapped);
        lenis.scrollTo(snapped, { duration: 0.8 });
        if (Math.abs(normalizedSnap - snapped) > 1) {
          window.setTimeout(() => {
            scroller.scrollLeft = normalizedSnap;
          }, 850);
        }
      }, 120);
    };

    const onScroll = () => {
      syncLoop();
      updateActive();
      queueSnap();
    };

    const initialPosition = setWidth() + initialIndex * slideWidth();
    lenis.scrollTo(initialPosition, { immediate: true });
    updateActive();

    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [images, initialIndex]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-[2.5%] top-[2.5%] z-20 text-white/70 hover:text-white"
      >
        CLOSE
      </button>

      <div
        ref={scrollerRef}
        className="archive-lightbox-scroller min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
      >
        <div ref={trackRef} className="flex h-full w-max">
          {tripledImages.map((image, index) => (
            <div key={`${image.copy}-${image.id}-${index}`} className="h-full w-screen shrink-0 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetUrl(image.name, 1440, 80)}
                srcSet={getAssetSrcSet(image.name, [768, 1024, 1440, 1920], 80)}
                sizes="100vw"
                alt=""
                decoding="async"
                className="h-full w-full object-contain"
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="z-20 bg-black px-[2.5%] pb-6 pt-4">
        <div className="archive-thumb-rail flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                const scroller = scrollerRef.current;
                if (!scroller) return;
                const target = scroller.clientWidth * (images.length + index);
                scroller.scrollTo({ left: target, behavior: "smooth" });
              }}
              className={activeIndex === index ? "archive-thumb active" : "archive-thumb"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetUrl(image.name, 160, 62)}
                srcSet={getAssetSrcSet(image.name, [120, 160, 240], 62)}
                sizes="56px"
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ArchiveExperience({ images }: { images: AssetImage[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const middleGridRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    const middleGrid = middleGridRef.current;
    if (!scroller || !content || !middleGrid || images.length === 0) return;

    const lenis = new Lenis({
      wrapper: scroller,
      content,
      orientation: "vertical",
      smoothWheel: true,
      syncTouch: true,
      lerp: 0.09,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    const setHeight = () => scroller.scrollHeight / 3;
    const normalizeToMiddleSet = (value: number) => {
      const height = setHeight();
      if (!height) return value;

      return ((value - height) % height + height) % height + height;
    };

    const syncLoop = () => {
      const normalized = normalizeToMiddleSet(scroller.scrollTop);
      if (Math.abs(normalized - scroller.scrollTop) > 1) {
        scroller.scrollTop = normalized;
      }
    };

    const cards = middleGrid.querySelectorAll<HTMLElement>("[data-archive-card='middle']");
    const gridRect = middleGrid.getBoundingClientRect();
    const centerX = gridRect.left + gridRect.width / 2;
    const centerY = gridRect.top + gridRect.height / 2;

    gsap.set(scroller, { autoAlpha: 0 });
    gsap.to(scroller, {
      autoAlpha: 1,
      duration: 0.6,
      ease: "power2.out",
    });

    gsap.fromTo(
      cards,
      {
        autoAlpha: 0,
        scale: 0.18,
        x: (_, element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return centerX - (rect.left + rect.width / 2);
        },
        y: (_, element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return centerY - (rect.top + rect.height / 2);
        },
      },
      {
        autoAlpha: 1,
        scale: 1,
        x: 0,
        y: 0,
        duration: 1.05,
        ease: "power3.out",
        stagger: 0.012,
        clearProps: "transform,opacity,visibility",
      },
    );

    const initial = setHeight();
    lenis.scrollTo(initial, { immediate: true });
    syncLoop();

    const onScroll = () => {
      syncLoop();
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [images]);

  return (
    <main className="relative h-screen overflow-hidden bg-black text-white">
      <SiteHeader currentPath="/archive" />

      <div data-page-content className="relative h-screen">
        <div
          ref={scrollerRef}
          className="archive-page-scroller h-screen overflow-y-auto overflow-x-hidden"
        >
          <div ref={contentRef} className="w-full">
            {[0, 1, 2].map((copyIndex) => (
              <div
                key={copyIndex}
                ref={copyIndex === 1 ? middleGridRef : undefined}
                className={`archive-grid ${hoveredId ? "archive-grid-dimmed" : ""}`}
                onMouseLeave={() => setHoveredId(null)}
              >
                {images.map((image, imageIndex) => {
                  const imageKey = `${copyIndex}-${image.id}`;
                  const dimmed = hoveredId !== null && hoveredId !== imageKey;
                  return (
                    <button
                      key={imageKey}
                      type="button"
                      data-archive-card={copyIndex === 1 ? "middle" : "outer"}
                      onMouseEnter={() => setHoveredId(imageKey)}
                      onFocus={() => setHoveredId(imageKey)}
                      onClick={() => setLightboxIndex(imageIndex)}
                      className={`archive-grid-card ${dimmed ? "archive-grid-card-dimmed" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAssetUrl(image.name, 480, 68)}
                        srcSet={getAssetSrcSet(image.name, [240, 360, 480, 640], 68)}
                        sizes="(max-width: 767px) 33vw, 16.66vw"
                        alt={image.name}
                        decoding="async"
                        loading={copyIndex === 1 && imageIndex < 8 ? "eager" : "lazy"}
                        fetchPriority={copyIndex === 1 && imageIndex < 4 ? "high" : "auto"}
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {lightboxIndex !== null && (
          <ArchiveLightbox
            images={images}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </div>
    </main>
  );
}
