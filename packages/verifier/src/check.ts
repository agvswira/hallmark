import type { OnchainHallmark } from "./registry.js";
import type { VerifyResult } from "./verify.js";

export interface CheckItem {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * "confirmed": a local recompilation reproduces everything the on-chain record says.
 * "differs": the code matches, but not with the same sources or settings as the record.
 * "contradicted": the local run disagrees with the record on the code itself.
 */
export type CheckVerdict = "confirmed" | "differs" | "contradicted";

const flagNames = (flags: number) =>
  [flags & 1 ? "pqcVerify" : "", flags & 2 ? "pqcKeyStatus" : ""].filter(Boolean).join(" + ") || "none";

/**
 * Compares a verification run on this machine with a HallmarkRegistry record. Pure: no
 * network, so it is the same logic whether the sources came from a local build or from
 * Hallmark's server.
 */
export function compareWithRecord(local: VerifyResult, record: OnchainHallmark): { verdict: CheckVerdict; checks: CheckItem[] } {
  const checks: CheckItem[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  add(
    "code matches",
    local.match !== "none",
    local.match === "none"
      ? `no match here (${local.attempts.map((a) => a.error).join("; ") || "nothing tried"})`
      : `${local.match} match (runtime ${local.runtimeMatch}, creation ${local.creationMatch ?? "not checked"})`,
  );
  add(
    "code unchanged since the record",
    local.onchainCodeHash.toLowerCase() === record.runtimeCodeHash.toLowerCase(),
    `on chain now ${local.onchainCodeHash}, recorded ${record.runtimeCodeHash}`,
  );
  add(
    "match level as recorded",
    local.match === record.match,
    `here ${local.match}, recorded ${record.match}`,
  );
  add(
    "same sources and settings as recorded",
    local.sourceHash.toLowerCase() === record.sourceHash.toLowerCase(),
    `here ${local.sourceHash}, recorded ${record.sourceHash}`,
  );
  add(
    "post-quantum report as recorded",
    (local.pqc?.flags ?? 0) === record.pqcFlags,
    `here ${flagNames(local.pqc?.flags ?? 0)}, recorded ${flagNames(record.pqcFlags)}`,
  );
  if (local.deployer) {
    add(
      "deployer as recorded",
      local.deployer.toLowerCase() === record.deployer.toLowerCase(),
      `here ${local.deployer}, recorded ${record.deployer}`,
    );
  }

  const failed = new Set(checks.filter((c) => !c.ok).map((c) => c.name));
  const contradicted =
    failed.has("code matches") ||
    failed.has("code unchanged since the record") ||
    failed.has("post-quantum report as recorded") ||
    failed.has("deployer as recorded") ||
    // The record claims a full match that a run with the recorded sources cannot reproduce.
    (failed.has("match level as recorded") && !failed.has("same sources and settings as recorded"));
  const verdict: CheckVerdict = contradicted ? "contradicted" : failed.size ? "differs" : "confirmed";
  return { verdict, checks };
}
