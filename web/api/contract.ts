import { addressParam, fail, json, loadVerification, reader } from "./_lib.js";

/** GET /api/contract?address=0x… : the on-chain record plus the stored verification. */
export async function GET(request: Request): Promise<Response> {
  const address = addressParam(request);
  if (!address) return fail(400, "Pass ?address=0x… (40 hex characters).");

  const [onchain, stored] = await Promise.all([reader().get(address), loadVerification(address)]);
  if (!onchain && !stored) return fail(404, "This contract has no hallmark yet.");

  return json({ address, onchain: onchain ?? null, stored: stored ?? null }, 200, {
    "cache-control": "public, max-age=0, s-maxage=3, stale-while-revalidate=30",
  });
}
