/**
 * new-account.ts - create a fresh testnet account for the Hallmark verifier.
 *
 * Writes the mnemonic and private key to contracts/.env (gitignored) and prints
 * only the public addresses. Refuses to overwrite an existing mnemonic.
 *
 *   npm run account
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { deriveUnifiedAccount } from "@qorechain/sdk";
import { generateMnemonic, english, mnemonicToAccount } from "viem/accounts";
import { toHex } from "viem";

const ENV = new URL("../.env", import.meta.url);

const current = existsSync(ENV) ? readFileSync(ENV, "utf8") : readFileSync(new URL("../.env.example", import.meta.url), "utf8");
if (/^QORE_MNEMONIC=\S+/m.test(current)) {
  console.error("contracts/.env already has QORE_MNEMONIC. Not overwriting it.");
  process.exit(1);
}

const mnemonic = generateMnemonic(english);
const evmAccount = mnemonicToAccount(mnemonic); // m/44'/60'/0'/0/0, same path as the window helper
const privateKey = toHex(evmAccount.getHdKey().privateKey!);
const unified = await deriveUnifiedAccount(mnemonic, 0);

if (unified.evm.toLowerCase() !== evmAccount.address.toLowerCase()) {
  throw new Error("SDK and viem derived different addresses; refusing to write .env");
}

const set = (text: string, key: string, value: string) =>
  new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;

let next = set(current, "QORE_MNEMONIC", mnemonic);
next = set(next, "PRIVATE_KEY", privateKey);
writeFileSync(ENV, next, { mode: 0o600 });

console.log("New verifier account written to contracts/.env (not committed).");
console.log(`  qor1 address: ${unified.cosmos}`);
console.log(`  EVM address:  ${unified.evm}`);
console.log("Fund the qor1 address from the faucet, then: npm run window register && npm run window open");
