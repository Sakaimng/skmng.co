/** Body flag while archive grid is interactive and not in hover-dim mode. */
export const ARCHIVE_CHROME_BRIGHT_ATTR = "data-archive-chrome-bright";

export function setArchiveChromeBright(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.body.setAttribute(ARCHIVE_CHROME_BRIGHT_ATTR, "1");
  } else {
    document.body.removeAttribute(ARCHIVE_CHROME_BRIGHT_ATTR);
  }
}

export function clearArchiveChromeBright() {
  setArchiveChromeBright(false);
}

export function syncArchiveChromeBright(gridRoot: HTMLElement | null | undefined) {
  if (!gridRoot) {
    clearArchiveChromeBright();
    return;
  }

  const bright =
    gridRoot.hasAttribute("data-archive-interactive") &&
    !gridRoot.hasAttribute("data-archive-dim");
  setArchiveChromeBright(bright);
}
