#!/usr/bin/env node
// Pre-optimize gallery JPGs so Next's runtime image optimizer (sharp) doesn't OOM dev.
// - Targets JPGs in public/assets/ above THRESHOLD_BYTES (archive + work project subdirs).
// - Moves original to ../raw-assets/<relpath> (preserves the file).
// - Writes resized JPG back to the same public/assets/ path.
// - Idempotent: re-running skips files already below threshold.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ASSETS = path.join(ROOT, "public", "assets");
const RAW_ASSETS = path.join(ROOT, "raw-assets");

const THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_WIDTH = 2400;                  // plenty for 1920px viewports + 2x DPR cap
const QUALITY = 82;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isJpg(p) {
  const ext = path.extname(p).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg";
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  if (process.env.SKIP_PREDEV === "1") {
    console.log("SKIP_PREDEV=1 — skipping asset optimization.");
    return;
  }

  try {
    await fs.access(PUBLIC_ASSETS);
  } catch {
    console.log("No public/assets — skipping optimization.");
    return;
  }

  let processed = 0;
  let savedBytes = 0;

  for await (const file of walk(PUBLIC_ASSETS)) {
    if (!isJpg(file)) continue;
    const stat = await fs.stat(file);
    if (stat.size < THRESHOLD_BYTES) continue;

    const rel = path.relative(PUBLIC_ASSETS, file);
    const rawDest = path.join(RAW_ASSETS, rel);
    await ensureDir(path.dirname(rawDest));

    // If a backup already exists, skip moving (we already processed this once
    // and the public file is somehow large again — still re-encode in place).
    try {
      await fs.access(rawDest);
    } catch {
      await fs.copyFile(file, rawDest);
    }

    const inputBuf = await fs.readFile(file);
    const image = sharp(inputBuf, { failOn: "none" }).rotate(); // honour EXIF orientation
    const meta = await image.metadata();
    const targetWidth = meta.width && meta.width > MAX_WIDTH ? MAX_WIDTH : meta.width;

    const outBuf = await image
      .resize({ width: targetWidth, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();

    await fs.writeFile(file, outBuf);
    const newStat = await fs.stat(file);

    processed += 1;
    savedBytes += stat.size - newStat.size;
    console.log(
      `optimized ${rel}: ${(stat.size / 1024 / 1024).toFixed(1)}MB -> ${(newStat.size / 1024 / 1024).toFixed(2)}MB`
    );
  }

  console.log(
    `\nDone. ${processed} file(s) processed, ~${(savedBytes / 1024 / 1024).toFixed(1)}MB saved.`
  );
  console.log(`Originals preserved in: ${RAW_ASSETS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
