export const THEME_STORAGE_KEY = "skmng-theme";

export const THEME_CHANGED_EVENT = "skmng:theme-changed";

export type ThemeMode = "dark";

export function getStoredTheme(): ThemeMode | null {
  return "dark";
}

export function applyTheme() {
  document.documentElement.classList.add("dark");
}

export function readThemeMode(): ThemeMode {
  return "dark";
}

export function setTheme(_mode?: ThemeMode, options?: { transition?: boolean }) {
  const root = document.documentElement;

  if (
    options?.transition &&
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    root.classList.add("theme-transition");
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 450);
  }

  applyTheme();
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
  } catch {
    /* ignore quota / private mode */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  }
}

export const themeInitScript = `(function(){try{document.documentElement.classList.add("dark");localStorage.setItem("${THEME_STORAGE_KEY}","dark");}catch(e){document.documentElement.classList.add("dark");}})();`;
