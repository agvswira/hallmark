import { detectProxy } from "@hallmark/verifier";
import { getAddress } from "viem";
import { addressParam, fail, json, loadVerification, reader } from "./_lib.js";

/**
 * GET /api/contract?address=0x… : the on-chain record, the stored verification, and, for proxies,
 * the implementation they delegate to right now (read live: it can change after verification).
 */
export async function GET(request: Request): Promise<Response> {
  const address = addressParam(request);
  if (!address) return fail(400, "Pass ?address=0x… (40 hex characters).");

  const r = reader();
  const [onchain, stored] = await Promise.all([r.get(address), loadVerification(address)]);
  if (!onchain && !stored) return fail(404, "This contract has no hallmark yet.");
  const proxy = await detectProxy(r.client, getAddress(address)).catch(() => undefined);

  return json({ address, onchain: onchain ?? null, stored: stored ?? null, proxy: proxy ?? null }, 200, {
    "cache-control": "public, max-age=0, s-maxage=3, stale-while-revalidate=30",
    "access-control-allow-origin": "*",
  });
}
