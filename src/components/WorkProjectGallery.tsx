"use client";

import Image from "next/image";
import { memo, useMemo } from "react";

import { COVER_IMAGE_QUALITY } from "@/lib/imageQuality";
import type { WorkProject } from "@/lib/works";

type WorkProjectGalleryProps = {
  project: WorkProject;
  lastImageRef?: React.Ref<HTMLDivElement>;
  onImageLayout?: () => void;
};

export const WorkProjectGallery = memo(function WorkProjectGallery({
  project,
  lastImageRef,
  onImageLayout,
}: WorkProjectGalleryProps) {
  const images = useMemo(
    () => project.images.filter((image) => image.url !== project.thumbnailUrl),
    [project.images, project.thumbnailUrl],
  );

  if (!images.length) return null;

  return (
    <div className="work-project-gallery flex w-full flex-col">
      {images.map((image, index) => {
        const isLast = index === images.length - 1;
        const hasDimensions = Boolean(image.width && image.height);

        return (
          <div
            key={image.id}
            ref={isLast ? lastImageRef : undefined}
            className="w-full bg-background"
            // Reserve aspect-ratio space so lazy images cause no layout shift.
            style={
              hasDimensions
                ? { aspectRatio: `${image.width} / ${image.height}` }
                : undefined
            }
          >
            {hasDimensions ? (
              <Image
                src={image.url}
                alt={image.name}
                width={image.width}
                height={image.height}
                quality={COVER_IMAGE_QUALITY}
                sizes="100vw"
                loading={index === 0 ? "eager" : "lazy"}
                className="block h-auto w-full"
                draggable={false}
                onLoad={onImageLayout}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt={image.name}
                className="block h-auto w-full"
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                onLoad={onImageLayout}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
