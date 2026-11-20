/**
 * window-ops.ts - inspect or refresh the verifier account's EVM window.
 *
 *   npm run window -- status
 *   npm run window -- ensure          # open a registry-scoped window if the current one falls short
 *   npm run window -- ensure --force  # open a new one regardless
 *
 * Reads QORE_MNEMONIC from contracts/.env (gitignored); prints addresses and hashes only.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { deriveUnifiedAccount, getNetwork } from "@qorechain/sdk";
import { evmWindowStatus } from "@qorechain/evm";
import { ensureEvmWindow, windowShortfall } from "../src/window.js";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { force: { type: "boolean", default: false } } });
const env = readFileSync(new URL("../../../contracts/.env", import.meta.url), "utf8");
const mnemonic = env.match(/^QORE_MNEMONIC=(.+)$/m)?.[1]?.trim();
if (!mnemonic) throw new Error("QORE_MNEMONIC missing in contracts/.env");

const show = (label: string, w: Awaited<ReturnType<typeof evmWindowStatus>>) =>
  console.log(
    `${label}: ${w.found ? (w.live ? "live" : "not usable") : "none"}` +
      (w.found
        ? `; ${w.remainingBlocks} blocks, ${w.remainingTxs} txs, ${w.remainingValue} uqor left; targets: ${w.allowedTargets.join(", ") || "any"}`
        : "") +
      `; ${windowShortfall(w) ?? "fine for the registry"}`,
  );

const account = await deriveUnifiedAccount(mnemonic, 0);
console.log("account:", account.cosmos, account.evm);
const rest = getNetwork("testnet").endpoints.rest;

if ((positionals[0] ?? "status") === "status") {
  show("window", await evmWindowStatus({ rest, address: account.cosmos }));
} else {
  const r = await ensureEvmWindow({ mnemonic, force: values.force, log: (m) => console.log(m) });
  console.log(r.opened ? `opened: ${r.txHash} (${r.reason})` : "kept the current window");
  show("window", r.window);
}
