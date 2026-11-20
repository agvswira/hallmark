/**
 * record-self.ts - verify HallmarkRegistry from its Foundry build-info and record the
 * result in the registry itself, then claim it from the deployer (the verifier account).
 *
 *   npm run record:self -- --build-info ../../contracts/out/build-info/<id>.json --repo https://github.com/agvswira/hallmark
 *
 * Reads PRIVATE_KEY from contracts/.env (gitignored). Prints addresses and tx hashes only.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseBuildInfo, verifyContract } from "../src/index.js";
import { REGISTRY_ADDRESS, diana, hallmarkRegistryAbi, recordOnchain, registryReader } from "../src/registry.js";

const { values } = parseArgs({
  options: { "build-info": { type: "string" }, repo: { type: "string" }, "source-uri": { type: "string" } },
});
const env = readFileSync(new URL("../../../contracts/.env", import.meta.url), "utf8");
const key = env.match(/^PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)?.[1] as Hex | undefined;
if (!key) throw new Error("PRIVATE_KEY missing in contracts/.env");

const deployTx = JSON.parse(
  readFileSync(new URL("../../../contracts/broadcast/DeployRegistry.s.sol/9800/run-latest.json", import.meta.url), "utf8"),
).transactions[0].hash as Hex;

const result = await verifyContract({
  address: REGISTRY_ADDRESS,
  creationTxHash: deployTx,
  contract: "src/HallmarkRegistry.sol:HallmarkRegistry",
  build: parseBuildInfo(JSON.parse(readFileSync(values["build-info"]!, "utf8"))),
});
console.log("verification:", result.match, "| deployer:", result.deployer, "| pqc flags:", result.pqc?.flags);

const sourceUri = values["source-uri"] ?? `${values.repo}/blob/main/contracts/src/HallmarkRegistry.sol`;
const recordTx = await recordOnchain({ result, sourceUri, verifierKey: key });
console.log("recorded:", recordTx);

// The deployer claims it: the registry checks the caller's ML-DSA-87 key through pqcKeyStatus.
const account = privateKeyToAccount(key);
const wallet = createWalletClient({ account, chain: diana, transport: http() });
const pub = createPublicClient({ chain: diana, transport: http() });
const { request } = await pub.simulateContract({
  account,
  address: REGISTRY_ADDRESS,
  abi: hallmarkRegistryAbi,
  functionName: "claim",
  args: [REGISTRY_ADDRESS, values.repo!],
});
const claimTx = await wallet.writeContract(request);
await pub.waitForTransactionReceipt({ hash: claimTx });
console.log("claimed:", claimTx);

console.log(JSON.stringify(await registryReader().get(REGISTRY_ADDRESS), null, 2));
