import { describe, expect, it } from "vitest";
import type { EvmWindow } from "@qorechain/evm";
import { DEFAULT_POLICY, REGISTRY_CALL_COST, windowShortfall } from "../src/window.js";
import { REGISTRY_ADDRESS } from "../src/registry.js";

const healthy: EvmWindow = {
  found: true,
  live: true,
  openedHeight: 100n,
  expiryHeight: 17_380n,
  maxTxs: 200n,
  usedTxs: 0n,
  maxValue: REGISTRY_CALL_COST * 200n,
  usedValue: 0n,
  remainingBlocks: 10_000n,
  remainingTxs: 200n,
  remainingValue: REGISTRY_CALL_COST * 200n,
  nativeOnly: false,
  allowedTargets: [REGISTRY_ADDRESS.toUpperCase().replace("0X", "0x")],
};

describe("windowShortfall", () => {
  it("accepts a live window scoped to the registry with room left (address case ignored)", () => {
    expect(windowShortfall(healthy)).toBeUndefined();
  });

  it("asks for a window when there is none or it is unusable", () => {
    expect(windowShortfall({ ...healthy, found: false })).toBe("no window");
    expect(windowShortfall({ ...healthy, live: false })).toBe("window not usable");
  });

  it("replaces an unscoped window, or one scoped to anything else as well", () => {
    expect(windowShortfall({ ...healthy, allowedTargets: [] })).toBe("window not scoped to the registry");
    expect(windowShortfall({ ...healthy, allowedTargets: [REGISTRY_ADDRESS, "0x0000000000000000000000000000000000000001"] })).toBe(
      "window not scoped to the registry",
    );
  });

  it("reopens before blocks, transactions or value run out", () => {
    expect(windowShortfall({ ...healthy, remainingBlocks: DEFAULT_POLICY.minBlocks - 1n })).toMatch(/blocks left/);
    expect(windowShortfall({ ...healthy, remainingTxs: 2n })).toMatch(/transactions left/);
    expect(windowShortfall({ ...healthy, remainingValue: REGISTRY_CALL_COST })).toMatch(/uqor left/);
  });

  it("sizes a new window for registry calls only", () => {
    // 600k gas at 250 gwei = 0.15 QOR = 150,000 uqor per call.
    expect(REGISTRY_CALL_COST).toBe(150_000n);
    expect(DEFAULT_POLICY.openValue).toBe(30_000_000n); // 30 QOR for 200 calls
    expect(DEFAULT_POLICY.target).toBe(REGISTRY_ADDRESS);
  });
});
