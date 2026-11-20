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
 * Verified sources are stored as one JSON document per contract: in Vercel Blob when
 * BLOB_READ_WRITE_TOKEN is set, otherwise in web/.data (local development).
 */
const blobPath = (address: string) => `verifications/${address.toLowerCase()}.json`;
const localDir = () => join(process.cwd(), ".data");

export async function saveVerification(address: string, doc: StoredVerification): Promise<void> {
  const body = JSON.stringify(doc);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { head } = await import("@vercel/blob");
      const meta = await head(blobPath(address));
      const res = await fetch(meta.url);
      return res.ok ? ((await res.json()) as StoredVerification) : undefined;
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
