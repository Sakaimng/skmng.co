"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { usePageTransition } from "@/components/PageTransitionProvider";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
  { href: "/info-contact", label: "Info & Contact" },
];

function CharLabel({ label }: { label: string }) {
  const displayLabel = label.toUpperCase();

  return (
    <span aria-hidden className="inline-flex">
      {displayLabel.split("").map((char, index) => (
        <span
          key={`${label}-${index}`}
          className="nav-char inline-block whitespace-pre"
        >
          {char}
        </span>
      ))}
    </span>
  );
}

export function SiteHeader({
  currentPath,
  animateOnMount = false,
}: {
  currentPath: string;
  animateOnMount?: boolean;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const { navigate } = usePageTransition();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const chars = headerRef.current?.querySelectorAll<HTMLElement>(".nav-char");

      if (!chars?.length) return;

      if (!animateOnMount) {
        gsap.set(chars, { autoAlpha: 1, yPercent: 0 });
        return;
      }

      gsap.fromTo(
        chars,
        {
          autoAlpha: 0,
          yPercent: 110,
        },
        {
          autoAlpha: 1,
          yPercent: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.018,
        },
      );
    }, headerRef);

    return () => ctx.revert();
  }, [animateOnMount]);

  return (
    <header
      ref={headerRef}
      className="fixed inset-0 z-40 pointer-events-none"
    >
      <div className="absolute left-1/2 top-1/2 w-[95%] -translate-x-1/2 -translate-y-1/2 md:w-[90%]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="pointer-events-auto overflow-hidden text-white transition hover:text-white/80"
            aria-label="SKMNG Home"
          >
            <CharLabel label="SKMNG" />
          </button>

          <nav className="pointer-events-auto flex items-center justify-center gap-3 text-white/58 md:gap-8">
          {navItems.map((item) => {
            const active = currentPath === item.href;

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                aria-label={item.label}
                className={active ? "overflow-hidden text-white" : "overflow-hidden transition hover:text-white"}
              >
                <CharLabel label={item.label} />
              </button>
            );
          })}
          </nav>
        </div>
      </div>
    </header>
  );
}
