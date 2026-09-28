import { getImageProps } from "next/image";

import { COVER_IMAGE_QUALITY } from "@/lib/imageQuality";

const COVER_SIZES = "100vw";

/** Responsive attributes shared by cover preloads and rendered cover images. */
export function getWorkCoverImageProps(assetUrl: string) {
  const { props } = getImageProps({
    alt: "",
    width: 1920,
    height: 1280,
    sizes: COVER_SIZES,
    quality: COVER_IMAGE_QUALITY,
    src: assetUrl,
  });
  return {
    src: typeof props.src === "string" ? props.src : assetUrl,
    srcSet: props.srcSet,
    sizes: props.sizes,
  };
}

export function preloadWorkCover(
  assetUrl: string,
  fetchPriority: "high" | "low" | "auto" = "auto",
): Promise<void> {
  const { src, srcSet, sizes } = getWorkCoverImageProps(assetUrl);
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
    img.fetchPriority = fetchPriority;
    if (srcSet) img.srcset = srcSet;
    if (sizes) img.sizes = sizes;
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
