// Bundles the CLI into one self-contained ES module (the published package has no runtime
// dependencies). @hallmark/verifier is already a bundle with its own require() for the solc
// builds, so the only banner added here is the shebang for the npm bin.
import { copyFileSync } from "node:fs";
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: true,
  legalComments: "eof",
  banner: { js: "#!/usr/bin/env node" },
  outfile: "dist/hallmark.mjs",
  logLevel: "warning",
});

// The package ships the repository's licence.
copyFileSync(new URL("../../LICENSE", import.meta.url), new URL("./LICENSE", import.meta.url));
