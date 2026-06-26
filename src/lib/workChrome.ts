/** Body flag while the work section is active (/work and /work/[project]). */
export const WORK_CHROME_ATTR = "data-work-chrome";

export function setWorkChrome(active: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (active) {
    root.setAttribute(WORK_CHROME_ATTR, "1");
    document.body.setAttribute(WORK_CHROME_ATTR, "1");
  } else {
    root.removeAttribute(WORK_CHROME_ATTR);
    document.body.removeAttribute(WORK_CHROME_ATTR);
  }
}

export function clearWorkChrome() {
  setWorkChrome(false);
}
