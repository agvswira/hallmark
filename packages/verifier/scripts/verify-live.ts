/**
 * verify-live.ts - run a verification against qorechain-diana from the command line.
 *
 * From a build-info file (Foundry/Hardhat):
 *   npm run verify:live -- --address 0x… --tx 0x… --build-info path/to/build-info.json [--contract path:Name]
 *
 * From source files, with the settings the project compiled with:
 *   npm run verify:live -- --address 0x… --tx 0x… --version 0.8.24+commit.e11b9ed9 \
 *     --root ../some-repo --source contracts/A.sol [--source …] [--runs 200] [--no-optimizer] [--evm cancun]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseBuildInfo, verifyContract } from "../src/index.js";

const { values } = parseArgs({
  options: {
    address: { type: "string" },
    tx: { type: "string" },
    contract: { type: "string" },
    "build-info": { type: "string" },
    version: { type: "string" },
    root: { type: "string", default: "." },
    source: { type: "string", multiple: true },
    runs: { type: "string", default: "200" },
    "no-optimizer": { type: "boolean", default: false },
    evm: { type: "string" },
    rpc: { type: "string" },
  },
});

if (!values.address) throw new Error("--address is required");

const build = values["build-info"]
  ? parseBuildInfo(JSON.parse(readFileSync(values["build-info"], "utf8")))
  : parseBuildInfo(
      {
        language: "Solidity",
        sources: Object.fromEntries(
          (values.source ?? []).map((p) => [p, { content: readFileSync(join(values.root!, p), "utf8") }]),
        ),
        settings: {
          optimizer: { enabled: !values["no-optimizer"], runs: Number(values.runs) },
          ...(values.evm ? { evmVersion: values.evm } : {}),
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] } },
        },
      },
      values.version,
    );

const started = Date.now();
const result = await verifyContract({
  address: values.address,
  build,
  contract: values.contract,
  creationTxHash: values.tx,
  rpcUrl: values.rpc,
});
console.log(JSON.stringify({ ...result, ms: Date.now() - started }, null, 2));
