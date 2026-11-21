/**
 * Compiles the QuantumGuestbook sample into a build-info file for the web app's "Try it" page.
 * The file has the same shape as a Hardhat or Foundry build-info (solcLongVersion, input, output),
 * so the page verifies it exactly as it would verify a user's build.
 *
 *   npx tsx scripts/build-sample.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SolcJsCompiler } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const path = "src/examples/QuantumGuestbook.sol";
const out = join(root, "web", "public", "samples", "quantum-guestbook.build-info.json");

const input = {
  language: "Solidity",
  sources: { [path]: { content: readFileSync(join(root, "contracts", path), "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    metadata: { bytecodeHash: "ipfs" },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] } },
  },
};

const solc = new SolcJsCompiler(join(homedir(), ".cache", "hallmark", "solc"));
const solcLongVersion = await solc.resolveVersion("0.8.28");
const output = (await solc.compile(solcLongVersion, input as any)) as any;
const errors = (output.errors ?? []).filter((e: any) => e.severity === "error");
if (errors.length) throw new Error(errors.map((e: any) => e.formattedMessage).join("\n"));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ _format: "hallmark-sample-build-info-1", solcVersion: solcLongVersion.split("+")[0], solcLongVersion, input, output })}\n`);
const c = output.contracts[path].QuantumGuestbook;
console.log(`${out}\n  solc ${solcLongVersion}, runtime ${c.evm.deployedBytecode.object.length / 2} bytes`);
