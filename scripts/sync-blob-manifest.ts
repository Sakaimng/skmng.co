/**
 * Lists blobs in your Vercel Blob store and writes `src/data/blobAssetUrls.json`
 * for every name in `src/data/assetNames.ts`, matched by filename (last path segment).
 *
 * Use this after uploading files manually in the dashboard or elsewhere.
 *
 *   npm run sync:blob
 *
 * Optional: `BLOB_LIST_PREFIX` — only list pathnames starting with this string
 * (e.g. `skmngArchive/gallery/`). If unset, lists the whole store (paginated).
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { list } from "@vercel/blob";

import { assetNames } from "../src/data/assetNames";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();

type BlobRow = { url: string; pathname: string };

async function listAllBlobs(token: string, prefix: string | undefined) {
  const blobs: BlobRow[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({
      token,
      limit: 1000,
      prefix: prefix || undefined,
      cursor,
    });
    for (const b of result.blobs) {
      blobs.push({ url: b.url, pathname: b.pathname });
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return blobs;
}

function basename(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? pathname;
}

function pickUrl(candidates: BlobRow[], name: string) {
  if (candidates.length === 1) return candidates[0].url;
  const lower = name.toLowerCase();
  const gallery = candidates.filter((c) =>
    c.pathname.toLowerCase().includes("gallery"),
  );
  const pool = gallery.length ? gallery : candidates;
  const exact = pool.find((c) => basename(c.pathname) === name);
  if (exact) return exact.url;
  return pool[0].url;
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error(
      "Missing BLOB_READ_WRITE_TOKEN (e.g. in .env.local or shell).",
    );
    process.exit(1);
  }

  const prefix = process.env.BLOB_LIST_PREFIX?.trim() || undefined;
  if (prefix) {
    console.log(`Listing with prefix: ${prefix}`);
  } else {
    console.log("Listing entire store (no BLOB_LIST_PREFIX)…");
  }

  const all = await listAllBlobs(token, prefix);
  console.log(`Found ${all.length} blob(s).`);

  const wanted = new Set<string>(assetNames);
  const byName = new Map<string, BlobRow[]>();

  for (const row of all) {
    const base = basename(row.pathname);
    if (!wanted.has(base)) continue;
    const listFor = byName.get(base) ?? [];
    listFor.push(row);
    byName.set(base, listFor);
  }

  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of assetNames) {
    const candidates = byName.get(name);
    if (!candidates?.length) {
      missing.push(name);
      continue;
    }
    out[name] = pickUrl(candidates, name);
  }

  const outPath = join(process.cwd(), "src/data/blobAssetUrls.json");
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${outPath} (${Object.keys(out).length} URLs)`);

  if (missing.length) {
    console.warn(
      `Missing ${missing.length} asset(s) in store (by filename): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
