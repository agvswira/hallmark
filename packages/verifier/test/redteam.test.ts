/**
 * Red-team: attempts to make the verifier say more than the chain supports. Every test deploys
 * real compiled code to a local chain (chain id 9800) and asserts the SAFE outcome. A failing
 * test here is a finding; docs/ai/redteam.md records what each attack showed and what changed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Abi, Hex } from "viem";
import { encodeFunctionData, getAddress } from "viem";
import { detectProxy } from "../src/proxy.js";
import { verifyContract } from "../src/verify.js";
import { parseBuildInfo } from "../src/input.js";
import { compile, compiler, SOLC, standardInput, startAnvil, type LocalChain } from "./helpers.js";
import { GREETER, GREETER_COMMENTED, SIG_CHECK } from "./fixtures.js";

let chain: LocalChain;
beforeAll(async () => {
  chain = await startAnvil(9800);
}, 120_000);
afterAll(() => chain?.stop());

async function deploy(sources: Record<string, string>, file: string, name: string, settings = {}, args: unknown[] = []) {
  const input = standardInput(sources, settings);
  const out = await compile(input);
  const c = out.contracts[file][name];
  return chain.deploy(c.abi as Abi, `0x${c.evm.bytecode.object}` as Hex, args);
}

const verify = (address: string, sources: Record<string, string>, contract: string, settings = {}, version = SOLC, tx?: string) =>
  verifyContract({
    address,
    build: parseBuildInfo({ solcLongVersion: version, input: standardInput(sources, settings) }),
    contract,
    creationTxHash: tx,
    rpcUrl: chain.rpcUrl,
    compiler,
  });

const NO_CBOR = { metadata: { appendCBOR: false } };
const NO_HASH = { metadata: { bytecodeHash: "none" } };

describe("red team: claiming a full match with other sources", () => {
  it("A1: code built without a metadata trailer cannot be fully matched to edited sources", async () => {
    const d = await deploy({ "Greeter.sol": GREETER }, "Greeter.sol", "Greeter", NO_CBOR);
    const r = await verify(d.address, { "Greeter.sol": GREETER_COMMENTED }, "Greeter.sol:Greeter", NO_CBOR, SOLC, d.txHash);
    expect(r.match).not.toBe("full");
  }, 120_000);

  it("A2: code built with bytecodeHash none cannot be fully matched to edited sources", async () => {
    const d = await deploy({ "Greeter.sol": GREETER }, "Greeter.sol", "Greeter", NO_HASH);
    const r = await verify(d.address, { "Greeter.sol": GREETER_COMMENTED }, "Greeter.sol:Greeter", NO_HASH, SOLC, d.txHash);
    expect(r.match).not.toBe("full");
  }, 120_000);

  it("A3: code built without metadata cannot be fully matched under another compiler version", async () => {
    const d = await deploy({ "Greeter.sol": GREETER }, "Greeter.sol", "Greeter", NO_CBOR);
    const other = GREETER.replace("pragma solidity 0.8.28;", "pragma solidity ^0.8.24;");
    const r = await verify(d.address, { "Greeter.sol": other }, "Greeter.sol:Greeter", NO_CBOR, "0.8.27+commit.40a35a09", d.txHash);
    expect(r.match).not.toBe("full");
  }, 120_000);

  it("A6: an identical contract under another name is not a full match", async () => {
    const twin = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract Real { uint256 public answer = 1; function set(uint256 v) external { answer = v; } }
contract Fake { uint256 public answer = 1; function set(uint256 v) external { answer = v; } }
`;
    const d = await deploy({ "Twin.sol": twin }, "Twin.sol", "Real");
    const r = await verify(d.address, { "Twin.sol": twin }, "Twin.sol:Fake", {}, SOLC, d.txHash);
    expect(r.match).not.toBe("full");
  }, 120_000);
});

describe("red team: the post-quantum report", () => {
  it("A4: source that calls pqcVerify through an immutable, deployed with a fake verifier, is not reported as PQ-guarded", async () => {
    const fakeVerifier = "0x000000000000000000000000000000000000dEaD";
    const d = await deploy({ "SigCheck.sol": SIG_CHECK }, "SigCheck.sol", "SigCheck", {}, [fakeVerifier]);
    const r = await verify(d.address, { "SigCheck.sol": SIG_CHECK }, "SigCheck.sol:SigCheck", {}, SOLC, d.txHash);
    // The code really is this source (full match), but it does not call the precompile.
    expect(r.match).toBe("full");
    expect(r.pqc?.flags).toBe(0);
  }, 120_000);

  it("A7: returning 0x0a01 / 0x0a02 constants without any external call is not reported as PQ-guarded", async () => {
    const fakeConstants = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract FakeConstants {
    function ids() external pure returns (uint256, uint256) {
        return (0x0a01, 0x0a02);
    }
}
`;
    const d = await deploy({ "FakeConstants.sol": fakeConstants }, "FakeConstants.sol", "FakeConstants");
    const r = await verify(d.address, { "FakeConstants.sol": fakeConstants }, "FakeConstants.sol:FakeConstants", {}, SOLC, d.txHash);
    expect(r.match).toBe("full");
    expect(r.pqc?.flags).toBe(0);
    expect(r.pqc?.sourceRefs).toEqual([]);
  }, 120_000);
});

describe("red team: proxies", () => {
  const PROXY = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Minimal EIP-1967 proxy: the code never changes, the implementation can.
contract Proxy {
    bytes32 private constant IMPL = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address impl) {
        assembly { sstore(IMPL, impl) }
    }

    function upgrade(address impl) external {
        assembly { sstore(IMPL, impl) }
    }

    fallback() external payable {
        assembly {
            let impl := sload(IMPL)
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) }
        }
    }
}
`;

  it("A5: a verified EIP-1967 proxy is reported as a proxy, with its current implementation", async () => {
    const impl = await deploy({ "Greeter.sol": GREETER }, "Greeter.sol", "Greeter");
    const d = await deploy({ "Proxy.sol": PROXY }, "Proxy.sol", "Proxy", {}, [impl.address]);
    const r = await verify(d.address, { "Proxy.sol": PROXY }, "Proxy.sol:Proxy", {}, SOLC, d.txHash);
    expect(r.match).toBe("full");
    expect(r.proxy?.kind).toBe("eip1967");
    expect(r.proxy?.implementation?.toLowerCase()).toBe(impl.address.toLowerCase());
  }, 120_000);

  it("A5c: an upgrade after verification shows up: the implementation is read live, not from the record", async () => {
    const impl = await deploy({ "Greeter.sol": GREETER }, "Greeter.sol", "Greeter");
    const evil = await deploy({ "Greeter.sol": GREETER_COMMENTED }, "Greeter.sol", "Greeter");
    const d = await deploy({ "Proxy.sol": PROXY }, "Proxy.sol", "Proxy", {}, [impl.address]);
    const before = await chain.client.getCode({ address: d.address });
    await chain.send(
      d.address,
      encodeFunctionData({
        abi: [{ type: "function", name: "upgrade", stateMutability: "nonpayable", inputs: [{ type: "address", name: "impl" }], outputs: [] }],
        functionName: "upgrade",
        args: [evil.address],
      }),
    );
    // The proxy's code hash, and so its record, is unchanged; only the live read reveals the swap.
    expect(await chain.client.getCode({ address: d.address })).toBe(before);
    const p = await detectProxy(chain.client as any, getAddress(d.address));
    expect(p?.upgradeable).toBe(true);
    expect(p?.implementation?.toLowerCase()).toBe(evil.address.toLowerCase());
  }, 120_000);

  it("A5d: an EIP-1167 clone is reported with the code it always runs", async () => {
    const target = "0x" + "ab".repeat(20);
    const clone = `0x363d3d373d3d3d363d73${target.slice(2)}5af43d82803e903d91602b57fd5bf3` as Hex;
    const p = await detectProxy(chain.client as any, "0x0000000000000000000000000000000000000001", clone);
    expect(p).toEqual({ kind: "eip1167", implementation: getAddress(target), upgradeable: false });
  });

  it("A5b: a contract that is not a proxy reports none", async () => {
    const d = await deploy({ "Greeter.sol": GREETER }, "Greeter.sol", "Greeter");
    const r = await verify(d.address, { "Greeter.sol": GREETER }, "Greeter.sol:Greeter", {}, SOLC, d.txHash);
    expect(r.proxy).toBeUndefined();
  }, 120_000);
});
