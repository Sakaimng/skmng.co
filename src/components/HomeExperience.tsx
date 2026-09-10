"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import { HomeGallery } from "@/components/HomeGallery";
import { PreloaderLogoWordmark } from "@/components/PreloaderLogoWordmark";
import type { AssetImage } from "@/lib/assets";
import {
  HOME_BOOT_REVEAL_DELAY_S,
  PRELOADER_COUNTER_DELAY_S,
  PRELOADER_EXIT_SETTLE_S,
  PRELOADER_FADE_IN_S,
  dispatchHomePreloaderStart,
  resetHomePreloaderStartFlag,
} from "@/lib/homeBoot";
import {
  buildPreloaderLogoIntro,
  buildPreloaderLogoOutro,
} from "@/lib/preloaderLogoAnimation";
import { SCRAMBLE_CHARS } from "@/lib/scrambleChars";
const PRELOADER_DURATION_MS = 3600;
const COUNTER_DELAY_S = PRELOADER_COUNTER_DELAY_S;
const PRELOADER_COUNTER_DURATION_S = PRELOADER_DURATION_MS / 1000 - COUNTER_DELAY_S;
/** Same red as `.live-indicator-dot` (globals.css) */
const PRELOADER_COMPLETE_RED = "#e02020";
const SCRAMBLE_POOL = SCRAMBLE_CHARS;
const SCRAMBLE_FRAMES = 28;
const SITE_BOOT_STORAGE_KEY = "skmng-site-booted";
const SITE_BOOT_EVENT = "skmng:site-booted";
const PENDING_NAV_REVEAL_KEY = "skmng-pending-nav-reveal";
const HOME_PRELOADER_BYPASS_QUERY = "no-preloader";
const PRELOADER_IMAGE_WARMUP_COUNT = 3;
const PRELOADER_IMAGE_WARMUP_QUALITY = 80;

function formatPercent(value: number) {
  return `${String(value).padStart(3, "0")}%`;
}

// ─── Preloader ────────────────────────────────────────────────────────────────

function Preloader({
  onComplete,
  preloadImages,
}: {
  onComplete: () => void;
  preloadImages: AssetImage[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pctOverflowRef = useRef<HTMLDivElement>(null);
  const pctInnerRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const logoRevealRef = useRef<HTMLDivElement>(null);
  const introTlRef = useRef<gsap.core.Timeline | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [sequenceReady, setSequenceReady] = useState(false);

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    resetHomePreloaderStartFlag();
    root.removeAttribute("data-preloader-active");

    if (pctInnerRef.current) {
      gsap.set(pctInnerRef.current, { yPercent: 110, autoAlpha: 0 });
    }
    if (logoRevealRef.current) {
      gsap.set(logoRevealRef.current, { autoAlpha: 0 });
    }
    if (pctRef.current) {
      pctRef.current.textContent = formatPercent(0);
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.set(root, { autoAlpha: reduceMotion ? 1 : 0 });

    const beginSequence = () => {
      root.setAttribute("data-preloader-active", "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSequenceReady(true);
      dispatchHomePreloaderStart();
    };

    if (reduceMotion) {
      beginSequence();
      return;
    }

    gsap.to(root, {
      autoAlpha: 1,
      duration: PRELOADER_FADE_IN_S,
      ease: "power3.out",
      onComplete: beginSequence,
    });
  }, []);

  useLayoutEffect(() => {
    if (!sequenceReady) return;

    const logoRoot = logoRevealRef.current;
    if (!logoRoot) return;

    introTlRef.current?.kill();
    const introTl = buildPreloaderLogoIntro(logoRoot, {
      delay: COUNTER_DELAY_S,
      counterDuration: PRELOADER_COUNTER_DURATION_S,
    });
    introTlRef.current = introTl;

    return () => {
      introTlRef.current?.kill();
      introTlRef.current = null;
    };
  }, [sequenceReady]);

  // Counter 0->100% + completion sequence.
  useEffect(() => {
    if (!sequenceReady) return;

    const pctEl = pctRef.current;
    const root = rootRef.current;
    let cancelled = false;
    let scrambleRafId = 0;
    let postTl: ReturnType<typeof gsap.timeline> | null = null;

    const finishPreloader = () => {
      if (cancelled) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target = root ?? "[data-preloader-root]";
      gsap.to(target, {
        autoAlpha: 0,
        duration: reduceMotion ? 0.12 : 0.42,
        ease: "power2.inOut",
        onComplete: () => {
          if (cancelled) return;
          gsap.delayedCall(reduceMotion ? 0 : PRELOADER_EXIT_SETTLE_S, () => {
            onCompleteRef.current();
          });
        },
      });
    };

    const runScrambleOut = () => {
      if (!pctEl || cancelled) {
        finishPreloader();
        return;
      }
      const target = "100%";
      let frame = 0;
      const step = () => {
        if (cancelled) return;
        frame++;
        if (frame < SCRAMBLE_FRAMES) {
          pctEl.textContent = [...target]
            .map((ch) =>
              ch === "%" ? "%" : SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)]!,
            )
            .join("");
          const fadeStart = Math.floor(SCRAMBLE_FRAMES * 0.62);
          if (frame >= fadeStart) {
            const t = (frame - fadeStart) / (SCRAMBLE_FRAMES - fadeStart);
            pctEl.style.opacity = String(Math.max(0, 1 - t));
          }
          scrambleRafId = requestAnimationFrame(step);
        } else {
          pctEl.textContent = "";
          pctEl.style.opacity = "";
          gsap.set(pctEl, { clearProps: "opacity,color" });
          finishPreloader();
        }
      };
      scrambleRafId = requestAnimationFrame(step);
    };

    const playCompleteSequence = () => {
      if (!pctEl || cancelled) {
        finishPreloader();
        return;
      }
      pctEl.textContent = "100%";
      pctEl.style.color = PRELOADER_COMPLETE_RED;
      gsap.set(pctEl, { opacity: 1 });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.to(pctEl, {
          opacity: 0,
          duration: 0.2,
          onComplete: () => {
            if (!cancelled) finishPreloader();
          },
        });
        return;
      }

      postTl = gsap.timeline({ onComplete: runScrambleOut });
      const logoEl = logoRevealRef.current;
      if (logoEl) {
        const outro = buildPreloaderLogoOutro(logoEl);
        const letters = [...logoEl.querySelectorAll<SVGGElement>("[data-preloader-letter]")];
        if (letters.length > 0 && outro) {
          postTl.to(letters, outro, 0);
        } else if (outro) {
          postTl.to(logoEl, outro, 0);
        }
      }

      // 100% flicker — read as confirmation.
      const flickers = 4;
      for (let i = 0; i < flickers; i++) {
        postTl.to(pctEl, { opacity: 0.14, duration: 0.052, ease: "power1.inOut" });
        postTl.to(pctEl, { opacity: 1, duration: 0.052, ease: "power1.inOut" });
      }
    };

    if (pctInnerRef.current) {
      gsap.set(pctInnerRef.current, { yPercent: 110, autoAlpha: 0 });
      gsap.to(pctInnerRef.current, {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.52,
        ease: "power3.out",
        delay: COUNTER_DELAY_S,
      });
    }

    let lastPctValue = -1;
    const counter = { value: 0 };
    const tween = gsap.to(counter, {
      value: 100,
      duration: PRELOADER_COUNTER_DURATION_S,
      delay: COUNTER_DELAY_S,
      ease: "none",
      onUpdate() {
        const v = Math.min(100, Math.floor(counter.value / 10) * 10);
        if (v === lastPctValue) return;
        lastPctValue = v;
        if (pctEl) {
          pctEl.textContent = formatPercent(v);
          if (v < 100) pctEl.style.color = "";
        }
      },
      onComplete() {
        if (cancelled) return;
        playCompleteSequence();
      },
    });

    return () => {
      cancelled = true;
      tween.kill();
      postTl?.kill();
      cancelAnimationFrame(scrambleRafId);
    };
  }, [sequenceReady]);

  return (
    <div
      ref={rootRef}
      data-preloader-root
      className="fixed inset-0 z-[120] bg-background overflow-hidden max-md:overflow-visible md:overflow-x-visible md:overflow-y-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading site"
    >
      <div className="pointer-events-none absolute inset-0 h-full min-h-0 max-md:relative max-md:block md:grid md:grid-cols-[1fr_1fr_1fr] md:items-center md:gap-x-0 md:px-0 md:py-0">
        {/* Off-screen image warmup so the gallery hero is decoded before reveal. */}
        <div
          className="pointer-events-none absolute left-0 top-0 size-px overflow-hidden opacity-0"
          aria-hidden
        >
          {preloadImages.map((image, index) => (
            <span key={image.id} className="relative block size-px">
              <Image
                src={image.url}
                alt=""
                fill
                quality={PRELOADER_IMAGE_WARMUP_QUALITY}
                sizes="(max-width: 767px) 100vw, 33vw"
                loading="eager"
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
              />
            </span>
          ))}
        </div>

        <div className="navMLeft hidden min-h-0 items-center md:flex md:min-w-0">
          <span className="invisible select-none whitespace-nowrap" aria-hidden>
            SKMNG
          </span>
        </div>

        <div className="max-md:absolute max-md:inset-0 max-md:z-0 max-md:flex max-md:items-center max-md:justify-center max-md:overflow-visible md:relative md:z-auto md:col-start-2 md:flex md:h-screen md:min-h-0 md:min-w-0 md:w-full md:items-center md:justify-center md:overflow-visible md:py-0">
          <div ref={logoRevealRef} className="preloader-logo-stage relative shrink-0">
            <PreloaderLogoWordmark className="block h-full w-full" />
          </div>
        </div>

        <div className="relative z-[5] max-md:absolute max-md:inset-x-0 max-md:top-1/2 max-md:z-[2] max-md:-translate-y-1/2 md:col-start-3 md:min-w-0 md:flex md:justify-self-start md:self-center">
          <div className="max-md:grid max-md:w-full max-md:grid-cols-[1fr_1fr_1fr] max-md:items-center md:contents">
            <div className="max-md:col-start-3 max-md:flex max-md:justify-end max-md:pr-[2vw] md:contents">
              <div ref={pctOverflowRef} className="overflow-hidden" data-preloader-counter>
                <div
                  ref={pctInnerRef}
                  className="inline-block uppercase leading-none text-foreground"
                >
                  <span ref={pctRef} className="inline-block uppercase leading-none">
                    000%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── HomeExperience ───────────────────────────────────────────────────────────

// Extend window type for our SPA-nav sentinel
declare global {
  interface Window { _skmngHomeRendered?: true }
}

function resolveInitialBootState(): "pending" | "preloader" | "content" {
  if (typeof window === "undefined") return "pending";
  if (new URLSearchParams(window.location.search).has(HOME_PRELOADER_BYPASS_QUERY)) {
    return "content";
  }
  if (window._skmngHomeRendered) return "content";
  return "pending";
}

export function HomeExperience({ images }: { images: AssetImage[] }) {
  // "pending"   — initial state, matches SSR (no hydration mismatch)
  // "preloader" — first mount (landing / refresh): show preloader
  // "content"   — SPA navigation back home: show content immediately
  const [bootState, setBootState] = useState(resolveInitialBootState);
  const [preloaderDone, setPreloaderDone] = useState(false);

  // useLayoutEffect runs synchronously before the browser paints, so the user
  // never sees the blank "pending" frame. It's also committed (not discarded by
  // React concurrent rendering), which means it's immune to the concurrent-mode
  // render-retry problem that broke the previous module-level variable approach.
  //
  // window._skmngHomeRendered resets on every page load (fresh window) and
  // persists across SPA navigation (window object survives client routing).
  useLayoutEffect(() => {
    const search = window.location.search;
    const skipPreloader = new URLSearchParams(search).has(HOME_PRELOADER_BYPASS_QUERY);

    if (skipPreloader) {
      window._skmngHomeRendered = true;
      // Synchronous layout update keeps the preloader/content branch settled before paint.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBootState("content");
      return;
    }

    if (!window._skmngHomeRendered) {
      window._skmngHomeRendered = true;
      setBootState((state) => (state === "pending" ? "preloader" : state));
      return;
    }

    setBootState((state) => (state === "pending" ? "content" : state));
  }, []);

  const shouldPlayPreloader = bootState === "preloader" && !preloaderDone;
  const showContent = bootState === "content" || preloaderDone;
  const preloaderWarmupImages = images.slice(0, PRELOADER_IMAGE_WARMUP_COUNT);

  useEffect(() => {
    if (!shouldPlayPreloader) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
    };
  }, [shouldPlayPreloader]);

  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = () => {
      window.sessionStorage.setItem(SITE_BOOT_STORAGE_KEY, "1");
      window.sessionStorage.setItem(PENDING_NAV_REVEAL_KEY, "1");
      window.dispatchEvent(new Event(SITE_BOOT_EVENT));
    };

    if (reduceMotion) {
      reveal();
      return;
    }

    gsap.delayedCall(HOME_BOOT_REVEAL_DELAY_S, reveal);
  }, []);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {shouldPlayPreloader && (
        <Preloader
          onComplete={handlePreloaderComplete}
          preloadImages={preloaderWarmupImages}
        />
      )}
      {showContent && (
        <div data-page-content>
          <HomeGallery images={images} animateIntro />
        </div>
      )}
    </main>
  );
}
