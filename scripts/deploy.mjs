#!/usr/bin/env node
/**
 * Production deploy with a required title (shown in terminal + Vercel deployment message).
 *
 * Usage:
 *   npm run deploy -- "Archive landing clip reveal"
 *   npm run deploy:preview -- "Try scroll cue timing"
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEPLOYMENTS_FILE = path.join(ROOT, "DEPLOYMENTS.md");

const title = process.argv.slice(2).join(" ").trim();
const preview = process.env.DEPLOY_PREVIEW === "1";

if (!title) {
  console.error("\n  SKMNG.CO — deployment title required\n");
  console.error('  Usage: npm run deploy -- "Your deployment title"\n');
  console.error("  Recent titles (DEPLOYMENTS.md):\n");
  if (existsSync(DEPLOYMENTS_FILE)) {
    const lines = readFileSync(DEPLOYMENTS_FILE, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .slice(-6);
    for (const line of lines) console.error(`    ${line}`);
    if (lines.length) console.error("");
  }
  process.exit(1);
}

function run(command, args, label) {
  console.log(`\n▸ ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const stamp = new Date().toISOString().slice(0, 10);
const logLine = `- **${stamp}** — ${title}${preview ? " _(preview)_" : ""}`;

console.log("\n════════════════════════════════════════");
console.log(`  SKMNG.CO ${preview ? "preview" : "production"} deploy`);
console.log(`  ${title}`);
console.log("════════════════════════════════════════");

run("npm", ["run", "build"], "Build");

const vercelArgs = ["deploy", "--yes", "-m", `deployTitle=${title}`];
if (!preview) vercelArgs.push("--prod");

run("npx", ["vercel", ...vercelArgs], preview ? "Vercel preview" : "Vercel production");

if (existsSync(DEPLOYMENTS_FILE)) {
  appendFileSync(DEPLOYMENTS_FILE, `\n${logLine}\n`);
} else {
  appendFileSync(
    DEPLOYMENTS_FILE,
    `# SKMNG.CO deployments\n\nTitles used with \`npm run deploy -- "…"\` (newest last).\n\n${logLine}\n`,
  );
}

console.log("\n✓ Deploy complete\n");
