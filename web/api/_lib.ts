// Shared server code for the Hallmark API (Vercel Functions in production, the Vite dev
// server locally). Files starting with "_" are not routes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SolcJsCompiler,
  registryReader,
  type OnchainHallmark,
  type VerifyResult,
} from "@hallmark/verifier";

/** What Hallmark keeps for each verified contract, next to the on-chain record. */
export interface StoredVerification {
  result: VerifyResult;
  /** The standard JSON input that was compiled (sources and settings). */
  input: { language: string; sources: Record<string, { content?: string }>; settings: unknown };
  recordTx?: string;
  storedAt: string;
}

// ---------------------------------------------------------------- responses

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const fail = (status: number, error: string) => json({ error }, status);

export function addressParam(request: Request): string | undefined {
  const a = new URL(request.url).searchParams.get("address") ?? "";
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : undefined;
}

// ---------------------------------------------------------------- compiler

let compiler: SolcJsCompiler | undefined;
/** One compiler per instance; on Vercel only /tmp is writable. */
export function getCompiler() {
  compiler ??= new SolcJsCompiler(
    process.env.VERCEL ? join(tmpdir(), "solc") : join(process.cwd(), ".cache", "solc"),
  );
  return compiler;
}

export const reader = () => registryReader(process.env.HALLMARK_RPC_URL || undefined);

// ---------------------------------------------------------------- storage

/**
 * Verified sources are stored as one JSON document per contract: in a public Vercel Blob store
 * when one is connected (BLOB_STORE_ID with OIDC credentials, or a BLOB_READ_WRITE_TOKEN),
 * otherwise in web/.data (local development). The sources are public by design: anyone can
 * download them and rerun the verification with the hallmark CLI.
 */
const blobPath = (address: string) => `verifications/${address.toLowerCase()}.json`;
const localDir = () => join(process.cwd(), ".data");
const useBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

export async function saveVerification(address: string, doc: StoredVerification): Promise<void> {
  const body = JSON.stringify(doc);
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    await put(blobPath(address), body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const file = join(localDir(), blobPath(address));
  await mkdir(join(localDir(), "verifications"), { recursive: true });
  await writeFile(file, body);
}

export async function loadVerification(address: string): Promise<StoredVerification | undefined> {
  try {
    if (useBlob()) {
      const { get } = await import("@vercel/blob");
      // Skip the CDN cache: a re-verification overwrites the document in place.
      const found = await get(blobPath(address), { access: "public", useCache: false });
      if (!found || found.statusCode !== 200 || !found.stream) return undefined;
      return (await new Response(found.stream).json()) as StoredVerification;
    }
    return JSON.parse(await readFile(join(localDir(), blobPath(address)), "utf8"));
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- rate limit

const hits = new Map<string, number[]>();
/** A small per-instance limit on verifications, which cost compile time and gas. */
export function rateLimited(request: Request, limit = 6, windowMs = 60_000): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}

export type { OnchainHallmark, VerifyResult };
