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
  const items = (await Promise.all(targets.map((t) => r.get(t)))).filter(Boolean);

  return json({ total, page, limit, items }, 200, { "cache-control": "public, max-age=0, s-maxage=3, stale-while-revalidate=30" });
}
