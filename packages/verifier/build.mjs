// Builds the verifier for Node consumers (the web API on Vercel, the CLI):
//  - type declarations with tsc;
//  - one bundled ES module per entry point with esbuild. Bundling settles the mix of CommonJS and
//    ES modules in the dependencies at build time (for example @cosmjs/crypto requiring the
//    ESM-only @noble/hashes), which the Vercel function runtime refuses to do at run time.
// Only the downloaded soljson compiler builds are loaded with require() at run time.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
execFileSync(process.execPath, [join(dirname(require.resolve("typescript/package.json")), "bin", "tsc"), "-p", "tsconfig.build.json", "--emitDeclarationOnly"], {
  stdio: "inherit",
});

const common = { bundle: true, format: "esm", sourcemap: true, logLevel: "warning" };

// The engine, for Node.
await build({
  ...common,
  entryPoints: { index: "src/index.ts" },
  outdir: "dist",
  platform: "node",
  target: "node20",
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

// The registry ABI on its own, for browsers (the web app's claim button): plain data, no Node APIs.
await build({ ...common, entryPoints: { registryAbi: "src/registryAbi.ts" }, outdir: "dist", platform: "neutral" });
