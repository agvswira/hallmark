import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Abi, Hex } from "viem";
import { verifyContract } from "../src/verify.js";
import { parseBuildInfo } from "../src/input.js";
import { anvilAccount, compile, compiler, SOLC, standardInput, startAnvil, type LocalChain } from "./helpers.js";
import { GREETER, GREETER_CHANGED, GREETER_COMMENTED, KEY_GATE, SIG_CHECK, TWO_CONTRACTS } from "./fixtures.js";

let chain: LocalChain;

async function deployFrom(file: string, source: string, name: string, args: unknown[] = []) {
  const input = standardInput({ [file]: source });
  const out = await compile(input);
  const c = out.contracts[file][name];
  const deployed = await chain.deploy(c.abi as Abi, `0x${c.evm.bytecode.object}` as Hex, args);
  return { input, out, ...deployed };
}

const build = (sources: Record<string, string>, settings = {}) =>
  parseBuildInfo({ solcLongVersion: SOLC, input: standardInput(sources, settings) });

const run = (address: string, b: ReturnType<typeof build>, extra: Record<string, unknown> = {}) =>
  verifyContract({ address, build: b, rpcUrl: chain.rpcUrl, compiler, ...extra });

beforeAll(async () => {
  chain = await startAnvil(9800);
}, 120_000);

afterAll(() => chain?.stop());

describe("verifyContract", () => {
  it("gives a full match for the exact sources, with the deployer from the creation tx", async () => {
    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const r = await run(d.address, build({ "Greeter.sol": GREETER }), {
      contract: "Greeter.sol:Greeter",
      creationTxHash: d.txHash,
    });
    expect(r.match).toBe("full");
    expect(r.runtimeMatch).toBe("perfect");
    expect(r.creationMatch).toBe("perfect");
    expect(r.deployer).toBe(anvilAccount.address);
    expect(r.deployTxHash).toBe(d.txHash);
    expect(r.pqc?.flags).toBe(0);
  }, 120_000);

  it("gives a partial match when only the source text (metadata) differs", async () => {
    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const r = await run(d.address, build({ "Greeter.sol": GREETER_COMMENTED }), { contract: "Greeter.sol:Greeter" });
    expect(r.match).toBe("partial");
  }, 120_000);

  it("gives no match when the logic differs", async () => {
    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const r = await run(d.address, build({ "Greeter.sol": GREETER_CHANGED }), { contract: "Greeter.sol:Greeter" });
    expect(r.match).toBe("none");
    expect(r.attempts.length).toBe(1);
  }, 120_000);

  it("gives no match when the optimizer settings differ", async () => {
    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const r = await run(d.address, build({ "Greeter.sol": GREETER }, { optimizer: { enabled: false, runs: 200 } }), {
      contract: "Greeter.sol:Greeter",
    });
    expect(r.match).toBe("none");
  }, 120_000);

  it("does not report a deployer without a creation transaction", async () => {
    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const r = await run(d.address, build({ "Greeter.sol": GREETER }), { contract: "Greeter.sol:Greeter" });
    expect(r.match).toBe("full");
    expect(r.deployer).toBeUndefined();
  }, 120_000);

  it("does not take the deployer from someone else's creation transaction", async () => {
    const mine = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const other = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const r = await run(mine.address, build({ "Greeter.sol": GREETER }), {
      contract: "Greeter.sol:Greeter",
      creationTxHash: other.txHash,
    });
    expect(r.deployer).toBeUndefined();
  }, 120_000);

  it("detects pqcKeyStatus through a literal address and points at the source line", async () => {
    const d = await deployFrom("KeyGate.sol", KEY_GATE, "KeyGate");
    const r = await run(d.address, build({ "KeyGate.sol": KEY_GATE }), { contract: "KeyGate.sol:KeyGate" });
    expect(r.match).toBe("full");
    expect(r.pqc).toMatchObject({ usesKeyStatus: true, usesVerify: false, flags: 2 });
    expect(r.pqc?.sourceRefs[0]).toMatchObject({ file: "KeyGate.sol", line: 5, precompile: "pqcKeyStatus" });
    // The constant is declared at contract level; its use inside hasKey is reported too.
    expect(r.pqc?.sourceRefs[1]).toMatchObject({ line: 8, scope: "hasKey", precompile: "pqcKeyStatus" });
  }, 120_000);

  it("detects pqcVerify passed in as an immutable, from the deployed code", async () => {
    const pqcVerify = "0x0000000000000000000000000000000000000a01";
    const d = await deployFrom("SigCheck.sol", SIG_CHECK, "SigCheck", [pqcVerify]);
    const r = await run(d.address, build({ "SigCheck.sol": SIG_CHECK }), { contract: "SigCheck.sol:SigCheck" });
    expect(r.match).toBe("full");
    expect(r.pqc).toMatchObject({ usesVerify: true, flags: 1 });
    expect(r.pqc?.sourceRefs).toEqual([]);
  }, 120_000);

  it("finds the right contract when none is named", async () => {
    const d = await deployFrom("Two.sol", TWO_CONTRACTS, "Larger");
    const input = standardInput({ "Two.sol": TWO_CONTRACTS });
    const out = await compile(input);
    const b = parseBuildInfo({ solcLongVersion: SOLC, input, output: out });
    const r = await run(d.address, b);
    expect(r.match).toBe("full");
    expect(r.contract).toEqual({ path: "Two.sol", name: "Larger" });
  }, 120_000);

  it("resolves a Foundry-style short compiler version to the official release", async () => {
    expect(await compiler.resolveVersion("0.8.28")).toBe(SOLC);
    expect(await compiler.resolveVersion(`v${SOLC}`)).toBe(SOLC);
    await expect(compiler.resolveVersion("0.8.999")).rejects.toThrow(/No official solc release/);

    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    const b = parseBuildInfo({ solcLongVersion: "0.8.28", input: standardInput({ "Greeter.sol": GREETER }) });
    const r = await run(d.address, b, { contract: "Greeter.sol:Greeter" });
    expect(r.match).toBe("full");
    expect(r.compilerVersion).toBe(SOLC);
  }, 120_000);

  it("refuses an RPC on a different chain", async () => {
    const d = await deployFrom("Greeter.sol", GREETER, "Greeter");
    await expect(run(d.address, build({ "Greeter.sol": GREETER }), { chainId: 9801 })).rejects.toThrow(
      /expected 9801/,
    );
  }, 120_000);

  it("refuses an address with no code", async () => {
    await expect(run(anvilAccount.address, build({ "Greeter.sol": GREETER }))).rejects.toThrow(/No contract code/);
  }, 120_000);
});
