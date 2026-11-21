import { describe, expect, it } from "vitest";
import { planRecording } from "../src/plan.js";
import type { OnchainHallmark } from "../src/registry.js";
import type { VerifyResult } from "../src/verify.js";

const CODE = `0x${"aa".repeat(32)}` as const;
const SRC = `0x${"bb".repeat(32)}` as const;
const DEPLOYER = "0x649934C10225DDeD1d15a59e43221b1767b81ad2";
const URI = "https://hallmark.example/c/0x1";

const result: VerifyResult = {
  address: "0x0000000000000000000000000000000000000001",
  chainId: 9800,
  match: "full",
  runtimeMatch: "perfect",
  creationMatch: "perfect",
  compilerVersion: "0.8.28+commit.7893614a",
  sourceHash: SRC,
  onchainCodeHash: CODE,
  deployer: DEPLOYER,
  pqc: { usesVerify: false, usesKeyStatus: true, flags: 2, sourceRefs: [] },
  attempts: [],
};

const record: OnchainHallmark = {
  target: result.address as `0x${string}`,
  match: "full",
  pqcFlags: 2,
  verifiedAt: 1,
  deployer: DEPLOYER,
  runtimeCodeHash: CODE,
  sourceHash: SRC,
  compiler: result.compilerVersion,
  sourceUri: URI,
  isCurrent: true,
};

const plan = (r: Partial<VerifyResult>, existing: OnchainHallmark | undefined, canRecord = true) =>
  planRecording({ ...result, ...r }, existing, { canRecord, sourceUri: URI }).action;

describe("planRecording", () => {
  it("records a first result with a known deployer", () => {
    expect(plan({}, undefined)).toBe("record");
  });

  it("only stores a first result it cannot record", () => {
    expect(plan({ deployer: undefined }, undefined)).toBe("store-only");
    expect(plan({}, undefined, false)).toBe("store-only");
  });

  it("refuses no match", () => {
    expect(plan({ match: "none" }, undefined)).toBe("refuse");
  });

  it("B10: never lets a partial result touch a full record of the same code", () => {
    expect(plan({ match: "partial", sourceHash: `0x${"cc".repeat(32)}` }, record)).toBe("refuse");
    expect(plan({ match: "partial", sourceHash: `0x${"cc".repeat(32)}`, deployer: undefined }, record)).toBe("refuse");
  });

  it("B10: never stores an unrecordable result over an existing record", () => {
    const partialRecord = { ...record, match: "partial" as const };
    expect(plan({ match: "partial", sourceHash: `0x${"cc".repeat(32)}`, deployer: undefined }, partialRecord)).toBe("refuse");
    expect(plan({}, partialRecord, false)).toBe("refuse");
  });

  it("B2: does not write the same result again (no gas spent on repeats)", () => {
    expect(plan({}, record)).toBe("unchanged");
  });

  it("review: an unrecorded result never replaces stronger or different stored sources", () => {
    const opts = (stored: { match: "full" | "partial"; sourceHash: `0x${string}` }) => ({ canRecord: true, sourceUri: URI, stored });
    const other = `0x${"cc".repeat(32)}` as const;
    // A partial result with other sources, and no tx hash, against a stored full result.
    expect(planRecording({ ...result, match: "partial", sourceHash: other, deployer: undefined }, undefined, opts({ match: "full", sourceHash: SRC })).action).toBe("refuse");
    // Same level, different sources.
    expect(planRecording({ ...result, sourceHash: other, deployer: undefined }, undefined, opts({ match: "full", sourceHash: SRC })).action).toBe("refuse");
    // The same sources again, or an upgrade from partial to full, may still be stored.
    expect(planRecording({ ...result, deployer: undefined }, undefined, opts({ match: "full", sourceHash: SRC })).action).toBe("store-only");
    expect(planRecording({ ...result, deployer: undefined }, undefined, opts({ match: "partial", sourceHash: other })).action).toBe("store-only");
    // A recordable result is written on chain, which settles it.
    expect(planRecording({ ...result, sourceHash: other }, undefined, opts({ match: "full", sourceHash: SRC })).action).toBe("record");
  });

  it("review: a different compiler version is not the same result", () => {
    expect(plan({ match: "partial", compilerVersion: "0.8.27+commit.40a35a09" }, { ...record, match: "partial" })).toBe("record");
  });

  it("re-records when anything differs: an upgrade, other sources, a new page URL, changed code", () => {
    expect(plan({}, { ...record, match: "partial" })).toBe("record");
    expect(plan({ sourceHash: `0x${"dd".repeat(32)}` }, record)).toBe("record");
    expect(plan({}, { ...record, sourceUri: "https://github.com/x" })).toBe("record");
    expect(plan({ onchainCodeHash: `0x${"ee".repeat(32)}`, match: "partial" }, record)).toBe("record");
  });
});
