"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

type InfoLineRevealProps = {
  text: string;
  className?: string;
  /** Extra delay before this block’s line stagger starts (seconds). */
  groupDelay?: number;
  /** Time between each line inside this block (seconds). */
  lineStagger?: number;
};

export function InfoLineReveal({
  text,
  className,
  groupDelay = 0,
  lineStagger = 0.08,
}: InfoLineRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      root.textContent = text;
      return;
    }

    const words = text.trim().split(/\s+/);
    root.textContent = "";

    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.setAttribute("data-info-line-word", "");
      span.style.display = "inline";
      // Regular space so the browser creates a natural soft-wrap opportunity
      // between spans during the offsetTop measurement pass. \u00A0 (non-breaking
      // space) prevents wrapping, causing all words to land on the same offsetTop
      // and get grouped into a single un-breakable line.
      span.textContent = word + (i < words.length - 1 ? " " : "");
      root.appendChild(span);
    });

    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-info-line-word]"));
    if (spans.length === 0) return;

    const lines: HTMLSpanElement[][] = [];
    let currentLine: HTMLSpanElement[] = [];
    let lastTop: number | null = null;

    spans.forEach((span) => {
      const top = span.offsetTop;
      if (currentLine.length === 0) {
        currentLine.push(span);
        lastTop = top;
        return;
      }
      if (lastTop !== null && Math.abs(top - lastTop) < 0.5) {
        currentLine.push(span);
      } else {
        lines.push(currentLine);
        currentLine = [span];
        lastTop = top;
      }
    });
    if (currentLine.length) lines.push(currentLine);

    root.textContent = "";
    const inners: HTMLElement[] = [];

    lines.forEach((lineSpans) => {
      const mask = document.createElement("div");
      mask.style.overflow = "hidden";
      mask.style.display = "block";
      const inner = document.createElement("span");
      inner.style.display = "block";
      inner.style.whiteSpace = "nowrap";
      inner.style.willChange = "transform";
      /** Extra line-box height so descenders are not clipped by the mask. */
      lineSpans.forEach((s) => inner.appendChild(s));
      mask.appendChild(inner);
      root.appendChild(mask);
      inners.push(inner);
    });

    const ctx = gsap.context(() => {
      gsap.set(inners, { yPercent: 108, opacity: 1 });
      gsap.to(inners, {
        yPercent: 0,
        duration: 0.82,
        ease: "power3.out",
        stagger: lineStagger,
        delay: 0.06 + groupDelay,
        immediateRender: false,
      });
    }, root);

    return () => {
      ctx.revert();
    };
  }, [text, groupDelay, lineStagger]);

  return (
    <div className="w-full min-w-0 overflow-visible">
      <noscript>
        <p className={className}>{text}</p>
      </noscript>
      <div ref={rootRef} className={className} />
    </div>
  );
}
