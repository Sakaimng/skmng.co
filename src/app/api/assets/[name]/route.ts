import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";

import { assetFilePath } from "@/lib/assets";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

const transformedImageCache = new Map<string, BodyInit>();

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const filePath = assetFilePath(decodedName);

  try {
    const file = await readFile(filePath);
    const extension = path.extname(decodedName).toLowerCase();
    const url = new URL(request.url);
    const requestedWidth = Number(url.searchParams.get("w"));
    const requestedQuality = Number(url.searchParams.get("q"));
    const quality =
      Number.isFinite(requestedQuality) && requestedQuality > 0
        ? Math.min(90, Math.max(45, requestedQuality))
        : 78;

    let body: BodyInit = new Uint8Array(file);
    let contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

    if (Number.isFinite(requestedWidth) && requestedWidth > 0) {
      const width = Math.min(2200, Math.max(320, Math.round(requestedWidth)));
      const cacheKey = `${decodedName}:${width}:${quality}`;
      const cached = transformedImageCache.get(cacheKey);

      if (cached) {
        body = cached;
      } else {
        body = new Uint8Array(
          await sharp(file)
            .rotate()
            .resize({ width, withoutEnlargement: true, fastShrinkOnLoad: true })
            .webp({ quality, effort: 4 })
            .toBuffer(),
        );
        transformedImageCache.set(cacheKey, body);
      }
      contentType = "image/webp";
    }

    return new NextResponse(body, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
