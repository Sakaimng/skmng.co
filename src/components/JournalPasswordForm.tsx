"use client";

import { useActionState, useLayoutEffect, useRef, useState } from "react";

import { unlockJournalAction } from "@/app/journal/unlockAction";
import { useLocale } from "@/components/LocaleProvider";

const ERROR_HOLD_MS = 1500;
const ERROR_FADE_MS = 400;

export function JournalPasswordForm({ nextPath }: { nextPath: string }) {
  const { messages } = useLocale();
  const [state, formAction, pending] = useActionState(unlockJournalAction, null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimersRef = useRef<number[]>([]);
  const [errorPhase, setErrorPhase] = useState<"idle" | "show" | "fade">("idle");

  const clearErrorTimers = () => {
    for (const id of errorTimersRef.current) window.clearTimeout(id);
    errorTimersRef.current = [];
  };

  useLayoutEffect(() => {
    if (!state?.error) return;
    const input = inputRef.current;
    if (input) {
      input.value = "";
      input.focus();
    }
    setErrorPhase("show");
    clearErrorTimers();
    errorTimersRef.current = [
      window.setTimeout(() => setErrorPhase("fade"), ERROR_HOLD_MS),
      window.setTimeout(() => setErrorPhase("idle"), ERROR_HOLD_MS + ERROR_FADE_MS),
    ];
    return () => {
      clearErrorTimers();
    };
  }, [state]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const align = () => {
      const input = inputRef.current;
      const header = document.querySelector<HTMLElement>(".site-header-grid");
      if (!input || !header || header.getBoundingClientRect().height === 0) return false;

      const desktop = window.matchMedia("(min-width: 768px)").matches;
      if (!desktop) {
        root.style.top = "";
        root.style.translate = "";
        root.style.transform = "";
        return true;
      }

      const headerTop = header.getBoundingClientRect().top;
      const delta = headerTop - input.getBoundingClientRect().top;
      root.style.translate = "none";
      root.style.transform = "none";
      root.style.top = `${root.getBoundingClientRect().top + delta}px`;
      return true;
    };

    let observer: MutationObserver | undefined;
    if (!align()) {
      observer = new MutationObserver(() => {
        if (align()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("resize", align);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", align);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-[max(2vw,env(safe-area-inset-left))] max-md:bottom-0 max-md:pb-[max(4.5rem,env(safe-area-inset-bottom))] md:top-1/2"
    >
      <form
        action={formAction}
        className="pointer-events-auto flex w-[min(100%,16rem)] flex-col items-center gap-3 text-center"
      >
        <input type="hidden" name="next" value={nextPath} />
        <div className="relative w-full">
          <input
            ref={inputRef}
            id="journal-password"
            name="password"
            type="password"
            aria-label={messages.journal.password}
            aria-invalid={errorPhase !== "idle"}
            data-error={errorPhase === "idle" ? undefined : "1"}
            autoFocus
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            onInput={(event) => {
              if (event.currentTarget.value === "") return;
              clearErrorTimers();
              setErrorPhase("idle");
            }}
            className="journal-password-input w-full border-0 border-b border-current bg-transparent p-0 pb-1 text-center leading-none text-foreground outline-none"
          />
          {errorPhase !== "idle" ? (
            <p
              className="journal-password-error"
              data-fade={errorPhase === "fade" ? "out" : undefined}
              role="alert"
            >
              {messages.journal.incorrectPassword}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="contact-link mt-1 leading-none text-foreground disabled:opacity-40"
        >
          {messages.journal.enter}
        </button>
      </form>
    </div>
  );
}
