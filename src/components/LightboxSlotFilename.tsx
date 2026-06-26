"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const FADE_OUT_S = 0.15;
const FADE_IN_S = 0.2;

/**
 * `targetLabel` updates on PREV/NEXT. The visible label stays on `displayedRef`
 * until the fade-out / fade-in transition completes.
 */
export function LightboxSlotFilename({ targetLabel }: { targetLabel: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const displayedRef = useRef("");
  const cancelRef = useRef<() => void>(() => {});
  const [ariaLabel, setAriaLabel] = useState("");

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;

    const commitLabel = (label: string) => {
      displayedRef.current = label;
      text.textContent = label;
      gsap.set(text, { autoAlpha: label ? 1 : 0, visibility: "visible" });
      setAriaLabel(label);
    };

    const abortToDisplayed = () => {
      const label = displayedRef.current;
      text.textContent = label;
      gsap.set(text, { autoAlpha: label ? 1 : 0, visibility: "visible" });
    };

    const runTransition = (target: string) => {
      if (!target) {
        displayedRef.current = "";
        setAriaLabel("");
        text.textContent = "";
        gsap.set(text, { autoAlpha: 0 });
        return;
      }

      if (target === displayedRef.current) {
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        commitLabel(target);
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => commitLabel(target),
      });

      tl.to(text, {
        autoAlpha: 0,
        duration: FADE_OUT_S,
        ease: "power1.inOut",
      })
        .call(() => {
          text.textContent = target;
        })
        .to(text, {
          autoAlpha: 1,
          duration: FADE_IN_S,
          ease: "power1.inOut",
        });

      cancelRef.current = () => {
        tl.kill();
        gsap.killTweensOf(text);
        abortToDisplayed();
      };
    };

    cancelRef.current();
    cancelRef.current = () => {};

    if (!targetLabel) {
      displayedRef.current = "";
      setAriaLabel("");
      text.textContent = "";
      gsap.set(text, { autoAlpha: 0 });
      return;
    }

    if (!displayedRef.current) {
      commitLabel(targetLabel);
      return;
    }

    runTransition(targetLabel);

    return () => cancelRef.current();
  }, [targetLabel]);

  return (
    <div
      className="archive-lightbox-filename"
      aria-label={ariaLabel || undefined}
    >
      <div className="archive-lightbox-filename-inner">
        <span ref={textRef} className="archive-lightbox-filename-settled" />
      </div>
    </div>
  );
}
