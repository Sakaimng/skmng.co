"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";

import { INFO_LEAVE_OUTRO_EVENT } from "@/components/PageTransitionProvider";

const INFO_LEAVE_OUTRO_S = 0.34;
const INFO_LEAVE_BLUR_PX = 18;

export function InfoExperience({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leaveTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const onLeaveOutro = (event: Event) => {
      const { onComplete } =
        (event as CustomEvent<{ onComplete?: () => void }>).detail ?? {};
      if (!onComplete) return;

      const root = rootRef.current;
      if (!root) {
        onComplete();
        return;
      }

      leaveTlRef.current?.kill();
      leaveTlRef.current = null;
      gsap.killTweensOf(root);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        gsap.to(root, {
          autoAlpha: 0,
          duration: 0.18,
          ease: "power2.in",
          onComplete,
        });
        return;
      }

      gsap.set(root, { filter: "blur(0px)", willChange: "filter, opacity" });

      leaveTlRef.current = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          gsap.set(root, { clearProps: "filter,willChange" });
          leaveTlRef.current = null;
          onComplete();
        },
      });

      leaveTlRef.current.to(
        root,
        {
          autoAlpha: 0,
          filter: `blur(${INFO_LEAVE_BLUR_PX}px)`,
          duration: INFO_LEAVE_OUTRO_S,
        },
        0,
      );
    };

    window.addEventListener(INFO_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
    return () => {
      window.removeEventListener(INFO_LEAVE_OUTRO_EVENT, onLeaveOutro as EventListener);
      leaveTlRef.current?.kill();
      leaveTlRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-page-content
      className="relative flex justify-center overflow-visible"
    >
      {children}
    </div>
  );
}
