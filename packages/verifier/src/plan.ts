import type { OnchainHallmark } from "./registry.js";
import type { VerifyResult } from "./verify.js";

/**
 * What to do with a verification result, given the record already on chain.
 *
 *  - "record": write it to the registry, then store its sources.
 *  - "store-only": no record exists and none can be written (no deployer, or no verifier
 *    configured): keep the sources so the page can show the match, marked as unrecorded.
 *  - "unchanged": the registry already holds exactly this result; nothing to write.
 *  - "refuse": the result would weaken or contradict the existing record; write and store nothing.
 *
 * Stored sources must never disagree with the on-chain record, so anything that is not going to
 * be recorded is never stored over an existing record.
 */
export type RecordAction = "record" | "store-only" | "unchanged" | "refuse";

const LEVEL = { none: 0, partial: 1, full: 2 } as const;

export function planRecording(
  result: VerifyResult,
  existing: OnchainHallmark | undefined,
  opts: {
    canRecord: boolean;
    sourceUri?: string;
    /** The result already stored off chain for this address, if any. */
    stored?: Pick<VerifyResult, "match" | "sourceHash">;
  },
): { action: RecordAction; reason: string } {
  if (result.match === "none") return { action: "refuse", reason: "No match." };
  const recordable = opts.canRecord && Boolean(result.deployer);

  if (!existing) {
    // Unrecorded results must not replace a stronger, or a different equally strong, stored one.
    const s = opts.stored;
    if (!recordable && s && (LEVEL[result.match] < LEVEL[s.match] || (LEVEL[result.match] === LEVEL[s.match] && s.sourceHash.toLowerCase() !== result.sourceHash.toLowerCase()))) {
      return {
        action: "refuse",
        reason: "Other sources are already stored for this contract. Include the deployment transaction so the result can be recorded on chain.",
      };
    }
    return recordable
      ? { action: "record", reason: "First record for this contract." }
      : {
          action: "store-only",
          reason: result.deployer
            ? "Matched. This server is not configured to record on chain."
            : "Matched, but without the deployment transaction the deployer is unknown, so it was not recorded on chain.",
        };
  }

  const sameCode = existing.runtimeCodeHash.toLowerCase() === result.onchainCodeHash.toLowerCase();
  if (sameCode && LEVEL[result.match] < LEVEL[existing.match]) {
    return { action: "refuse", reason: "This code already has a full hallmark; a partial match does not replace it." };
  }
  if (
    sameCode &&
    existing.match === result.match &&
    existing.compiler === result.compilerVersion &&
    existing.sourceHash.toLowerCase() === result.sourceHash.toLowerCase() &&
    existing.pqcFlags === (result.pqc?.flags ?? 0) &&
    result.deployer !== undefined &&
    existing.deployer.toLowerCase() === result.deployer.toLowerCase() &&
    (opts.sourceUri === undefined || existing.sourceUri === opts.sourceUri)
  ) {
    return { action: "unchanged", reason: "The registry already holds this exact result." };
  }
  if (!recordable) {
    return {
      action: "refuse",
      reason: "This contract already has an on-chain record. A new result replaces it only when it can be recorded, which needs the deployment transaction.",
    };
  }
  return { action: "record", reason: sameCode ? "Updates the existing record." : "The code changed since the last record." };
}
