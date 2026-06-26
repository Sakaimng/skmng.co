"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";

type InfoStaggerProps = {
  children: ReactNode;
  className?: string;
  /** Seconds before the stagger starts (matches InfoLineReveal timing). */
  delay?: number;
};

export function InfoStagger({ children, className, delay = 0 }: InfoStaggerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const kids = Array.from(root.children) as HTMLElement[];
    if (!kids.length) return;

    const ctx = gsap.context(() => {
      gsap.set(kids, { y: 18, opacity: 0 });
      gsap.to(kids, {
        y: 0,
        opacity: 1,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.06,
        delay,
      });
    }, root);

    return () => {
      ctx.revert();
    };
  }, [delay]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
