// Runs the forge binary shipped in the @foundry-rs/forge-<platform> npm package,
// so the project builds without a global Foundry install (foundryup).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const arch = process.arch === "x64" ? "amd64" : process.arch;
const pkg = `@foundry-rs/forge-${process.platform}-${arch}`;

let bin;
try {
  bin = join(dirname(require.resolve(`${pkg}/package.json`)), "bin", process.platform === "win32" ? "forge.exe" : "forge");
} catch {
  console.error(`${pkg} is not installed. Run npm install, or install Foundry with foundryup.`);
  process.exit(1);
}

const { status } = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
process.exit(status ?? 1);
