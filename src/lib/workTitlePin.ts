const WORK_TITLE_PINS_KEY = "skmng-work-title-pins";
export const WORK_TITLE_PINS_EVENT = "skmng:work-title-pins-change";

export type WorkTitlePin = {
  top: number;
  left: number;
};

export type WorkTitlePins = Record<string, WorkTitlePin>;

export function saveWorkTitlePins(pins: WorkTitlePins) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WORK_TITLE_PINS_KEY, JSON.stringify(pins));
  window.dispatchEvent(new CustomEvent(WORK_TITLE_PINS_EVENT));
}

export function readWorkTitlePins(): WorkTitlePins | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(WORK_TITLE_PINS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkTitlePins;
    if (!parsed || typeof parsed !== "object") return null;

    const pins: WorkTitlePins = {};
    for (const [slug, pin] of Object.entries(parsed)) {
      if (
        typeof pin?.top === "number" &&
        typeof pin?.left === "number"
      ) {
        pins[slug] = { top: pin.top, left: pin.left };
      }
    }

    return Object.keys(pins).length > 0 ? pins : null;
  } catch {
    return null;
  }
}

export function clearWorkTitlePins() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WORK_TITLE_PINS_KEY);
  window.dispatchEvent(new CustomEvent(WORK_TITLE_PINS_EVENT));
}
