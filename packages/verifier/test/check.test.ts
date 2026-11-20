import { describe, expect, it } from "vitest";
import { compareWithRecord } from "../src/check.js";
import type { OnchainHallmark } from "../src/registry.js";
import type { VerifyResult } from "../src/verify.js";

const record: OnchainHallmark = {
  target: "0xa901eE7138266aBc456C8d717fa94B043078B8C4",
  match: "full",
  pqcFlags: 2,
  verifiedAt: 1,
  deployer: "0x649934C10225DDeD1d15a59e43221b1767b81ad2",
  runtimeCodeHash: "0x3e712b7d83ea10f3dc6677a92e057ab6d9a70445da61b67b41de031f17ac5239",
  sourceHash: "0x01eb5f698bfde958874f92e04ff6c9bea7d2fb2a97885768b53bd8d7910c2f01",
  compiler: "0.8.28+commit.7893614a",
  sourceUri: "https://example/c/x",
  isCurrent: true,
};

const local: VerifyResult = {
  address: record.target,
  chainId: 9800,
  match: "full",
  runtimeMatch: "perfect",
  creationMatch: "perfect",
  compilerVersion: record.compiler,
  sourceHash: record.sourceHash.toUpperCase().replace("0X", "0x") as `0x${string}`,
  onchainCodeHash: record.runtimeCodeHash as `0x${string}`,
  deployer: record.deployer,
  pqc: { usesVerify: false, usesKeyStatus: true, flags: 2, sourceRefs: [] },
  attempts: [],
};

describe("compareWithRecord", () => {
  it("confirms a run that reproduces the record (hash case ignored)", () => {
    const r = compareWithRecord(local, record);
    expect(r.verdict).toBe("confirmed");
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.checks).toHaveLength(6);
  });

  it("contradicts when the code no longer matches", () => {
    expect(compareWithRecord({ ...local, match: "none", runtimeMatch: null, creationMatch: null }, record).verdict).toBe("contradicted");
  });

  it("contradicts when the deployed code changed since the record", () => {
    expect(compareWithRecord({ ...local, onchainCodeHash: `0x${"11".repeat(32)}` }, record).verdict).toBe("contradicted");
  });

  it("contradicts a recorded post-quantum flag the code does not have", () => {
    const r = compareWithRecord({ ...local, pqc: { ...local.pqc!, usesKeyStatus: false, flags: 0 } }, record);
    expect(r.verdict).toBe("contradicted");
    expect(r.checks.find((c) => c.name === "post-quantum report as recorded")?.detail).toBe(
      "here none, recorded pqcKeyStatus",
    );
  });

  it("contradicts a recorded full match that the recorded sources only reproduce partially", () => {
    expect(compareWithRecord({ ...local, match: "partial", runtimeMatch: "partial" }, record).verdict).toBe("contradicted");
  });

  it("only notes a difference when other sources still match the code", () => {
    const r = compareWithRecord({ ...local, match: "partial", runtimeMatch: "partial", sourceHash: `0x${"22".repeat(32)}` }, record);
    expect(r.verdict).toBe("differs");
  });

  it("contradicts a different deployer", () => {
    expect(compareWithRecord({ ...local, deployer: "0x0000000000000000000000000000000000000001" }, record).verdict).toBe("contradicted");
  });

  it("skips the deployer check when the local run had no creation transaction", () => {
    const r = compareWithRecord({ ...local, deployer: undefined }, record);
    expect(r.verdict).toBe("confirmed");
    expect(r.checks).toHaveLength(5);
  });
});
