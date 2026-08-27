"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import {
  BOOK_COLLECTION_LABEL,
  BOOK_OVERLAY_DISMISSED_KEY,
  BOOK_TITLE,
  BOOK_URL,
  HOME_NAV_LANDING_DONE_EVENT,
} from "@/lib/homeBookOverlay";
import {
  HOME_GALLERY_INTRO_DONE_EVENT,
  HOME_GALLERY_INTRO_PENDING_ATTR,
} from "@/lib/homeGalleryIntro";

const OVERLAY_REVEAL_DELAY_S = 0.35;
const OVERLAY_FADE_IN_S = 0.52;
const OVERLAY_FADE_OUT_S = 0.34;

export function HomeBookOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const revealTweenRef = useRef<gsap.core.Tween | null>(null);
  const dismissTweenRef = useRef<gsap.core.Tween | null>(null);
  const revealDelayRef = useRef<gsap.core.Tween | null>(null);

  const dismiss = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      setIsMounted(false);
      return;
    }

    window.sessionStorage.setItem(BOOK_OVERLAY_DISMISSED_KEY, "1");
    revealTweenRef.current?.kill();
    dismissTweenRef.current?.kill();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setIsMounted(false);
      return;
    }

    dismissTweenRef.current = gsap.to(root, {
      autoAlpha: 0,
      duration: OVERLAY_FADE_OUT_S,
      ease: "power2.inOut",
      onComplete: () => {
        dismissTweenRef.current = null;
        setIsMounted(false);
      },
    });
  }, []);

  const reveal = useCallback(() => {
    if (window.sessionStorage.getItem(BOOK_OVERLAY_DISMISSED_KEY) === "1") return;
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let galleryDone = !document.body.hasAttribute(HOME_GALLERY_INTRO_PENDING_ATTR);
    let navDone = false;

    const tryReveal = () => {
      if (galleryDone && navDone) {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
          reveal();
          return;
        }
        revealDelayRef.current = gsap.delayedCall(OVERLAY_REVEAL_DELAY_S, reveal);
      }
    };

    const onGalleryDone = () => {
      galleryDone = true;
      tryReveal();
    };

    const onNavDone = () => {
      navDone = true;
      tryReveal();
    };

    window.addEventListener(HOME_GALLERY_INTRO_DONE_EVENT, onGalleryDone);
    window.addEventListener(HOME_NAV_LANDING_DONE_EVENT, onNavDone);

    return () => {
      window.removeEventListener(HOME_GALLERY_INTRO_DONE_EVENT, onGalleryDone);
      window.removeEventListener(HOME_NAV_LANDING_DONE_EVENT, onNavDone);
      revealDelayRef.current?.kill();
      revealDelayRef.current = null;
    };
  }, [reveal]);

  useLayoutEffect(() => {
    if (!isMounted) return;

    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return;

    revealTweenRef.current?.kill();
    dismissTweenRef.current?.kill();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(root, { autoAlpha: 1 });
      gsap.set(panel, { clearProps: "transform,opacity" });
      return;
    }

    gsap.set(root, { autoAlpha: 0 });
    gsap.set(panel, { autoAlpha: 0, y: 18 });

    revealTweenRef.current = gsap.to(root, {
      autoAlpha: 1,
      duration: OVERLAY_FADE_IN_S,
      ease: "power3.out",
    });

    gsap.to(panel, {
      autoAlpha: 1,
      y: 0,
      duration: OVERLAY_FADE_IN_S,
      ease: "power3.out",
      delay: 0.06,
    });
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, isMounted]);

  useEffect(() => {
    return () => {
      revealTweenRef.current?.kill();
      dismissTweenRef.current?.kill();
      revealDelayRef.current?.kill();
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div
      ref={rootRef}
      className="home-book-overlay fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(6,6,6,0.72)] px-[max(2vw,env(safe-area-inset-left))] py-[max(2.5%,env(safe-area-inset-top))] backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-book-overlay-title"
    >
      <div
        ref={panelRef}
        className="home-book-overlay-panel relative w-full max-w-[min(34rem,calc(100vw-4vw))] bg-background px-6 py-7 text-foreground sm:px-8 sm:py-9"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] border-0 bg-transparent p-0 leading-none text-foreground transition-opacity hover:opacity-70"
          aria-label="Close book announcement"
        >
          Close
        </button>

        <p className="m-0 text-[0.72rem] leading-none tracking-[0.12em] text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
          {BOOK_COLLECTION_LABEL}
        </p>

        <p
          id="home-book-overlay-title"
          className="mt-4 mb-0 whitespace-nowrap text-[1.35rem] leading-none font-semibold text-foreground sm:text-[1.55rem]"
        >
          Title: {BOOK_TITLE}
        </p>

        <div className="mt-8">
          <a
            href={BOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link leading-none text-foreground"
          >
            VIEW ON BLURB
          </a>
        </div>
      </div>
    </div>
  );
}
