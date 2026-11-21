import { parseBuildInfo, planRecording, recordOnchain, verifyContract, type VerifyResult } from "@hallmark/verifier";
import { fail, getCompiler, json, loadVerification, rateLimited, reader, saveVerification } from "./_lib.js";

/**
 * POST /api/verify
 * { address, txHash?, contract?, compilerVersion, input }
 *
 * The browser strips the compiler output from the build-info file and sends only the
 * standard JSON input (build-info files are often larger than the 4.5 MB request limit).
 *
 * Order matters: the existing on-chain record is read first, and sources are stored only after
 * the result has been recorded (or when there is no record at all). Stored sources therefore never
 * disagree with the registry, and a weaker or unrecordable submission cannot replace them.
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
      // Each candidate is a full compilation: keep guessing cheap when no contract is named.
      maxCandidates: 3,
    });
  } catch (err) {
    return fail(422, (err as Error).message);
  }

  const mnemonic = process.env.HALLMARK_VERIFIER_MNEMONIC;
  const publicUrl = process.env.HALLMARK_PUBLIC_URL?.replace(/\/$/, "");
  const sourceUri = publicUrl ? `${publicUrl}/c/${result.address.toLowerCase()}` : undefined;
  const [existing, stored] = await Promise.all([reader().get(address), loadVerification(address)]);
  const { action, reason } = planRecording(result, existing, {
    canRecord: Boolean(mnemonic && publicUrl),
    sourceUri,
    stored: stored?.result,
  });
  const doc = { result, input: build.input as any, storedAt: new Date().toISOString() };

  switch (action) {
    case "refuse":
      return json({ result, recorded: false, reason });

    case "store-only":
      await saveVerification(address, doc);
      return json({ result, recorded: false, reason });

    case "unchanged": {
      // The record stands. This result reproduces it exactly, so its sources are the right ones to
      // keep: restore them if they are missing or do not match the record.
      if (!stored || stored.result.sourceHash.toLowerCase() !== existing!.sourceHash.toLowerCase()) {
        await saveVerification(address, { ...doc, recordTx: stored?.recordTx });
      }
      return json({ result, recorded: true, unchanged: true, recordTx: stored?.recordTx, reason });
    }

    case "record":
      try {
        const recordTx = await recordOnchain({
          result,
          mnemonic: mnemonic!,
          sourceUri: sourceUri!,
          log: (m) => console.log(`[hallmark] ${m}`),
          rpcUrl: process.env.HALLMARK_RPC_URL || undefined,
        });
        await saveVerification(address, { ...doc, recordTx });
        return json({ result, recorded: true, recordTx });
      } catch (err) {
        const message = (err as Error).message;
        // Another verification can land between reading the record and sending: the registry then
        // refuses a downgrade itself.
        const reason = /Downgrade/.test(message)
          ? "This code already has a full hallmark; a partial match does not replace it."
          : `Matched, but recording on chain failed: ${message.split("\n")[0]}`;
        return json({ result, recorded: false, reason });
      }
  }
}
