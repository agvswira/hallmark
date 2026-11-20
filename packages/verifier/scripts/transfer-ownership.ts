/**
 * transfer-ownership.ts - hand HallmarkRegistry ownership to another account.
 *
 *   npm run transfer-ownership -- --to 0x…
 *
 * Signs with PRIVATE_KEY from contracts/.env (the current owner). The new owner can then
 * replace the verifier with setVerifier from its own wallet.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createPublicClient, createWalletClient, getAddress, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { REGISTRY_ADDRESS, diana, hallmarkRegistryAbi } from "../src/registry.js";

const { values } = parseArgs({ options: { to: { type: "string" } } });
const to = getAddress(values.to ?? "");

const env = readFileSync(new URL("../../../contracts/.env", import.meta.url), "utf8");
const key = env.match(/^PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)?.[1] as Hex | undefined;
if (!key) throw new Error("PRIVATE_KEY missing in contracts/.env");

const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain: diana, transport: http() });
const wallet = createWalletClient({ account, chain: diana, transport: http() });

const read = (functionName: "owner" | "verifier") =>
  pub.readContract({ address: REGISTRY_ADDRESS, abi: hallmarkRegistryAbi, functionName });

console.log("owner before:", await read("owner"));
const { request } = await pub.simulateContract({
  account,
  address: REGISTRY_ADDRESS,
  abi: hallmarkRegistryAbi,
  functionName: "transferOwnership",
  args: [to],
});
const hash = await wallet.writeContract(request);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log("tx:", hash, "status:", receipt.status);
console.log("owner after:", await read("owner"));
console.log("verifier:", await read("verifier"));
