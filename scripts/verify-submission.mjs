#!/usr/bin/env node
/**
 * Keyless, read-only submission & live-chain verifier for Hallmark.
 * Checks qorechain-diana contract state, precompile status, production Vercel API,
 * local CLI trustless recompile, QoreScan CBOM, and AI-Native documentation.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REGISTRY_ADDRESS, hallmarkRegistryAbi, registryReader } from "../packages/verifier/dist/index.js";

const VERIFIER_EVM = "0x649934C10225DDeD1d15a59e43221b1767b81ad2";
const VERIFIER_COSMOS = "qor1vjvnfsgzyhw768g45k0yxgsmzanmsxkjgw8yjl";
const SAMPLE_ADDRESS = "0xf5340e357e16da6b9ded7ad9c86148df2ec5f992";
const ATTENUA_VAULT = "0xf585fc6e1e43446f353830e0d11ff44ce747af58";
const ATTENUA_OTHERS = [
  "0xf70c001e482a1112ec76684ddec4ffe3bff4c652",
  "0xb5cf1d53872255bed60ebb731e9043b7c9ff2c8b",
  "0x5b914270db69cee65762c75edf1e1ce2856cc72b",
];
const PUBLIC_URL = "https://hallmark-jade.vercel.app";
const REST_URL = "https://api-testnet.qore.host";
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";

const pqcAbi = [
  {
    type: "function",
    name: "pqcKeyStatus",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "registered", type: "bool" },
      { name: "algorithmId", type: "uint8" },
      { name: "pubkey", type: "bytes" },
      { name: "possessionProven", type: "bool" },
    ],
  },
];

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    passed++;
    console.log(`[PASS] ${passed + failed}. ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${passed + failed}. ${name} — ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const reader = registryReader();

await check("qorechain-diana EVM RPC chainId is 9800", async () => {
  const id = await reader.client.getChainId();
  assert(id === 9800, `expected 9800, got ${id}`);
  return `chainId=${id}`;
});

await check("HallmarkRegistry has live bytecode on diana", async () => {
  const code = await reader.client.getCode({ address: REGISTRY_ADDRESS });
  assert(code && code.length > 2, "no code at registry address");
  return `${(code.length - 2) / 2} bytes at ${REGISTRY_ADDRESS}`;
});

await check("HallmarkRegistry count >= 6 and verifier matches expected server account", async () => {
  const [total, verifier] = await Promise.all([
    reader.count(),
    reader.client.readContract({ address: REGISTRY_ADDRESS, abi: hallmarkRegistryAbi, functionName: "verifier" }),
  ]);
  assert(total >= 6, `expected count >= 6, got ${total}`);
  assert(verifier.toLowerCase() === VERIFIER_EVM.toLowerCase(), `unexpected verifier ${verifier}`);
  return `count=${total}, verifier=${verifier}`;
});

await check("Registry self-record: full, pqcKeyStatus, current, claimed", async () => {
  const h = await reader.get(REGISTRY_ADDRESS);
  assert(h, "self-record missing");
  assert(h.match === "full", `match=${h.match}`);
  assert(h.pqcFlags === 2, `pqcFlags=${h.pqcFlags}`);
  assert(h.isCurrent, "not current");
  assert(h.claim?.repo === "https://github.com/agvswira/hallmark", `repo=${h.claim?.repo}`);
  assert(h.claim?.possessionProven === true, "possessionProven=false");
  return "full match · pqcKeyStatus · claimed";
});

await check("QuantumGuestbook sample record: full, pqcKeyStatus, current, QoreX claimed", async () => {
  const h = await reader.get(SAMPLE_ADDRESS);
  assert(h, "sample record missing");
  assert(h.match === "full", `match=${h.match}`);
  assert(h.pqcFlags === 2, `pqcFlags=${h.pqcFlags}`);
  assert(h.isCurrent, "not current");
  assert(h.claim?.repo === "https://github.com/agvswira/hallmark", `repo=${h.claim?.repo}`);
  assert(h.claim?.possessionProven === true, "possessionProven=false");
  return `claimant=${h.claim.claimant}`;
});

await check("Ecosystem proof: AttenuaVault full match with pqcVerify + pqcKeyStatus", async () => {
  const h = await reader.get(ATTENUA_VAULT);
  assert(h, "AttenuaVault record missing");
  assert(h.match === "full", `match=${h.match}`);
  assert(h.pqcFlags === 3, `pqcFlags=${h.pqcFlags}`);
  assert(h.isCurrent, "not current");
  assert(h.claim?.repo === "https://github.com/agvswira/attenua", `repo=${h.claim?.repo}`);
  return "full match · pqcFlags=3 · claimed";
});

await check("Ecosystem proof: all 3 supporting Attenua contracts full and current", async () => {
  const records = await Promise.all(ATTENUA_OTHERS.map((a) => reader.get(a)));
  for (const [i, h] of records.entries()) {
    assert(h, `missing record for ${ATTENUA_OTHERS[i]}`);
    assert(h.match === "full" && h.isCurrent, `bad status for ${ATTENUA_OTHERS[i]}`);
  }
  return "3/3 full & current";
});

await check("Live pqcKeyStatus precompile (0x...0a02) confirms verifier ML-DSA-87 key", async () => {
  const [registered, algo, , proven] = await reader.client.readContract({
    address: PQC_KEY_STATUS,
    abi: pqcAbi,
    functionName: "pqcKeyStatus",
    args: [VERIFIER_EVM],
  });
  assert(registered === true && Number(algo) === 1 && proven === true, `registered=${registered}, algo=${algo}, proven=${proven}`);
  return "ML-DSA-87 (algo=1), possessionProven=true";
});

await check("Verifier native account funded (> 1 QOR) & last EVM window scoped to registry", async () => {
  const [balRes, winRes] = await Promise.all([
    fetch(`${REST_URL}/cosmos/bank/v1beta1/balances/${VERIFIER_COSMOS}`),
    fetch(`${REST_URL}/qorechain/pqc/v1/evm_window/${VERIFIER_COSMOS}`),
  ]);
  assert(balRes.ok && winRes.ok, `REST status ${balRes.status}/${winRes.status}`);
  const bal = await balRes.json();
  const uqor = BigInt(bal.balances?.find((b) => b.denom === "uqor")?.amount ?? "0");
  assert(uqor > 1_000_000n, `low uqor balance: ${uqor}`);
  const win = await winRes.json();
  assert(win.found === true, "no EVM window history found");
  const targets = (win.allowed_targets ?? []).map((t) => t.toLowerCase());
  assert(targets.length === 1 && targets[0] === REGISTRY_ADDRESS.toLowerCase(), `unexpected allowed_targets: ${targets.join(",")}`);
  return `${(Number(uqor) / 1e6).toFixed(2)} QOR · scoped=[HallmarkRegistry]`;
});

await check("Production /api/contracts returns 200 with total >= 6", async () => {
  const res = await fetch(`${PUBLIC_URL}/api/contracts`);
  assert(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert(body.total >= 6 && Array.isArray(body.items), `total=${body.total}`);
  return `total=${body.total}`;
});

await check("Production /api/contract returns stored sources matching on-chain sourceHash", async () => {
  const res = await fetch(`${PUBLIC_URL}/api/contract?address=${REGISTRY_ADDRESS}`);
  assert(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert(body.onchain && body.stored, "missing onchain or stored payload");
  assert(
    body.onchain.sourceHash.toLowerCase() === body.stored.result.sourceHash.toLowerCase(),
    "sourceHash mismatch",
  );
  return `sourceHash=${body.onchain.sourceHash.slice(0, 14)}…`;
});

await check("Production /api/badge renders full match PQ-guarded SVG", async () => {
  const res = await fetch(`${PUBLIC_URL}/api/badge?address=${REGISTRY_ADDRESS}`);
  assert(res.ok, `HTTP ${res.status}`);
  const svg = await res.text();
  assert(svg.includes("<svg") && svg.includes("full match") && svg.includes("PQ-guarded"), "unexpected badge SVG");
  return "SVG 200 OK";
});

await check("Local CLI check recompiles HallmarkRegistry and prints CONFIRMED", async () => {
  const cli = resolve("packages/cli/dist/hallmark.mjs");
  assert(existsSync(cli), "packages/cli/dist/hallmark.mjs not built");
  const out = execFileSync(process.execPath, [cli, "check", REGISTRY_ADDRESS], { encoding: "utf8", timeout: 60_000 });
  assert(out.includes("CONFIRMED: this machine reproduces the on-chain record."), "did not confirm");
  return "exit 0 · 6/6 checks confirmed";
});

await check("QoreScan CycloneDX CBOM (docs/cbom.json) exists and is valid", async () => {
  assert(existsSync("docs/cbom.json"), "docs/cbom.json missing");
  const cbom = JSON.parse(readFileSync("docs/cbom.json", "utf8"));
  assert(cbom.bomFormat === "CycloneDX" && Array.isArray(cbom.components), "invalid CycloneDX format");
  return `CycloneDX ${cbom.specVersion ?? ""} · ${cbom.components.length} component(s)`;
});

await check("Submission & AI-Native documentation files exist", async () => {
  const required = [
    "README.md",
    "JUDGES.md",
    "AI_USAGE.md",
    "LICENSE",
    "docs/SUBMISSION_PACK.md",
    "docs/ai/redteam.md",
    "docs/ai/log.md",
    "docs/ai/ledger.jsonl",
  ];
  for (const f of required) assert(existsSync(f), `missing ${f}`);
  return `${required.length}/${required.length} files present`;
});

await check("AI ledger (docs/ai/ledger.jsonl) parses cleanly line-by-line", async () => {
  const lines = readFileSync("docs/ai/ledger.jsonl", "utf8").trim().split(/\r?\n/);
  assert(lines.length > 0, "empty ledger");
  for (const [i, line] of lines.entries()) {
    const obj = JSON.parse(line);
    assert(obj.id && obj.date && obj.role, `line ${i + 1} missing required fields`);
  }
  return `${lines.length} valid entries`;
});

console.log(`\nSummary: ${passed}/${passed + failed} checks passed.`);
if (failed > 0) process.exit(1);
