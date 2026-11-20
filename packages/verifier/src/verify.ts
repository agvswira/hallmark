import {
  SolidityCompilation,
  SourcifyChain,
  Verification,
  type ISolidityCompiler,
  type VerificationStatus,
} from "@ethereum-sourcify/lib-sourcify";
import { createPublicClient, getAddress, http, keccak256, type Hex } from "viem";
import { SolcJsCompiler } from "./compiler.js";
import { detectPqc, type PqcReport } from "./pqc.js";
import { sourceHash, type BuildInput, type ContractRef } from "./input.js";

export const DIANA = {
  name: "QoreChain Diana testnet",
  chainId: 9800,
  rpcUrl: "https://evm-testnet.qore.host",
} as const;

/** Mirrors HallmarkRegistry.Match: 0 none, 1 partial, 2 full. */
export type MatchLevel = "none" | "partial" | "full";

export interface VerifyOptions {
  address: string;
  build: BuildInput;
  /** "path:Name". If omitted, the contracts in the build are tried, closest size first. */
  contract?: string;
  /** The deployment transaction. Needed to establish the deployer (and a creation match). */
  creationTxHash?: string;
  rpcUrl?: string;
  chainId?: number;
  compiler?: ISolidityCompiler;
  /** Most contracts to try when `contract` is not given. */
  maxCandidates?: number;
}

export interface VerifyResult {
  address: string;
  chainId: number;
  match: MatchLevel;
  runtimeMatch: VerificationStatus;
  creationMatch: VerificationStatus;
  contract?: { path: string; name: string };
  compilerVersion: string;
  sourceHash: Hex;
  onchainCodeHash: Hex;
  /** Only set when the creation transaction was matched to this contract. */
  deployer?: string;
  deployTxHash?: string;
  pqc?: PqcReport;
  /** Why no match was found, per candidate tried. */
  attempts: { contract: string; error: string }[];
}

export async function verifyContract(opts: VerifyOptions): Promise<VerifyResult> {
  const rpcUrl = opts.rpcUrl ?? DIANA.rpcUrl;
  const expectedChainId = opts.chainId ?? DIANA.chainId;
  const address = getAddress(opts.address);
  const compiler = opts.compiler ?? new SolcJsCompiler();

  const client = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await client.getChainId();
  if (chainId !== expectedChainId) {
    throw new Error(`RPC ${rpcUrl} is chain ${chainId}, expected ${expectedChainId}`);
  }
  const onchain = await client.getCode({ address });
  if (!onchain || onchain === "0x") throw new Error(`No contract code at ${address}`);

  const chain = new SourcifyChain({
    name: "qorechain",
    chainId,
    rpcs: [{ rpc: rpcUrl }],
    supported: true,
  } as ConstructorParameters<typeof SourcifyChain>[0]);

  const base: Omit<VerifyResult, "match" | "runtimeMatch" | "creationMatch" | "attempts"> = {
    address,
    chainId,
    compilerVersion: opts.build.compilerVersion,
    sourceHash: sourceHash(opts.build.input),
    onchainCodeHash: keccak256(onchain),
  };

  const candidates = pickCandidates(opts, onchain.length - 2);
  const attempts: VerifyResult["attempts"] = [];

  for (const ref of candidates) {
    const label = `${ref.path}:${ref.name}`;
    try {
      const compilation = new SolidityCompilation(compiler, opts.build.compilerVersion, opts.build.input, {
        path: ref.path,
        name: ref.name,
      });
      const verification = new Verification(compilation, chain, address, opts.creationTxHash);
      await verification.verify();

      const { runtimeMatch, creationMatch } = verification.status;
      const match = toLevel(runtimeMatch, creationMatch);
      if (match === "none") {
        attempts.push({ contract: label, error: `runtime ${runtimeMatch}, creation ${creationMatch}` });
        continue;
      }

      const creationMatched = creationMatch === "perfect" || creationMatch === "partial";
      const info = verification.deploymentInfo;
      return {
        ...base,
        match,
        runtimeMatch,
        creationMatch,
        contract: { path: ref.path, name: ref.name },
        deployer: creationMatched && info.deployer ? getAddress(info.deployer) : undefined,
        deployTxHash: creationMatched ? info.txHash : undefined,
        pqc: detectPqc(onchain, opts.build.input.sources as Record<string, { content?: string }>),
        attempts,
      };
    } catch (err) {
      attempts.push({ contract: label, error: describe(err) });
    }
  }

  return { ...base, match: "none", runtimeMatch: null, creationMatch: null, attempts };
}

function pickCandidates(opts: VerifyOptions, onchainHexLength: number): ContractRef[] {
  if (opts.contract) {
    const i = opts.contract.lastIndexOf(":");
    if (i <= 0) throw new Error(`contract must be "path:Name", got "${opts.contract}"`);
    return [{ path: opts.contract.slice(0, i), name: opts.contract.slice(i + 1) }];
  }
  const all = opts.build.contracts;
  if (all.length === 0) throw new Error("The build lists no contracts; pass contract as path:Name");
  // Same-length runtime code first (immutables and library links keep the length).
  const ranked = [...all].sort(
    (a, b) => distance(a.runtimeHexLength, onchainHexLength) - distance(b.runtimeHexLength, onchainHexLength),
  );
  return ranked.slice(0, opts.maxCandidates ?? 8);
}

const distance = (len: number | undefined, target: number) => (len === undefined ? 1e9 : Math.abs(len - target));

/**
 * Full needs a perfect runtime (or creation) match: the metadata hash, which commits to
 * every source file and setting, is identical. Partial means the executable code matches
 * but the metadata differs, for example after a comment or path change.
 */
export function toLevel(runtime: VerificationStatus, creation: VerificationStatus): MatchLevel {
  if (runtime === "perfect" || creation === "perfect") return "full";
  if (runtime === "partial" || creation === "partial") return "partial";
  return "none";
}

function describe(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const e = err as { code?: string; message?: string };
    return `${e.code}${e.message && e.message !== e.code ? `: ${e.message}` : ""}`;
  }
  return err instanceof Error ? err.message : String(err);
}
