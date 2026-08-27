export type ThemeMode = "dark";

/** Site is locked to dark mode. */
export function readThemeMode(): ThemeMode {
  return "dark";
}

export function applyTheme() {
  const root = document.documentElement;
  root.classList.add("dark");
  root.dataset.theme = "dark";

  const body = document.body;
  if (body) {
    body.classList.remove("theme-light");
    body.classList.add("theme-dark");
  }
}

export const themeInitScript =
  '(function(){try{var r=document.documentElement;r.classList.add("dark");r.dataset.theme="dark";var b=document.body;if(b){b.classList.remove("theme-light");b.classList.add("theme-dark");}}catch(e){document.documentElement.classList.add("dark");document.documentElement.dataset.theme="dark";}})();';
