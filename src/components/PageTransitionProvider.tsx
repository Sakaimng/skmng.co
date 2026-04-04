"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";

declare global {
  interface Window {
    __skmngSiteBooted?: boolean;
  }
}

type PageTransitionContextValue = {
  navigate: (href: string) => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

export function PageTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(pathname);
  const navigatingRef = useRef(false);

  const getPageTargets = useCallback(() => {
    return Array.from(
      document.querySelectorAll<HTMLElement>("[data-page-content]"),
    );
  }, []);

  useEffect(() => {
    window.__skmngSiteBooted = true;
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (currentPathRef.current !== pathname) {
      currentPathRef.current = pathname;
      const targets = getPageTargets();

      if (targets.length) {
        gsap.fromTo(
          targets,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.55,
            ease: "power2.out",
            clearProps: "opacity,visibility",
            onComplete: () => {
              navigatingRef.current = false;
            },
          },
        );
      } else {
        navigatingRef.current = false;
      }
    }
  }, [getPageTargets, pathname]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.style.opacity = "1";
      overlay.style.visibility = "visible";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (href === currentPathRef.current || navigatingRef.current) return;
      navigatingRef.current = true;
      const targets = getPageTargets();

      if (!targets.length) {
        router.push(href);
        return;
      }

      gsap.killTweensOf(targets);
      gsap.to(targets, {
        duration: 0.45,
        startAt: { autoAlpha: 1 },
        autoAlpha: 0,
        ease: "power2.inOut",
        onComplete: () => {
          router.push(href);
        },
      });
    },
    [getPageTargets, router],
  );

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
      <div
        ref={overlayRef}
        className="pointer-events-none fixed inset-0 z-[100] bg-black opacity-0 invisible"
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
