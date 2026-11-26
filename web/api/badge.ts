import { detectProxy } from "@hallmark/verifier";
import { getAddress } from "viem";
import { addressParam, reader } from "./_lib.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function svg(left: string, right: string, color: string): string {
  // Width from a rough 6.5px-per-character estimate of an 11px sans-serif font.
  const w = (t: string) => Math.round(t.length * 6.5 + 12);
  const lw = w(left);
  const rw = w(right);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(`${left}: ${right}`)}">
<title>${esc(`${left}: ${right}`)}</title>
<rect width="${lw}" height="20" fill="#15171b"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/>
<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14">${esc(left)}</text><text x="${lw + rw / 2}" y="14">${esc(right)}</text></g></svg>`;
}

/** GET /api/badge?address=0x… : an SVG badge for READMEs. */
export async function GET(request: Request): Promise<Response> {
  const address = addressParam(request);
  let right = "invalid address";
  let color = "#5f6672";
  if (address) {
    const r = reader();
    const [h, proxy] = await Promise.all([
      r.get(address).catch(() => undefined),
      detectProxy(r.client, getAddress(address)).catch(() => undefined),
    ]);
    if (!h) {
      right = "not hallmarked";
    } else if (!h.isCurrent) {
      right = "code changed";
      color = "#c23b3b";
    } else {
      const pq = h.pqcFlags ? " · PQ-guarded" : "";
      // An upgradeable proxy's hallmark says nothing about the code it runs: say so on the badge.
      const px = proxy?.upgradeable ? " · proxy" : "";
      right = `${h.match === "full" ? "full match" : "partial match"}${pq}${px}`;
      // White text on these keeps at least 4.5:1 contrast.
      color = h.match === "full" ? "#0f7a52" : "#a14f0b";
    }
  }
  return new Response(svg("Hallmark", right, color), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
