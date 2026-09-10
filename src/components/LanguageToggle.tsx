"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/locale";

const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  ja: "JA",
};

const DOT_SIZE_PX = 8;

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export function LanguageToggle({
  className = "",
  hidden = false,
}: {
  className?: string;
  hidden?: boolean;
}) {
  const { locale, messages, setLocale } = useLocale();
  const [hovered, setHovered] = useState(false);
  const actionRef = useRef<HTMLSpanElement>(null);
  const dotSlideRef = useRef<HTMLSpanElement>(null);
  const skipActionEnterRef = useRef(true);

  useLayoutEffect(() => {
    const slide = dotSlideRef.current;
    if (!slide) return;

    gsap.set(slide, { x: -DOT_SIZE_PX });
  }, []);

  useLayoutEffect(() => {
    const slide = dotSlideRef.current;
    if (!slide || isMobileViewport()) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf(slide);

    if (hovered) {
      gsap.to(slide, {
        x: 0,
        duration: reduceMotion ? 0 : 0.48,
        ease: "power2.out",
      });
      return;
    }

    gsap.to(slide, {
      x: -DOT_SIZE_PX,
      duration: reduceMotion ? 0 : 0.35,
      ease: "power2.in",
    });
  }, [hovered]);

  useLayoutEffect(() => {
    const el = actionRef.current;
    if (!el || skipActionEnterRef.current) {
      skipActionEnterRef.current = false;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.32,
        ease: "power2.out",
      },
    );
  }, [locale]);

  const toggle = () => {
    const next: Locale = locale === "en" ? "ja" : "en";
    const el = actionRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const commit = () => setLocale(next);

    if (!el || reduceMotion) {
      commit();
      return;
    }

    gsap.to(el, {
      opacity: 0,
      duration: 0.16,
      ease: "power2.in",
      onComplete: commit,
    });
  };

  return (
    <div
      className={`leading-none transition-opacity duration-300 ${hidden ? "opacity-0" : "opacity-100"} ${className}`}
    >
      <button
        type="button"
        className="language-toggle theme-toggle site-chrome-text pointer-events-auto inline-flex cursor-auto items-center gap-2 font-semibold uppercase leading-none tracking-[0.14em]"
        onClick={toggle}
        onPointerEnter={() => {
          if (!isMobileViewport()) setHovered(true);
        }}
        onPointerLeave={() => {
          if (!isMobileViewport()) setHovered(false);
        }}
        aria-label={
          locale === "en"
            ? messages.a11y.switchToJapanese
            : messages.a11y.switchToEnglish
        }
        aria-pressed={locale === "ja"}
      >
        <span className="relative inline-block leading-none">
          <span className="invisible" aria-hidden>
            JA
          </span>
          <span ref={actionRef} className="absolute inset-0 text-left leading-none">
            {LOCALE_LABEL[locale]}
          </span>
        </span>
        <span className="theme-toggle-dot-slot max-md:hidden" aria-hidden>
          <span ref={dotSlideRef} className="theme-toggle-dot-slide">
            <span className="theme-toggle-dot" />
          </span>
        </span>
      </button>
    </div>
  );
}
