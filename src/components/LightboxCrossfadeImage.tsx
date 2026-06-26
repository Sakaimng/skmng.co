"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import type { AssetImage } from "@/lib/assets";

const CROSSFADE_S = 0.42;
const SLIDE_IN_VW = 10;
const SLIDE_OUT_VW = 6;

function LightboxImage({
  image,
  quality,
}: {
  image: AssetImage;
  quality: number;
}) {
  return (
    <Image
      key={image.name}
      src={image.url}
      alt=""
      fill
      loading="eager"
      fetchPriority="high"
      quality={quality}
      sizes="100vw"
      className="object-contain max-md:object-cover"
      draggable={false}
      style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
    />
  );
}

/**
 * Crossfade + directional slide when `index` changes.
 * Two persistent layers (A/B) avoid mount/unmount flicker between slides.
 */
export function LightboxCrossfadeImage({
  images,
  index,
  direction,
  quality,
}: {
  images: AssetImage[];
  index: number;
  direction: 1 | -1;
  quality: number;
}) {
  const frontLayerRef = useRef<"a" | "b">("a");
  const [indexA, setIndexA] = useState(index);
  const [indexB, setIndexB] = useState(index);
  const indexARef = useRef(indexA);
  const indexBRef = useRef(indexB);
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<() => void>(() => {});
  const pendingAnimRef = useRef<{ direction: 1 | -1 } | null>(null);

  indexARef.current = indexA;
  indexBRef.current = indexB;

  const shownIndex = () =>
    frontLayerRef.current === "a" ? indexARef.current : indexBRef.current;

  useLayoutEffect(() => {
    const a = layerARef.current;
    const b = layerBRef.current;
    if (!a || !b) return;
    gsap.set(a, { x: 0, autoAlpha: 1, zIndex: 1, visibility: "visible" });
    gsap.set(b, { x: 0, autoAlpha: 0, zIndex: 0, visibility: "hidden" });
  }, []);

  useLayoutEffect(() => {
    const len = images.length;
    if (!len) return;

    const next = (index + 1) % len;
    const prev = (index - 1 + len) % len;
    for (const i of [next, prev]) {
      const img = new window.Image();
      img.src = images[i].url;
    }
  }, [index, images]);

  // Stage the incoming image on the back layer (async commit — no flushSync).
  useLayoutEffect(() => {
    if (index === shownIndex()) return;

    const front = frontLayerRef.current;
    const back = front === "a" ? "b" : "a";
    pendingAnimRef.current = { direction };

    if (back === "a") setIndexA(index);
    else setIndexB(index);
  }, [index, direction]);

  // Run the transition after React commits the back-layer image.
  useLayoutEffect(() => {
    const pending = pendingAnimRef.current;
    if (!pending) return;

    const front = frontLayerRef.current;
    const back = front === "a" ? "b" : "a";
    const frontEl = front === "a" ? layerARef.current : layerBRef.current;
    const backEl = back === "a" ? layerARef.current : layerBRef.current;
    const backIndex = back === "a" ? indexA : indexB;
    const animDirection = pending.direction;

    if (backIndex !== index) return;

    pendingAnimRef.current = null;

    if (!frontEl || !backEl) {
      frontLayerRef.current = back;
      return;
    }

    const runTransition = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        frontLayerRef.current = back;
        gsap.set(backEl, {
          x: 0,
          autoAlpha: 1,
          zIndex: 1,
          visibility: "visible",
          clearProps: "transform",
        });
        gsap.set(frontEl, {
          autoAlpha: 0,
          zIndex: 0,
          visibility: "hidden",
          clearProps: "transform",
        });
        return;
      }

      cancelRef.current();
      gsap.killTweensOf([frontEl, backEl]);

      const slideIn = animDirection * SLIDE_IN_VW;
      const slideOut = animDirection * -SLIDE_OUT_VW;

      gsap.set(frontEl, { x: 0, autoAlpha: 1, zIndex: 1, visibility: "visible" });
      gsap.set(backEl, {
        x: `${slideIn}vw`,
        autoAlpha: 0,
        zIndex: 2,
        visibility: "visible",
      });

      const tl = gsap.timeline({
        onComplete: () => {
          frontLayerRef.current = back;
          gsap.set(frontEl, {
            autoAlpha: 0,
            zIndex: 0,
            visibility: "hidden",
            clearProps: "transform",
          });
          gsap.set(backEl, {
            x: 0,
            autoAlpha: 1,
            zIndex: 1,
            visibility: "visible",
            clearProps: "transform",
          });
          cancelRef.current = () => {};
        },
      });

      tl.to(
        frontEl,
        {
          x: `${slideOut}vw`,
          autoAlpha: 0,
          duration: CROSSFADE_S,
          ease: "power2.inOut",
        },
        0,
      ).to(
        backEl,
        {
          x: 0,
          autoAlpha: 1,
          duration: CROSSFADE_S,
          ease: "power2.inOut",
        },
        0,
      );

      cancelRef.current = () => {
        tl.kill();
        gsap.killTweensOf([frontEl, backEl]);
        frontLayerRef.current = back;
        gsap.set(frontEl, {
          autoAlpha: 0,
          zIndex: 0,
          visibility: "hidden",
          clearProps: "transform",
        });
        gsap.set(backEl, {
          x: 0,
          autoAlpha: 1,
          zIndex: 1,
          visibility: "visible",
          clearProps: "transform",
        });
      };
    };

    const backImg = backEl.querySelector("img");
    if (backImg && !backImg.complete) {
      let cancelled = false;
      const onReady = () => {
        if (cancelled) return;
        runTransition();
      };
      backImg.addEventListener("load", onReady, { once: true });
      backImg.addEventListener("error", onReady, { once: true });
      return () => {
        cancelled = true;
        backImg.removeEventListener("load", onReady);
        backImg.removeEventListener("error", onReady);
        cancelRef.current();
      };
    }

    runTransition();
    return () => cancelRef.current();
  }, [indexA, indexB, index]);

  const imageA = images[indexA];
  const imageB = images[indexB];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        ref={layerARef}
        className="absolute inset-0"
        style={{ willChange: "transform, opacity" }}
      >
        {imageA ? <LightboxImage image={imageA} quality={quality} /> : null}
      </div>
      <div
        ref={layerBRef}
        className="absolute inset-0"
        style={{ willChange: "transform, opacity" }}
      >
        {imageB ? <LightboxImage image={imageB} quality={quality} /> : null}
      </div>
    </div>
  );
}
