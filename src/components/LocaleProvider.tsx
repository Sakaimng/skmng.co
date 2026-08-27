"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { getMessages, type Messages } from "@/lib/i18n/messages";
import {
  LOCALE_CHANGED_EVENT,
  readLocale,
  setLocale as persistLocale,
  type Locale,
} from "@/lib/locale";

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function subscribeLocale(onStoreChange: () => void) {
  window.addEventListener(LOCALE_CHANGED_EVENT, onStoreChange);
  return () => window.removeEventListener(LOCALE_CHANGED_EVENT, onStoreChange);
}

function getServerLocaleSnapshot(): Locale {
  return "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    readLocale,
    getServerLocaleSnapshot,
  );

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      messages: getMessages(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
