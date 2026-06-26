"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import { useLocale } from "@/components/LocaleProvider";

type ContactEmailCopyProps = {
  email: string;
};

export function ContactEmailCopy({ email }: ContactEmailCopyProps) {
  const { messages } = useLocale();
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    gsap.killTweensOf(button);
    gsap.set(button, { clearProps: "opacity,transform" });
    button.querySelectorAll<HTMLElement>("*").forEach((el) => {
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "opacity,transform" });
    });
  }, []);

  const handleCopy = async () => {
    clearTimer();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        title={messages.a11y.copyEmail}
        onClick={handleCopy}
        className="contact-link block w-fit cursor-pointer text-left leading-none text-inherit text-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="inline-block leading-none">{email}</span>
      </button>
      {copied ? (
        <p
          role="status"
          className="mt-[9px] leading-none tracking-[0.12em] text-foreground"
          aria-live="polite"
        >
          {messages.info.copied}
        </p>
      ) : null}
    </div>
  );
}
