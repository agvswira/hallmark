#!/usr/bin/env node
// Runs the bundled CLI (npm run build: dist/hallmark.mjs, starts in about a second), or the
// TypeScript source through tsx when no bundle has been built yet.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const bundle = fileURLToPath(new URL("../dist/hallmark.mjs", import.meta.url));
const args = existsSync(bundle)
  ? [bundle]
  : [createRequire(import.meta.url).resolve("tsx/cli"), fileURLToPath(new URL("../src/main.ts", import.meta.url))];
const { status } = spawnSync(process.execPath, [...args, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(status ?? 1);
