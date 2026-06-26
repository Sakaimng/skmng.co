import type { WorkProject } from "@/lib/works";
import { readWorkActiveSlug } from "@/lib/workNavEvents";
import { readWorkTitlePins, WORK_TITLE_PINS_EVENT } from "@/lib/workTitlePin";
import type { WorkTitlePins } from "@/lib/workTitlePin";

export const WORK_CHROME_STORE_EVENT = "skmng:work-chrome-store-change";

export type WorkChromeRegistry = {
  projects: WorkProject[];
  interactive: boolean;
  clipHidden: boolean;
  titleRevealInProgress: boolean;
};

export type WorkChromeSnapshot = {
  pins: WorkTitlePins | null;
  activeSlug: string | null;
  registry: WorkChromeRegistry;
};

const defaultRegistry: WorkChromeRegistry = {
  projects: [],
  interactive: false,
  clipHidden: false,
  titleRevealInProgress: false,
};

export const WORK_CHROME_SERVER_SNAPSHOT: WorkChromeSnapshot = {
  pins: null,
  activeSlug: null,
  registry: defaultRegistry,
};

/** Updated synchronously — not part of the external-store snapshot. */
export const workChromeCallbacks = {
  onSelect: null as ((slug: string) => void) | null,
  onHover: null as ((slug: string | null) => void) | null,
};

let registry: WorkChromeRegistry = defaultRegistry;

let cachedSnapshot: WorkChromeSnapshot = WORK_CHROME_SERVER_SNAPSHOT;
let cachedSnapshotKey = "";

function pinsFingerprint(pins: WorkTitlePins | null): string {
  if (!pins) return "";
  return Object.entries(pins)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, pin]) => `${slug}:${pin.top},${pin.left}`)
    .join("|");
}

function buildSnapshotKey(
  pins: WorkTitlePins | null,
  activeSlug: string | null,
  reg: WorkChromeRegistry,
): string {
  return [
    pinsFingerprint(pins),
    activeSlug ?? "",
    reg.interactive ? "1" : "0",
    reg.clipHidden ? "1" : "0",
    reg.titleRevealInProgress ? "1" : "0",
    String(reg.projects.length),
  ].join("::");
}

function registryChanged(
  prev: WorkChromeRegistry,
  next: WorkChromeRegistry,
): boolean {
  return (
    prev.projects !== next.projects ||
    prev.interactive !== next.interactive ||
    prev.clipHidden !== next.clipHidden ||
    prev.titleRevealInProgress !== next.titleRevealInProgress
  );
}

export function syncWorkChromeRegistry(
  patch: Partial<WorkChromeRegistry> & {
    onSelect?: ((slug: string) => void) | null;
    onHover?: ((slug: string | null) => void) | null;
  },
) {
  if (patch.onSelect !== undefined) {
    workChromeCallbacks.onSelect = patch.onSelect;
  }
  if (patch.onHover !== undefined) {
    workChromeCallbacks.onHover = patch.onHover;
  }

  const { onSelect: _onSelect, onHover: _onHover, ...registryPatch } = patch;
  const next = { ...registry, ...registryPatch };
  if (!registryChanged(registry, next)) return;

  registry = next;
  cachedSnapshotKey = "";
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WORK_CHROME_STORE_EVENT));
  }
}

export function resetWorkChromeRegistry() {
  workChromeCallbacks.onSelect = null;
  workChromeCallbacks.onHover = null;

  if (
    registry === defaultRegistry &&
    cachedSnapshot === WORK_CHROME_SERVER_SNAPSHOT
  ) {
    return;
  }

  registry = defaultRegistry;
  cachedSnapshotKey = "";
  cachedSnapshot = WORK_CHROME_SERVER_SNAPSHOT;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WORK_CHROME_STORE_EVENT));
  }
}

export function getWorkChromeSnapshot(): WorkChromeSnapshot {
  const pins = readWorkTitlePins();
  const activeSlug = readWorkActiveSlug();
  const key = buildSnapshotKey(pins, activeSlug, registry);

  if (key === cachedSnapshotKey) return cachedSnapshot;

  cachedSnapshotKey = key;
  cachedSnapshot = { pins, activeSlug, registry };
  return cachedSnapshot;
}

export function subscribeWorkChromeStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(WORK_CHROME_STORE_EVENT, onStoreChange);
  window.addEventListener(WORK_TITLE_PINS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(WORK_CHROME_STORE_EVENT, onStoreChange);
    window.removeEventListener(WORK_TITLE_PINS_EVENT, onStoreChange);
  };
}
