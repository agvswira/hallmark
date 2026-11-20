import { describe, expect, it } from "vitest";
import { canonicalJson, parseBuildInfo, sourceHash } from "../src/input.js";
import { findSourceRefs, pushedValues, stripMetadata, hexToBytes } from "../src/pqc.js";
import { toLevel } from "../src/verify.js";

const INPUT = {
  language: "Solidity",
  sources: { "A.sol": { content: "contract A {}" } },
  settings: { optimizer: { enabled: true, runs: 200 } },
};

describe("parseBuildInfo", () => {
  it("reads a Foundry/Hardhat build-info file", () => {
    const b = parseBuildInfo({ solcLongVersion: "0.8.28+commit.7893614a", input: INPUT });
    expect(b.compilerVersion).toBe("0.8.28+commit.7893614a");
    expect(b.contracts).toEqual([{ path: "A.sol", name: "A" }]);
  });

  it("accepts a bare standard JSON input with a separate version", () => {
    const b = parseBuildInfo(INPUT, "v0.8.28+commit.7893614a");
    expect(b.compilerVersion).toBe("0.8.28+commit.7893614a");
  });

  it("requires a full compiler version", () => {
    expect(() => parseBuildInfo({ solcVersion: "0.8.28", input: INPUT })).toThrow(/full compiler version/);
  });

  it("rejects input that is not Solidity", () => {
    expect(() => parseBuildInfo({ solcLongVersion: "0.8.28+commit.7893614a", input: { language: "Vyper" } })).toThrow();
  });

  it("skips interfaces in the build output", () => {
    const b = parseBuildInfo({
      solcLongVersion: "0.8.28+commit.7893614a",
      input: INPUT,
      output: { contracts: { "A.sol": { A: { evm: { deployedBytecode: { object: "6080" } } }, I: { evm: { deployedBytecode: { object: "" } } } } } },
    });
    expect(b.contracts).toEqual([{ path: "A.sol", name: "A", runtimeHexLength: 4 }]);
  });
});

describe("sourceHash", () => {
  it("does not depend on key order or formatting", () => {
    const reordered = { settings: INPUT.settings, sources: INPUT.sources, language: "Solidity" };
    expect(sourceHash(reordered as any)).toBe(sourceHash(INPUT as any));
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
  });

  it("changes when a source changes", () => {
    const changed = { ...INPUT, sources: { "A.sol": { content: "contract A { }" } } };
    expect(sourceHash(changed as any)).not.toBe(sourceHash(INPUT as any));
  });
});

describe("bytecode scanning", () => {
  it("reads PUSH values and skips their data bytes", () => {
    // PUSH2 0x0a02, PUSH1 0x61 (a PUSH2 opcode byte as data), STOP
    expect(pushedValues("0x610a02606100")).toEqual([0xa02n, 0x61n]);
  });

  it("ignores values inside the metadata trailer", () => {
    // code: PUSH1 0x01; trailer: a1 61 0a 02 (CBOR map holding bytes that look like PUSH2 0x0a02), length 0x0004
    const hex = "0x6001" + "a1610a02" + "0004";
    expect(pushedValues(hex)).toEqual([1n]);
    expect(stripMetadata(hexToBytes(hex))).toEqual(hexToBytes("0x6001"));
  });

  it("leaves code without a valid trailer untouched", () => {
    expect(stripMetadata(hexToBytes("0x60016002"))).toEqual(hexToBytes("0x60016002"));
  });

  it("rejects malformed hex", () => {
    expect(() => pushedValues("0x6g")).toThrow();
  });
});

describe("findSourceRefs", () => {
  it("finds precompile literals with their enclosing function, ignoring comments", () => {
    const content = [
      "contract C {",
      "    // calls 0x0a01 later",
      "    function f() external {",
      "        address(0x0000000000000000000000000000000000000A01).staticcall(\"\");",
      "    }",
      "    uint256 constant N = 0x0a0123;",
      "}",
    ].join("\n");
    const refs = findSourceRefs({ "C.sol": { content } });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ line: 4, scope: "f", precompile: "pqcVerify" });
  });
});

describe("findSourceRefs with named constants", () => {
  it("reports the functions that use a constant declared over two lines", () => {
    const content = [
      "contract R {",
      "    address public constant PQC =",
      "        0x0000000000000000000000000000000000000a02;",
      "    function start(address p) external view {",
      "        (bool ok,) = PQC.staticcall(abi.encode(p));",
      "    }",
      "}",
    ].join("\n");
    const refs = findSourceRefs({ "R.sol": { content } });
    expect(refs.map((r) => [r.line, r.scope])).toEqual([
      [3, undefined],
      [5, "start"],
    ]);
  });
});

describe("toLevel", () => {
  it("maps Sourcify statuses to Hallmark match levels", () => {
    expect(toLevel("perfect", null)).toBe("full");
    expect(toLevel("partial", "perfect")).toBe("full");
    expect(toLevel("partial", null)).toBe("partial");
    expect(toLevel(null, "partial")).toBe("partial");
    expect(toLevel("error", null)).toBe("none");
    expect(toLevel("extra-file-input-bug", null)).toBe("none");
  });
});
