import { keccak256, toBytes } from "viem";
import type { SolidityJsonInput } from "@ethereum-sourcify/lib-sourcify";

/** What a verification needs from a build: the exact compiler and its standard JSON input. */
export interface BuildInput {
  compilerVersion: string;
  input: SolidityJsonInput;
  /** Contracts present in the build output, when the file carries one ("path:Name"). */
  contracts: ContractRef[];
}

export interface ContractRef {
  path: string;
  name: string;
  /** Length in hex characters of the compiled runtime bytecode, when known. */
  runtimeHexLength?: number;
}

/**
 * Reads a Foundry or Hardhat build-info file (`forge build --build-info`,
 * `artifacts/build-info/*.json`), or a bare standard JSON input together with a version.
 */
export function parseBuildInfo(json: unknown, fallbackVersion?: string): BuildInput {
  if (!json || typeof json !== "object") throw new Error("Build info must be a JSON object");
  const obj = json as Record<string, unknown>;

  const input = (obj.input ?? (obj.language ? obj : undefined)) as SolidityJsonInput | undefined;
  if (!input || input.language !== "Solidity" || typeof input.sources !== "object") {
    throw new Error("No Solidity standard JSON input found (expected an `input` field or a standard JSON input)");
  }

  // Hardhat writes a long version ("0.8.28+commit.7893614a"); Foundry 1.x writes only "0.8.28",
  // which is resolved to its official release build before compiling (see SolcJsCompiler).
  const compilerVersion = String(obj.solcLongVersion ?? obj.solcVersion ?? fallbackVersion ?? "");
  if (!/^v?\d+\.\d+\.\d+(\+commit\.[0-9a-f]{8})?$/.test(compilerVersion)) {
    throw new Error(
      `A compiler version such as 0.8.28 or 0.8.28+commit.7893614a is required (got "${compilerVersion || "none"}")`,
    );
  }

  return {
    compilerVersion: compilerVersion.replace(/^v/, ""),
    input: standardJsonOnly(input),
    contracts: listContracts(obj, input),
  };
}

/**
 * Keeps only the fields of the standard JSON input. Foundry adds `version`, `allowPaths`,
 * `basePath` and `includePaths` (absolute local paths): solc rejects them as unknown keys,
 * and they would leak the builder's directory layout into the published record.
 */
export function standardJsonOnly(input: SolidityJsonInput): SolidityJsonInput {
  const { language, sources, settings } = input;
  return { language, sources, settings } as SolidityJsonInput;
}

function listContracts(obj: Record<string, unknown>, input: SolidityJsonInput): ContractRef[] {
  const output = obj.output as { contracts?: Record<string, Record<string, any>> } | undefined;
  if (output?.contracts) {
    const refs: ContractRef[] = [];
    for (const [path, byName] of Object.entries(output.contracts)) {
      for (const [name, c] of Object.entries(byName)) {
        const deployed = c?.evm?.deployedBytecode?.object as string | undefined;
        if (deployed !== undefined && deployed.length === 0) continue; // interfaces, abstract contracts
        refs.push({ path, name, runtimeHexLength: deployed?.length });
      }
    }
    return refs;
  }
  // No output: list declared contracts from the sources.
  const refs: ContractRef[] = [];
  for (const [path, src] of Object.entries(input.sources)) {
    const content = (src as { content?: string }).content ?? "";
    for (const m of content.matchAll(/^\s*(?:abstract\s+)?contract\s+(\w+)/gm)) {
      if (!/^\s*abstract/.test(m[0])) refs.push({ path, name: m[1] });
    }
  }
  return refs;
}

/**
 * keccak256 of the standard JSON input serialised with sorted keys, so the same
 * input always gives the same hash regardless of how the file was formatted.
 */
export function sourceHash(input: SolidityJsonInput): `0x${string}` {
  return keccak256(toBytes(canonicalJson(input)));
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
