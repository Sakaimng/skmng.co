"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

import { HomeGallery } from "@/components/HomeGallery";
import { SiteHeader } from "@/components/SiteHeader";
import type { AssetImage } from "@/lib/assets";

declare global {
  interface Window {
    __skmngSiteBooted?: boolean;
  }
}

const PRELOADER_DURATION_MS = 3000;

function formatPercent(value: number) {
  return `${String(value).padStart(3, "0")}%`;
}

function scramblePercent(value: number, progress: number) {
  const target = formatPercent(value).split("");
  const lockCount = Math.max(1, Math.floor(progress * 3));

  return target
    .map((char, index) => {
      if (char === "%") return "%";
      if (index < lockCount) return char;
      return String(Math.floor(Math.random() * 10));
    })
    .join("");
}

function Preloader({ onComplete }: { onComplete: () => void }) {
  const [text, setText] = useState("000%");
  const charsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const counter = { value: 0 };
    const tween = gsap.to(counter, {
      value: 100,
      duration: PRELOADER_DURATION_MS / 1000,
      ease: "none",
    });

    tween.eventCallback("onUpdate", () => {
      const value = Math.floor(counter.value);
      const progress = value / 100;
      setText(scramblePercent(value, progress));
    });

    tween.eventCallback("onComplete", () => {
      setText("100%");
      gsap.to("[data-preloader-root]", {
        autoAlpha: 0,
        duration: 0.55,
        ease: "power2.out",
        onComplete,
      });
    });

    const ctx = gsap.context(() => {
      const chars = charsRef.current?.querySelectorAll<HTMLElement>(".preloader-char");
      if (!chars?.length) return;

      gsap.fromTo(
        chars,
        { autoAlpha: 0, yPercent: 115 },
        {
          autoAlpha: 1,
          yPercent: 0,
          duration: 0.75,
          ease: "power3.out",
          stagger: 0.04,
        },
      );
    }, charsRef);

    return () => {
      tween.kill();
      ctx.revert();
    };
  }, [onComplete]);

  const chars = useMemo(() => text.split(""), [text]);

  return (
    <div
      data-preloader-root
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black"
    >
      <div ref={charsRef} className="flex overflow-hidden text-white">
        {chars.map((char, index) => (
          <span key={`${char}-${index}`} className="preloader-char inline-block whitespace-pre">
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HomeExperience({ images }: { images: AssetImage[] }) {
  const [shouldPlayPreloader] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.__skmngSiteBooted;
  });
  const [preloaderDone, setPreloaderDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.__skmngSiteBooted);
  });

  return (
    <main className="relative min-h-screen bg-black text-white">
      {!preloaderDone && shouldPlayPreloader && (
        <Preloader onComplete={() => setPreloaderDone(true)} />
      )}

      {preloaderDone && (
        <>
          <SiteHeader currentPath="/" animateOnMount={shouldPlayPreloader} />
          <div data-page-content>
            <HomeGallery
              images={images}
              animateIntro
            />
          </div>
        </>
      )}
    </main>
  );
}
