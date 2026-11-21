/**
 * The "Try it" sample shipped with the web app: its build-info must verify as a full match with
 * the pqcKeyStatus flag, exactly as a user's build would.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Abi, Hex } from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseBuildInfo } from "../src/input.js";
import { verifyContract } from "../src/verify.js";
import { compiler, startAnvil, type LocalChain } from "./helpers.js";

const FILE = join(__dirname, "..", "..", "..", "web", "public", "samples", "quantum-guestbook.build-info.json");
const PATH = "src/examples/QuantumGuestbook.sol";

let chain: LocalChain;
beforeAll(async () => {
  chain = await startAnvil(9800);
}, 120_000);
afterAll(() => chain?.stop());

describe("Try-it sample", () => {
  it("the shipped build-info verifies as a full, PQ-guarded match", async () => {
    const buildInfo = JSON.parse(readFileSync(FILE, "utf8"));
    const c = buildInfo.output.contracts[PATH].QuantumGuestbook;
    const d = await chain.deploy(c.abi as Abi, `0x${c.evm.bytecode.object}` as Hex);
    const r = await verifyContract({
      address: d.address,
      build: parseBuildInfo(buildInfo),
      contract: `${PATH}:QuantumGuestbook`,
      creationTxHash: d.txHash,
      rpcUrl: chain.rpcUrl,
      compiler,
    });
    expect(r.match).toBe("full");
    expect(r.pqc?.flags).toBe(2);
    expect(r.pqc?.sourceRefs.length).toBeGreaterThan(0);
    expect(r.deployer).toBeDefined();
  }, 120_000);
});
