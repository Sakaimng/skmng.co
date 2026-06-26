import { getImageProps } from "next/image";

import { COVER_IMAGE_QUALITY } from "@/lib/imageQuality";

const COVER_SIZES = "100vw";

/** Same optimized `src` the project hero `<Image priority>` uses. */
export function getWorkCoverSrc(assetUrl: string): string {
  const {
    props: { src },
  } = getImageProps({
    alt: "",
    width: 1920,
    height: 1280,
    sizes: COVER_SIZES,
    quality: COVER_IMAGE_QUALITY,
    src: assetUrl,
  });
  return typeof src === "string" ? src : assetUrl;
}

export function preloadWorkCover(assetUrl: string): Promise<void> {
  const src = getWorkCoverSrc(assetUrl);
  return new Promise((resolve) => {
    const img = new window.Image();
    const finish = () => {
      if (img.decode) {
        void img.decode().then(() => resolve()).catch(() => resolve());
        return;
      }
      resolve();
    };
    img.onload = finish;
    img.onerror = () => resolve();
    img.src = src;
    if (img.complete) finish();
  });
}

export function releaseWorkCoverAfterPaint(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    const afterPaint = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    };

    if (img.decode) {
      void img.decode().then(afterPaint).catch(afterPaint);
      return;
    }

    afterPaint();
  });
}
