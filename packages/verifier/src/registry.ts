import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hallmarkRegistryAbi } from "./registryAbi.js";
import type { VerifyResult } from "./verify.js";

export { hallmarkRegistryAbi };

/** HallmarkRegistry on qorechain-diana (deployed 21 Nov 2026, block 10446802). */
export const REGISTRY_ADDRESS: Address = "0xa901ee7138266abc456c8d717fa94b043078b8c4";

export const diana = defineChain({
  id: 9800,
  name: "QoreChain Diana",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } },
  blockExplorers: { default: { name: "QoreChain Explorer", url: "https://explore.qore.network" } },
  testnet: true,
});

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

export function registryReader(rpcUrl: string = diana.rpcUrls.default.http[0], registry: Address = REGISTRY_ADDRESS) {
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
 */
export async function recordOnchain(opts: {
  result: VerifyResult;
  sourceUri: string;
  verifierKey: Hex;
  rpcUrl?: string;
  registry?: Address;
}): Promise<Hex> {
  const { result } = opts;
  if (result.match === "none") throw new Error("Nothing to record: no match");
  if (!result.deployer) throw new Error("A matched deployment transaction is needed to record the deployer");

  const rpcUrl = opts.rpcUrl ?? diana.rpcUrls.default.http[0];
  const account = privateKeyToAccount(opts.verifierKey);
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
}
