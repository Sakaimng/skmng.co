"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";

import {
  ARCHIVE_LIGHTBOX_IMAGE_QUERY,
  shouldSkipArchiveEnterAnimations,
} from "@/lib/archiveLightboxLink";
import {
  applyHardRefreshOutroInstant,
  isHardRefreshOutroRunning,
  isReloadKeyboardEvent,
  runHardRefreshOutro,
} from "@/lib/hardRefreshOutro";
import { getSiteChromeTargets, hideSiteChrome } from "@/lib/siteChrome";
import {
  WORK_RETURN_DIRECTORY_EVENT,
  consumeWorkProjectEnter,
  consumeWorkReturnEnter,
} from "@/lib/workNavEvents";

const SITE_BOOT_STORAGE_KEY = "skmng-site-booted";
const HOME_LIGHTBOX_LEAVE_FADE_S = 0.28;
const HOME_LEAVE_CONTENT_FADE_S = 0.28;

/** `ArchiveExperience` runs the same clip + number outro as lightbox-open, then calls `detail.onComplete`. */
export const ARCHIVE_LEAVE_OUTRO_EVENT = "skmng:archive-leave-outro";

/** `HomeGallery` clips visible cards upward, then calls `detail.onComplete`. */
export const HOME_LEAVE_OUTRO_EVENT = "skmng:home-leave-outro";

/** `InfoExperience` blurs + fades page content, then calls `detail.onComplete`. */
export const INFO_LEAVE_OUTRO_EVENT = "skmng:info-leave-outro";

/** `WorkExperience` blurs + fades page content, then calls `detail.onComplete`. */
export const WORK_LEAVE_OUTRO_EVENT = "skmng:work-leave-outro";

export type HomeLeaveTransition = "default" | "archive-lightbox";

type LeaveOutroDetail = {
  onComplete?: () => void;
  transition?: HomeLeaveTransition;
};

type PageTransitionContextValue = {
  navigate: (href: string) => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

function getPageTargets() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-page-content]:not([data-work-leaving="1"])',
    ),
  );
}

export function PageTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(pathname);
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (pathname !== "/") {
      window.sessionStorage.setItem(SITE_BOOT_STORAGE_KEY, "1");
    }
  }, [pathname]);

  useLayoutEffect(() => {
    if (currentPathRef.current === pathname) return;

    currentPathRef.current = pathname;

    if (!navigatingRef.current) return;

    const targets = getPageTargets();
    if (!targets.length) {
      navigatingRef.current = false;
      return;
    }

    // Home runs GSAP landing on gallery cards inside `[data-page-content]`. Child
    // layout effects run before this parent effect — `killTweensOf` on the wrapper
    // would tear down those tweens immediately after they start.
    if (pathname !== "/") {
      gsap.killTweensOf(targets);
    }

    if (pathname === "/") {
      gsap.set(targets, { autoAlpha: 1 });
      navigatingRef.current = false;
      return;
    }

    if (pathname.startsWith("/archive")) {
      const hasLightboxQuery =
        typeof window !== "undefined" &&
        new URL(window.location.href).searchParams.has(ARCHIVE_LIGHTBOX_IMAGE_QUERY);
      const skipArchiveEnter =
        shouldSkipArchiveEnterAnimations() || hasLightboxQuery;

      if (skipArchiveEnter) {
        gsap.killTweensOf(targets);
        gsap.set(targets, { autoAlpha: 1 });
        hideSiteChrome();
        navigatingRef.current = false;
        return;
      }
    }

    if (/^\/work\/[^/]+$/.test(pathname) && consumeWorkProjectEnter()) {
      gsap.killTweensOf(targets);
      gsap.set(targets, { autoAlpha: 1 });
      navigatingRef.current = false;
      return;
    }

    if (pathname === "/work" && consumeWorkReturnEnter()) {
      gsap.killTweensOf(targets);
      gsap.set(targets, { autoAlpha: 1 });
      navigatingRef.current = false;
      return;
    }

    gsap.fromTo(
      targets,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: 0.22,
        ease: "power2.out",
        clearProps: "opacity,visibility",
        onComplete: () => {
          navigatingRef.current = false;
        },
      },
    );
  }, [pathname]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    gsap.set(overlay, { autoAlpha: 0 });
    return () => {
      gsap.killTweensOf(overlay);
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const pageShell = pageShellRef.current;

    const onReloadKey = (event: KeyboardEvent) => {
      if (!isReloadKeyboardEvent(event)) return;
      event.preventDefault();
      runHardRefreshOutro(pageShell, overlay, () => {
        window.location.reload();
      });
    };

    const onPageHide = () => {
      if (isHardRefreshOutroRunning()) return;
      applyHardRefreshOutroInstant(pageShell, overlay);
    };

    window.addEventListener("keydown", onReloadKey);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("keydown", onReloadKey);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (href === currentPathRef.current || navigatingRef.current) return;
      navigatingRef.current = true;
      const targets = getPageTargets();

      if (!targets.length) {
        navigatingRef.current = false;
        router.push(href);
        return;
      }

      if (currentPathRef.current === "/archive" && href !== "/archive") {
        window.dispatchEvent(
          new CustomEvent<LeaveOutroDetail>(ARCHIVE_LEAVE_OUTRO_EVENT, {
            detail: {
              onComplete: () => {
                const leaveTargets = getPageTargets();
                if (leaveTargets.length) {
                  gsap.killTweensOf(leaveTargets);
                  gsap.set(leaveTargets, { autoAlpha: 0 });
                }
                router.push(href);
              },
            },
          }),
        );
        return;
      }

      if (currentPathRef.current === "/" && href !== "/") {
        const fromHomeLightbox =
          href.startsWith("/archive") && shouldSkipArchiveEnterAnimations();

        window.dispatchEvent(
          new CustomEvent<LeaveOutroDetail>(HOME_LEAVE_OUTRO_EVENT, {
            detail: {
              transition: fromHomeLightbox ? "archive-lightbox" : "default",
              onComplete: () => {
                const leaveTargets = getPageTargets();
                const chrome = getSiteChromeTargets();

                if (fromHomeLightbox) {
                  gsap.killTweensOf([...leaveTargets, ...chrome]);
                  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    gsap.set(leaveTargets, { autoAlpha: 0 });
                    hideSiteChrome();
                    router.push(href);
                    return;
                  }

                  if (!leaveTargets.length && !chrome.length) {
                    hideSiteChrome();
                    router.push(href);
                    return;
                  }

                  const tl = gsap.timeline({
                    defaults: { ease: "power2.inOut" },
                    onComplete: () => {
                      hideSiteChrome();
                      router.push(href);
                    },
                  });

                  if (leaveTargets.length) {
                    tl.to(leaveTargets, {
                      autoAlpha: 0,
                      duration: HOME_LIGHTBOX_LEAVE_FADE_S,
                    }, 0);
                  }
                  if (chrome.length) {
                    tl.to(chrome, {
                      autoAlpha: 0,
                      duration: HOME_LIGHTBOX_LEAVE_FADE_S,
                    }, 0);
                  }
                  return;
                }

                if (leaveTargets.length) {
                  gsap.killTweensOf(leaveTargets);
                  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    gsap.set(leaveTargets, { autoAlpha: 0 });
                    router.push(href);
                    return;
                  }
                  gsap.to(leaveTargets, {
                    autoAlpha: 0,
                    duration: HOME_LEAVE_CONTENT_FADE_S,
                    ease: "power2.inOut",
                    onComplete: () => {
                      router.push(href);
                    },
                  });
                  return;
                }

                router.push(href);
              },
            },
          }),
        );
        return;
      }

      if (currentPathRef.current === "/info-contact" && href !== "/info-contact") {
        window.dispatchEvent(
          new CustomEvent<LeaveOutroDetail>(INFO_LEAVE_OUTRO_EVENT, {
            detail: {
              onComplete: () => {
                const leaveTargets = getPageTargets();
                if (leaveTargets.length) {
                  gsap.killTweensOf(leaveTargets);
                  gsap.set(leaveTargets, { autoAlpha: 0, filter: "none" });
                }
                router.push(href);
              },
            },
          }),
        );
        return;
      }

      if (
        /^\/work\/[^/]+$/.test(currentPathRef.current) &&
        href === "/work"
      ) {
        window.dispatchEvent(
          new CustomEvent<LeaveOutroDetail>(WORK_RETURN_DIRECTORY_EVENT, {
            detail: {
              onComplete: () => {
                router.push(href);
              },
            },
          }),
        );
        return;
      }

      if (
        currentPathRef.current.startsWith("/work") &&
        !href.startsWith("/work")
      ) {
        window.dispatchEvent(
          new CustomEvent<LeaveOutroDetail>(WORK_LEAVE_OUTRO_EVENT, {
            detail: {
              onComplete: () => {
                const leaveTargets = getPageTargets();
                if (leaveTargets.length) {
                  gsap.killTweensOf(leaveTargets);
                  gsap.set(leaveTargets, { autoAlpha: 0, filter: "none" });
                }
                router.push(href);
              },
            },
          }),
        );
        return;
      }

      gsap.killTweensOf(targets);
      gsap.to(targets, {
        duration: 0.18,
        startAt: { autoAlpha: 1 },
        autoAlpha: 0,
        ease: "power2.inOut",
        onComplete: () => {
          router.push(href);
        },
      });
    },
    [router],
  );

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <PageTransitionContext.Provider value={value}>
      <div ref={pageShellRef} data-page-shell className="min-h-full">
        {children}
      </div>
      <div
        ref={overlayRef}
        data-hard-refresh-overlay
        className="pointer-events-none fixed inset-0 z-[9999] bg-background opacity-0 invisible"
        aria-hidden
      />
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const context = useContext(PageTransitionContext);

  if (!context) {
    throw new Error("usePageTransition must be used within PageTransitionProvider");
  }

  return context;
}
