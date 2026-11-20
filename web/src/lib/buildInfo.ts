/**
 * Reads a Foundry or Hardhat build-info file in the browser and keeps only what the server
 * needs: the compiler version, the standard JSON input, and the list of contracts.
 * The compiler output (often over 10 MB) never leaves the browser.
 */
export interface PreparedBuild {
  compilerVersion: string;
  input: { language: string; sources: Record<string, { content?: string }>; settings: unknown };
  contracts: { id: string; runtimeLength: number }[];
  sizeBytes: number;
}

export async function prepareBuildInfo(file: File): Promise<PreparedBuild> {
  let json: any;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not valid JSON. Choose a build-info file from out/build-info or artifacts/build-info.");
  }
  const raw = json?.input;
  if (!raw || raw.language !== "Solidity" || typeof raw.sources !== "object") {
    throw new Error("No Solidity input found. Choose a build-info file, not a contract artifact.");
  }
  const compilerVersion = String(json.solcLongVersion ?? json.solcVersion ?? "");
  if (!compilerVersion) throw new Error("The file does not say which compiler version built it.");

  // Standard fields only: Foundry adds allowPaths/basePath/includePaths with local paths.
  const input = { language: raw.language, sources: raw.sources, settings: raw.settings };

  const contracts: PreparedBuild["contracts"] = [];
  for (const [path, byName] of Object.entries<Record<string, any>>(json.output?.contracts ?? {})) {
    for (const [name, c] of Object.entries(byName)) {
      const runtime: string = c?.evm?.deployedBytecode?.object ?? "";
      if (runtime.length > 0) contracts.push({ id: `${path}:${name}`, runtimeLength: runtime.length / 2 });
    }
  }
  // Project sources before libraries and tests, then larger contracts first.
  const rank = (id: string) => (/^(lib|node_modules|test|script)\//.test(id) || /\.t\.sol:|\.s\.sol:/.test(id) ? 1 : 0);
  contracts.sort((a, b) => rank(a.id) - rank(b.id) || b.runtimeLength - a.runtimeLength);

  const sizeBytes = new Blob([JSON.stringify({ compilerVersion, input })]).size;
  if (sizeBytes > 4_000_000) {
    throw new Error("The sources in this build are larger than 4 MB. Build only the contract you want to verify and try again.");
  }
  return { compilerVersion, input, contracts, sizeBytes };
}
