import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { classifyEvmWindowRejection } from "@qorechain/evm";
import { ensureEvmWindow } from "./window.js";
import { hallmarkRegistryAbi } from "./registryAbi.js";
import type { VerifyResult } from "./verify.js";

export { hallmarkRegistryAbi };

export { REGISTRY_ADDRESS, diana } from "./constants.js";
import { REGISTRY_ADDRESS, diana } from "./constants.js";

const MATCH = { none: 0, partial: 1, full: 2 } as const;
export const MATCH_NAMES = ["none", "partial", "full"] as const;

export interface OnchainHallmark {
  target: Address;
  match: (typeof MATCH_NAMES)[number];
  pqcFlags: number;
  verifiedAt: number;
  deployer: Address;
  runtimeCodeHash: Hex;
  sourceHash: Hex;
  compiler: string;
  sourceUri: string;
  isCurrent: boolean;
  claim?: { claimant: Address; claimedAt: number; possessionProven: boolean; repo: string };
}

export interface RegistryReader {
  client: PublicClient;
  count(): Promise<number>;
  targets(start: number, limit: number): Promise<Address[]>;
  get(target: string): Promise<OnchainHallmark | undefined>;
}

export function registryReader(rpcUrl: string = diana.rpcUrls.default.http[0], registry: Address = REGISTRY_ADDRESS): RegistryReader {
  const client = createPublicClient({ chain: diana, transport: http(rpcUrl) }) as PublicClient;
  const read = <T>(functionName: string, args: unknown[] = []) =>
    client.readContract({ address: registry, abi: hallmarkRegistryAbi, functionName: functionName as any, args: args as any }) as Promise<T>;

  return {
    client,
    async count(): Promise<number> {
      return Number(await read<bigint>("count"));
    },
    async targets(start: number, limit: number): Promise<Address[]> {
      return read<Address[]>("targets", [BigInt(start), BigInt(limit)]);
    },
    async get(target: string): Promise<OnchainHallmark | undefined> {
      const address = getAddress(target);
      const [h, c, isCurrent] = await Promise.all([
        read<any>("hallmarkOf", [address]),
        read<any>("claimOf", [address]),
        read<boolean>("isCurrent", [address]),
      ]);
      if (Number(h.matchType) === 0) return undefined;
      return {
        target: address,
        match: MATCH_NAMES[Number(h.matchType)],
        pqcFlags: Number(h.pqcFlags),
        verifiedAt: Number(h.verifiedAt),
        deployer: h.deployer,
        runtimeCodeHash: h.runtimeCodeHash,
        sourceHash: h.sourceHash,
        compiler: h.compiler,
        sourceUri: h.sourceUri,
        isCurrent,
        claim:
          c.claimant === "0x0000000000000000000000000000000000000000"
            ? undefined
            : { claimant: c.claimant, claimedAt: Number(c.claimedAt), possessionProven: c.possessionProven, repo: c.repo },
      };
    },
  };
}

/**
 * Writes a verification result to the registry from the verifier account.
 * Refuses results without a match or without a deployer (no matched creation transaction).
 *
 * The verifier account is derived from its mnemonic, which also holds its ML-DSA-87 key:
 * before sending, the account's EVM window is checked and, if needed, a new one scoped to
 * the registry is opened (see window.ts). A send refused for a window reason is retried
 * once after opening a fresh window.
 */
export async function recordOnchain(opts: {
  result: VerifyResult;
  sourceUri: string;
  mnemonic: string;
  rpcUrl?: string;
  registry?: Address;
  log?: (message: string) => void;
}): Promise<Hex> {
  const { result } = opts;
  if (result.match === "none") throw new Error("Nothing to record: no match");
  if (!result.deployer) throw new Error("A matched deployment transaction is needed to record the deployer");

  const rpcUrl = opts.rpcUrl ?? diana.rpcUrls.default.http[0];
  const account = mnemonicToAccount(opts.mnemonic.trim()); // m/44'/60'/0'/0/0, as the SDK derives it
  const wallet = createWalletClient({ account, chain: diana, transport: http(rpcUrl) });
  const pub = createPublicClient({ chain: diana, transport: http(rpcUrl) });

  const args = [
    getAddress(result.address),
    MATCH[result.match],
    result.pqc?.flags ?? 0,
    getAddress(result.deployer),
    result.sourceHash,
    result.compilerVersion,
    opts.sourceUri,
  ] as const;

  const send = async () => {
    // Simulate first: a revert (for example a refused downgrade) never costs a transaction.
    const { request } = await pub.simulateContract({
      account,
      address: opts.registry ?? REGISTRY_ADDRESS,
      abi: hallmarkRegistryAbi,
      functionName: "recordVerification",
      args,
    });
    const hash = await wallet.writeContract(request);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`recordVerification reverted: ${hash}`);
    return hash;
  };

  await ensureEvmWindow({ mnemonic: opts.mnemonic, log: opts.log });
  try {
    return await send();
  } catch (err) {
    if (!classifyEvmWindowRejection(err)) throw err;
    opts.log?.(`send refused (${classifyEvmWindowRejection(err)}); opening a fresh window and retrying once`);
    await ensureEvmWindow({ mnemonic: opts.mnemonic, force: true, log: opts.log });
    return send();
  }
}
