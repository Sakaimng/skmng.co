"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";

import { getWorkCoverSrc, preloadWorkCover } from "@/lib/workCoverImage";
import type { WorkProject } from "@/lib/works";

const WORK_BG_FADE_S = 0.32;

export type WorkHoverBackgroundHandle = {
  setActive: (slug: string | null, immediate?: boolean) => void;
};

type WorkHoverBackgroundProps = {
  projects: WorkProject[];
};

function projectThumbUrl(projects: WorkProject[], slug: string | null) {
  if (!slug) return null;
  return projects.find((project) => project.slug === slug)?.thumbnailUrl ?? null;
}

export const WorkHoverBackground = forwardRef<
  WorkHoverBackgroundHandle,
  WorkHoverBackgroundProps
>(function WorkHoverBackground({ projects }, ref) {
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<"a" | "b">("a");
  const tweenRef = useRef<gsap.core.Animation | null>(null);
  const pendingFadeRef = useRef<(() => void) | null>(null);
  const urlARef = useRef<string | null>(null);
  const urlBRef = useRef<string | null>(null);

  const [urlA, setUrlA] = useState<string | null>(null);
  const [urlB, setUrlB] = useState<string | null>(null);
  const [layerAOpacity, setLayerAOpacity] = useState(0);

  urlARef.current = urlA;
  urlBRef.current = urlB;

  const runFade = useCallback((opacity: number, immediate: boolean) => {
    const layerA = layerARef.current;
    const layerB = layerBRef.current;
    if (!layerA || !layerB) return;

    tweenRef.current?.kill();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const front = frontRef.current === "a" ? layerA : layerB;
    const back = frontRef.current === "a" ? layerB : layerA;

    if (immediate || reduceMotion) {
      gsap.set(front, { opacity: 0 });
      gsap.set(back, { opacity });
      if (front === layerA) setLayerAOpacity(0);
      else if (back === layerA) setLayerAOpacity(opacity);
      frontRef.current = frontRef.current === "a" ? "b" : "a";
      return;
    }

    gsap.set(back, { opacity: 0 });
    tweenRef.current = gsap.timeline({ defaults: { ease: "power2.out", overwrite: "auto" } })
      .to(front, { opacity: 0, duration: WORK_BG_FADE_S }, 0)
      .to(back, { opacity, duration: WORK_BG_FADE_S }, 0)
      .eventCallback("onComplete", () => {
        frontRef.current = frontRef.current === "a" ? "b" : "a";
        if (front === layerA) setLayerAOpacity(0);
        else if (back === layerA) setLayerAOpacity(opacity);
      });
  }, []);

  const handleImageLoad = useCallback(() => {
    pendingFadeRef.current?.();
    pendingFadeRef.current = null;
  }, []);

  const crossfadeTo = useCallback(
    (slug: string | null, immediate = false) => {
      const layerA = layerARef.current;
      const layerB = layerBRef.current;
      if (!layerA || !layerB) return;

      const thumb = projectThumbUrl(projects, slug);
      const opacity = thumb ? 1 : 0;

      pendingFadeRef.current = null;

      if (!thumb) {
        runFade(0, immediate);
        return;
      }

      const backKey = frontRef.current === "a" ? "b" : "a";
      const currentBackUrl = backKey === "a" ? urlARef.current : urlBRef.current;

      const finish = () => runFade(opacity, immediate);

      if (currentBackUrl === thumb) {
        finish();
        return;
      }

      pendingFadeRef.current = finish;
      if (backKey === "a") {
        urlARef.current = thumb;
        setUrlA(thumb);
      } else {
        urlBRef.current = thumb;
        setUrlB(thumb);
      }

      void preloadWorkCover(thumb).then(handleImageLoad);
    },
    [handleImageLoad, projects, runFade],
  );

  useImperativeHandle(
    ref,
    () => ({
      setActive: (slug, immediate) => crossfadeTo(slug, immediate),
    }),
    [crossfadeTo],
  );

  useEffect(() => {
    projects.forEach((project) => {
      void preloadWorkCover(project.thumbnailUrl);
    });
  }, [projects]);

  useEffect(() => {
    return () => {
      tweenRef.current?.kill();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div
        ref={layerARef}
        className="absolute inset-0"
        style={{ opacity: layerAOpacity }}
      >
        {urlA ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getWorkCoverSrc(urlA)}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={handleImageLoad}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : null}
      </div>
      <div ref={layerBRef} className="absolute inset-0 opacity-0">
        {urlB ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getWorkCoverSrc(urlB)}
            alt=""
            draggable={false}
            decoding="async"
            onLoad={handleImageLoad}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : null}
      </div>
    </div>
  );
});
