// Bundles the CLI into one ES module so it starts in about a second instead of compiling
// TypeScript through tsx on every run. solc's emscripten builds are loaded at run time with
// require(), so the bundle gets a require() bound to its own location.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/hallmark.mjs",
  logLevel: "warning",
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
