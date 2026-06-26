export const LOCALE_STORAGE_KEY = "skmng-locale";

export const LOCALE_CHANGED_EVENT = "skmng:locale-changed";

export type Locale = "en" | "ja";

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === "en" || value === "ja" ? value : null;
  } catch {
    return null;
  }
}

export function readLocale(): Locale {
  if (typeof document === "undefined") return "en";
  return document.documentElement.dataset.locale === "ja" ? "ja" : "en";
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

export function setLocale(locale: Locale) {
  applyLocale(locale);
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT));
}

export const localeInitScript = `(function(){try{var l=localStorage.getItem("${LOCALE_STORAGE_KEY}");if(l==="ja"){document.documentElement.lang="ja";document.documentElement.dataset.locale="ja";}else{document.documentElement.lang="en";document.documentElement.dataset.locale="en";}}catch(e){document.documentElement.lang="en";document.documentElement.dataset.locale="en";}})();`;
