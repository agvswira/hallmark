/**
 * Keeps the verifier account's EVM authorisation window usable.
 *
 * On QoreChain an EVM transaction is admitted only while the sender has a live window,
 * opened by a hybrid-signed (secp256k1 + ML-DSA-87) native message. The SDK has no
 * "open automatically" helper on purpose: a window authorises spending. Hallmark's server
 * has to record results unattended, so it opens windows itself, but narrowly:
 *
 *  - scoped to one target, HallmarkRegistry (`allowedTargets`), so the account can do
 *    nothing on the EVM lane except call the registry;
 *  - bounded in transactions and value, sized for registry calls only;
 *  - reopened only when the current window is missing, expiring, nearly used up, or not
 *    scoped to the registry.
 */
import { StargateClient } from "@cosmjs/stargate";
import { EthNativeSigner, deriveUnifiedAccount, getNetwork, openEvmWindowMsg, type UnifiedAccount } from "@qorechain/sdk";
import { evmWindowCost, evmWindowStatus, type EvmWindow } from "@qorechain/evm";
import { REGISTRY_ADDRESS } from "./constants.js";

export interface WindowPolicy {
  /** Reopen when fewer blocks than this remain. */
  minBlocks: bigint;
  /** Reopen when fewer transactions than this remain. */
  minTxs: bigint;
  /** Reopen when less value (uqor) than this remains. */
  minValue: bigint;
  /** Size of a new window. */
  openBlocks: bigint;
  openTxs: bigint;
  openValue: bigint;
  /** The only contract the window admits. */
  target: string;
}

/** The most one registry call can consume: 600k gas at a 250 gwei fee cap (0.15 QOR). */
export const REGISTRY_CALL_COST = evmWindowCost({ gas: 600_000n, maxFeePerGas: 250_000_000_000n });

export const DEFAULT_POLICY: WindowPolicy = {
  minBlocks: 300n,
  minTxs: 3n,
  minValue: REGISTRY_CALL_COST * 3n,
  openBlocks: 17_280n, // the chain's maximum
  openTxs: 200n,
  openValue: REGISTRY_CALL_COST * 200n,
  target: REGISTRY_ADDRESS,
};

/** Why a new window is needed, or undefined when the current one is fine. */
export function windowShortfall(w: EvmWindow, policy: WindowPolicy = DEFAULT_POLICY): string | undefined {
  if (!w.found) return "no window";
  if (!w.live) return "window not usable";
  const targets = w.allowedTargets.map((t) => t.toLowerCase());
  if (targets.length !== 1 || targets[0] !== policy.target.toLowerCase()) return "window not scoped to the registry";
  if (w.remainingBlocks < policy.minBlocks) return `only ${w.remainingBlocks} blocks left`;
  if (w.remainingTxs < policy.minTxs) return `only ${w.remainingTxs} transactions left`;
  if (w.remainingValue < policy.minValue) return `only ${w.remainingValue} uqor left`;
  return undefined;
}

export interface EnsureWindowOptions {
  mnemonic: string;
  network?: "testnet" | "mainnet";
  rest?: string;
  rpc?: string;
  policy?: WindowPolicy;
  /** Open a new window even if the current one is fine. */
  force?: boolean;
  log?: (message: string) => void;
}

export interface EnsureWindowResult {
  opened: boolean;
  reason?: string;
  txHash?: string;
  window: EvmWindow;
}

// One opening at a time per process: two concurrent openings would reuse a sequence.
let pending: Promise<unknown> = Promise.resolve();

export function ensureEvmWindow(opts: EnsureWindowOptions): Promise<EnsureWindowResult> {
  const run = pending.then(() => ensure(opts));
  pending = run.catch(() => undefined);
  return run;
}

async function ensure(opts: EnsureWindowOptions): Promise<EnsureWindowResult> {
  const net = getNetwork(opts.network ?? "testnet");
  const rest = opts.rest ?? net.endpoints.rest;
  const rpc = opts.rpc ?? net.endpoints.rpc;
  const policy = opts.policy ?? DEFAULT_POLICY;
  const account = await deriveUnifiedAccount(opts.mnemonic.trim(), 0);

  const current = await evmWindowStatus({ rest, address: account.cosmos });
  const reason = opts.force ? "forced" : windowShortfall(current, policy);
  if (!reason) return { opened: false, window: current };

  opts.log?.(`opening a new EVM window (${reason})`);
  const msg = openEvmWindowMsg({
    sender: account.cosmos,
    blocks: policy.openBlocks,
    maxTxs: policy.openTxs,
    maxValue: policy.openValue,
    allowedTargets: [policy.target],
  });
  const txHash = await broadcastHybrid(account, net.chainId, rest, rpc, [msg]);

  // The window is readable once the block is committed.
  for (let i = 0; i < 20; i++) {
    const w = await evmWindowStatus({ rest, address: account.cosmos });
    if (!windowShortfall(w, policy)) return { opened: true, reason, txHash, window: w };
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Opened a window (${txHash}) but it is not readable as usable yet`);
}

/** A native-lane fee: hybrid transactions are large, so the gas limit is generous. */
const FEE = { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" };

async function broadcastHybrid(
  account: UnifiedAccount,
  chainId: string,
  rest: string,
  rpc: string,
  messages: Parameters<EthNativeSigner["sign"]>[0]["messages"],
): Promise<string> {
  const res = await fetch(`${rest}/cosmos/auth/v1beta1/accounts/${account.cosmos}`);
  if (!res.ok) throw new Error(`account query failed: HTTP ${res.status}`);
  const body = (await res.json()) as { account?: Record<string, unknown> };
  const acc = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  const signer = new EthNativeSigner(account, { signMode: "hybrid", rest });
  const transport = await StargateClient.connect(rpc);
  try {
    const out = await signer.signAndBroadcast(transport, {
      chainId,
      accountNumber: BigInt(acc.account_number ?? "0"),
      sequence: BigInt(acc.sequence ?? "0"),
      fee: FEE,
      messages,
    });
    return out.transactionHash;
  } finally {
    transport.disconnect();
  }
}
