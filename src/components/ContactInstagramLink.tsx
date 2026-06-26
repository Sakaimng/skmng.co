"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

export function ContactInstagramLink({
  href,
  handle,
}: {
  href: string;
  handle: string;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const link = linkRef.current;
    if (!link) return;
    gsap.killTweensOf(link);
    gsap.set(link, { clearProps: "opacity,transform" });
    link.querySelectorAll<HTMLElement>("*").forEach((el) => {
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "opacity,transform" });
    });
  }, []);

  return (
    <a
      ref={linkRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Instagram @${handle}`}
      className="contact-link inline-block cursor-pointer leading-none"
    >
      <span className="inline-block leading-none">@{handle}</span>
    </a>
  );
}
