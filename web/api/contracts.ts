import { json, reader } from "./_lib.js";

/** GET /api/contracts?start=0&limit=20 : hallmarked contracts, newest first. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const r = reader();
  const total = await r.count();
  // Newest first: page backwards from the end of the registry's list.
  const page = Math.max(Number(params.get("page")) || 0, 0);
  const end = Math.max(total - page * limit, 0);
  const start = Math.max(end - limit, 0);
  const targets = end > start ? (await r.targets(start, end - start)).reverse() : [];
  // Bound concurrent eth_call fan-out (each r.get issues 3 reads) to avoid testnet RPC 503 bursts.
  const items = [];
  for (let i = 0; i < targets.length; i += 3) {
    const batch = await Promise.all(targets.slice(i, i + 3).map((t) => r.get(t)));
    for (const item of batch) if (item) items.push(item);
  }

  return json({ total, page, limit, items }, 200, {
    "cache-control": "public, max-age=0, s-maxage=3, stale-while-revalidate=30",
    "access-control-allow-origin": "*",
  });
}
