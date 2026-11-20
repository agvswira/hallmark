import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { ISolidityCompiler, SolidityJsonInput, SolidityOutput } from "@ethereum-sourcify/lib-sourcify";

const require = createRequire(import.meta.url);
// solc's wrapper turns an emscripten soljson build into a compile() function.
const wrapSoljson: (soljson: unknown) => { compile(input: string): string; version(): string } = require("solc/wrapper");

const BINARIES = "https://binaries.soliditylang.org/bin";

interface BuildEntry {
  path: string;
  longVersion: string;
  sha256: string;
}

/**
 * Compiles with the official soljson (emscripten) builds from binaries.soliditylang.org.
 * Each build is downloaded once, checked against the SHA-256 published in list.json,
 * and cached on disk, so a verification uses exactly the requested compiler.
 */
export class SolcJsCompiler implements ISolidityCompiler {
  private readonly loaded = new Map<string, ReturnType<typeof wrapSoljson>>();
  private list?: BuildEntry[];
  private releases?: Record<string, string>;

  constructor(private readonly cacheDir = join(process.cwd(), ".cache", "solc")) {}

  async compile(version: string, input: SolidityJsonInput): Promise<SolidityOutput> {
    const solc = await this.load(version);
    return JSON.parse(solc.compile(JSON.stringify(input))) as SolidityOutput;
  }

  /** `version` is a long version such as "0.8.28+commit.7893614a" (a leading "v" is accepted). */
  async load(version: string) {
    const longVersion = normaliseVersion(version);
    const cached = this.loaded.get(longVersion);
    if (cached) return cached;

    const build = await this.findBuild(longVersion);
    mkdirSync(this.cacheDir, { recursive: true });
    // Saved as .cjs: soljson is a CommonJS script, and a .js file inside an ES module
    // package ("type": "module") would be loaded as ESM and fail on __dirname.
    const file = join(this.cacheDir, build.path.replace(/\.js$/, ".cjs"));

    if (!existsSync(file) || sha256(readFileSync(file)) !== strip0x(build.sha256)) {
      const res = await fetch(`${BINARIES}/${build.path}`);
      if (!res.ok) throw new Error(`Could not download ${build.path}: HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      if (sha256(body) !== strip0x(build.sha256)) {
        throw new Error(`Checksum mismatch for ${build.path}; refusing to use it`);
      }
      writeFileSync(file, body);
    }

    const solc = wrapSoljson(require(file));
    this.loaded.set(longVersion, solc);
    return solc;
  }

  /**
   * Turns "0.8.28" into the long version of its official release ("0.8.28+commit.7893614a").
   * Long versions are returned unchanged. Prereleases and nightlies are never chosen.
   */
  async resolveVersion(version: string): Promise<string> {
    const v = normaliseVersion(version);
    if (v.includes("+commit.")) return v;
    const { releases, builds } = await this.releaseList();
    const path = releases[v];
    const build = path && builds.find((b) => b.path === path);
    if (!build) throw new Error(`No official solc release ${v}`);
    return build.longVersion;
  }

  private async releaseList() {
    if (!this.list || !this.releases) {
      const res = await fetch(`${BINARIES}/list.json`);
      if (!res.ok) throw new Error(`Could not read the solc release list: HTTP ${res.status}`);
      const json = (await res.json()) as { builds: BuildEntry[]; releases: Record<string, string> };
      this.list = json.builds;
      this.releases = json.releases;
    }
    return { builds: this.list, releases: this.releases };
  }

  private async findBuild(longVersion: string): Promise<BuildEntry> {
    const { builds } = await this.releaseList();
    const build = builds.find((b) => b.longVersion === longVersion);
    if (!build) throw new Error(`Unknown solc version ${longVersion}`);
    return build;
  }
}

export function normaliseVersion(version: string): string {
  return version.trim().replace(/^v/, "");
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const strip0x = (hex: string) => hex.replace(/^0x/, "").toLowerCase();
