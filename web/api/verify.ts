import { parseBuildInfo, recordOnchain, verifyContract, type VerifyResult } from "@hallmark/verifier";
import type { Hex } from "viem";
import { fail, getCompiler, json, rateLimited, saveVerification } from "./_lib.js";

/**
 * POST /api/verify
 * { address, txHash?, contract?, compilerVersion, input }
 *
 * The browser strips the compiler output from the build-info file and sends only the
 * standard JSON input (build-info files are often larger than the 4.5 MB request limit).
 * On a match with a known deployer, the result is recorded in HallmarkRegistry.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(request)) return fail(429, "Too many verifications from this address. Try again in a minute.");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "The request body must be JSON.");
  }

  const address = String(body.address ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return fail(400, "Enter a contract address: 0x followed by 40 hex characters.");
  const txHash = body.txHash ? String(body.txHash) : undefined;
  if (txHash && !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return fail(400, "The deployment transaction hash must be 0x followed by 64 hex characters.");

  let build;
  try {
    build = parseBuildInfo({ solcLongVersion: body.compilerVersion, input: body.input });
  } catch (err) {
    return fail(400, (err as Error).message);
  }

  let result: VerifyResult;
  try {
    result = await verifyContract({
      address,
      build,
      contract: body.contract ? String(body.contract) : undefined,
      creationTxHash: txHash,
      compiler: getCompiler(),
      rpcUrl: process.env.HALLMARK_RPC_URL || undefined,
    });
  } catch (err) {
    return fail(422, (err as Error).message);
  }

  if (result.match === "none") return json({ result, recorded: false, reason: "No match." });

  await saveVerification(address, { result, input: build.input as any, storedAt: new Date().toISOString() });

  if (!result.deployer) {
    return json({
      result,
      recorded: false,
      reason: "Matched, but without the deployment transaction the deployer is unknown, so it was not recorded on chain.",
    });
  }

  const key = process.env.HALLMARK_VERIFIER_KEY as Hex | undefined;
  const publicUrl = process.env.HALLMARK_PUBLIC_URL?.replace(/\/$/, "");
  if (!key || !publicUrl) {
    return json({ result, recorded: false, reason: "This server has no verifier key or public URL configured." });
  }

  try {
    const recordTx = await recordOnchain({
      result,
      verifierKey: key,
      sourceUri: `${publicUrl}/c/${result.address.toLowerCase()}`,
      rpcUrl: process.env.HALLMARK_RPC_URL || undefined,
    });
    await saveVerification(address, { result, input: build.input as any, recordTx, storedAt: new Date().toISOString() });
    return json({ result, recorded: true, recordTx });
  } catch (err) {
    const message = (err as Error).message;
    // A full hallmark cannot be downgraded: the registry refuses, and the existing record stands.
    const reason = /Downgrade/.test(message)
      ? "This code already has a full hallmark; a partial match does not replace it."
      : `Matched, but recording on chain failed: ${message.split("\n")[0]}`;
    return json({ result, recorded: false, reason });
  }
}
