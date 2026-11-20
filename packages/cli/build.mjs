// Bundles the CLI into one ES module so it starts in about a second instead of compiling
// TypeScript through tsx on every run. @hallmark/verifier is already a self-contained bundle
// with its own require() for the solc builds, so no banner is added here.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/hallmark.mjs",
  logLevel: "warning",
});
