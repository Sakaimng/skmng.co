/**
 * Uploads `public/assets` gallery files (see `src/data/assetNames.ts`) to Vercel Blob
 * and writes `src/data/blobAssetUrls.json` for use by `getAssetUrl`.
 *
 * Prerequisites:
 * - Blob store connected to this project (e.g. “skmngArchive” in Vercel → Storage)
 * - `BLOB_READ_WRITE_TOKEN` in the environment (.env.local is fine for local runs)
 *
 *   npx vercel env pull
 *   npm run upload:blob
 *
 * Commit `src/data/blobAssetUrls.json` so production serves from Blob without the token.
 * If you upload manually in the dashboard instead, run `npm run sync:blob` to refresh the manifest.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { put } from "@vercel/blob";

import { assetNames } from "../src/data/assetNames";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();

/** Path prefix inside the store (matches dashboard store name for easy browsing). */
const BLOB_PATH_PREFIX = "skmngArchive/gallery";

const MULTIPART_MIN_BYTES = 8 * 1024 * 1024;

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error(
      "Missing BLOB_READ_WRITE_TOKEN. Add it to the environment (e.g. from Vercel → Storage → Blob → .env.local).",
    );
    process.exit(1);
  }

  const assetsRoot = join(process.cwd(), "public/assets");
  const out: Record<string, string> = {};

  for (const name of assetNames) {
    const filePath = join(assetsRoot, name);
    const body = readFileSync(filePath);
    const pathname = `${BLOB_PATH_PREFIX}/${name}`;
    const blob = await put(pathname, body, {
      access: "public",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: body.byteLength >= MULTIPART_MIN_BYTES,
    });
    out[name] = blob.url;
    console.log(blob.url);
  }

  const outPath = join(process.cwd(), "src/data/blobAssetUrls.json");
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${outPath} (${Object.keys(out).length} URLs)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
