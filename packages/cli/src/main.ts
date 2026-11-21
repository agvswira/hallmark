/**
 * hallmark: check a QoreChain contract against its HallmarkRegistry record from your own
 * machine, without trusting Hallmark's server.
 *
 *   hallmark status <address>
 *   hallmark check  <address> [--build-info <file>] [--contract <path:Name>] [--tx <hash>] [--api <url>]
 *   hallmark verify --address <0x…> --build-info <file> [--tx <hash>] [--contract <path:Name>] [--api <url>]
 *
 * `check` recompiles locally with the official solc build and compares the result with the
 * chain and with the record. Sources come from --build-info, or else from a Hallmark server
 * (--api): the server only supplies the input, the verdict is computed here.
 *
 * Exit codes: 0 confirmed, 1 contradicted or error, 2 matched with differences, 3 not hallmarked.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  SolcJsCompiler,
  compareWithRecord,
  detectProxy,
  parseBuildInfo,
  registryReader,
  setLibSourcifyLoggerLevel,
  verifyContract,
  type BuildInput,
  type OnchainHallmark,
} from "@hallmark/verifier";

const HELP = `hallmark: source verification for QoreChain contracts (qorechain-diana)

Usage:
  hallmark status <address>
  hallmark check  <address> [--build-info <file>] [--contract <path:Name>] [--tx <hash>] [--api <url>]
  hallmark verify --address <0x…> --build-info <file> [--tx <hash>] [--contract <path:Name>] [--api <url>]

Options:
  --build-info <file>   Foundry (out/build-info/*.json) or Hardhat (artifacts/build-info/*.json)
  --contract <path:Name>  Which contract in the build (default: the one stored with the record)
  --tx <hash>           Deployment transaction, to check the deployer too
  --api <url>           A Hallmark server for recorded sources (default: $HALLMARK_API or
                        https://hallmark-jade.vercel.app); the verdict is computed here
  --rpc <url>           EVM RPC for qorechain-diana (default: https://evm-testnet.qore.host)
  --json                Print the result as JSON

Exit codes: 0 confirmed, 1 contradicted or error, 2 matched with differences, 3 not hallmarked.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "build-info": { type: "string" },
    contract: { type: "string" },
    tx: { type: "string" },
    api: { type: "string", default: process.env.HALLMARK_API ?? "https://hallmark-jade.vercel.app" },
    rpc: { type: "string" },
    address: { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, arg] = positionals;
// Errors only: the verifier library logs every step at info level.
setLibSourcifyLoggerLevel(0);
const out = (line = "") => process.stdout.write(`${line}\n`);
const mark = (ok: boolean) => (ok ? "✓" : "✗");
/**
 * Strings from the chain or a server (a claimed repository, a compiler string, an error message)
 * are printed only after removing control characters, ANSI escapes and bidirectional overrides,
 * which could rewrite the terminal output or disguise one URL as another.
 */
const clean = (s: unknown) => String(s ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
/** JSON output: JSON.stringify escapes control characters but not bidi overrides, so escape those too. */
const json = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2).replace(
    /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

function requireAddress(value: string | undefined): string {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("Give a contract address: 0x followed by 40 hex characters.");
  return value;
}

function printRecord(h: OnchainHallmark) {
  out(`HallmarkRegistry record for ${h.target}`);
  out(`  match          ${h.match}${h.isCurrent ? "" : " (the code has changed since)"}`);
  out(`  post-quantum   ${[h.pqcFlags & 1 ? "pqcVerify" : "", h.pqcFlags & 2 ? "pqcKeyStatus" : ""].filter(Boolean).join(" + ") || "none"}`);
  out(`  compiler       solc ${clean(h.compiler)}`);
  out(`  deployer       ${h.deployer}`);
  out(`  verified       ${new Date(h.verifiedAt * 1000).toISOString()}`);
  out(`  source hash    ${h.sourceHash}`);
  out(`  code hash      ${h.runtimeCodeHash}`);
  out(`  claimed        ${h.claim ? `${clean(h.claim.repo)} (ML-DSA-87 key${h.claim.possessionProven ? ", proof of possession" : ""})` : "no"}`);
}

/** Warns when the address is a proxy: its hallmark covers the proxy, not the code it delegates to. */
async function printProxy(address: string) {
  const p = await detectProxy(registryReader(values.rpc).client, address as `0x${string}`).catch(() => undefined);
  if (!p) return;
  if (p.upgradeable) {
    out(`  proxy          ${p.kind}, upgradeable: runs ${p.implementation ?? "(beacon did not report an implementation)"}${p.beacon ? ` via beacon ${p.beacon}` : ""}`);
    out(`                 The record covers the proxy only. Check the implementation too.`);
  } else {
    out(`  proxy          EIP-1167 clone of ${p.implementation}. Check that contract too.`);
  }
}

async function loadRecord(address: string): Promise<OnchainHallmark | undefined> {
  return registryReader(values.rpc).get(address);
}

/** The build to recompile: a local build-info file, or the input stored on a Hallmark server. */
async function loadBuild(address: string): Promise<{ build: BuildInput; contract?: string; tx?: string; from: string }> {
  if (values["build-info"]) {
    const build = parseBuildInfo(JSON.parse(readFileSync(values["build-info"], "utf8")));
    return { build, contract: values.contract, tx: values.tx, from: values["build-info"] };
  }
  if (!values.api) throw new Error("Give --build-info <file>, or --api <url> of a Hallmark server to fetch the recorded sources.");
  const url = `${values.api.replace(/\/$/, "")}/api/contract?address=${address.toLowerCase()}`;
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !body.stored) throw new Error(`${url}: no stored sources (${clean(body.error ?? res.status)})`);
  const r = body.stored.result;
  const build = parseBuildInfo({ solcLongVersion: r.compilerVersion, input: body.stored.input });
  const contract = values.contract ?? (r.contract ? `${r.contract.path}:${r.contract.name}` : undefined);
  return { build, contract, tx: values.tx ?? r.deployTxHash, from: url };
}

async function check(address: string): Promise<number> {
  const record = await loadRecord(address);
  if (!record) {
    out(`${address} has no hallmark in the registry.`);
    return 3;
  }
  const { build, contract, tx, from } = await loadBuild(address);
  if (!values.json) {
    printRecord(record);
    await printProxy(address);
    out();
    out(`Recompiling here with solc ${build.compilerVersion} (sources from ${from})…`);
  }
  const local = await verifyContract({
    address,
    build,
    contract,
    creationTxHash: tx,
    rpcUrl: values.rpc,
    compiler: new SolcJsCompiler(join(homedir(), ".cache", "hallmark", "solc")),
  });
  const { verdict, checks } = compareWithRecord(local, record);

  if (values.json) {
    out(json({ verdict, checks, record, local }));
  } else {
    out();
    for (const c of checks) out(`  ${mark(c.ok)} ${c.name}: ${clean(c.detail)}`);
    out();
    out(
      {
        confirmed: "CONFIRMED: this machine reproduces the on-chain record.",
        differs: "MATCHES WITH DIFFERENCES: the code matches, but not with exactly the recorded sources or settings.",
        contradicted: "CONTRADICTED: this machine does not reproduce the on-chain record.",
      }[verdict],
    );
  }
  return { confirmed: 0, differs: 2, contradicted: 1 }[verdict];
}

async function status(address: string): Promise<number> {
  const record = await loadRecord(address);
  if (!record) {
    out(`${address} has no hallmark in the registry.`);
    return 3;
  }
  if (values.json) out(json(record));
  else {
    printRecord(record);
    await printProxy(address);
  }
  return 0;
}

/** Sends a build to a Hallmark server, stripping the compiler output first (as the web app does). */
async function submit(): Promise<number> {
  const address = requireAddress(values.address);
  if (!values["build-info"]) throw new Error("--build-info <file> is required.");
  if (!values.api) throw new Error("--api <url> of a Hallmark server is required.");
  const build = parseBuildInfo(JSON.parse(readFileSync(values["build-info"], "utf8")));
  const res = await fetch(`${values.api.replace(/\/$/, "")}/api/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, txHash: values.tx, contract: values.contract, compilerVersion: build.compilerVersion, input: build.input }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(clean(body.error ?? `HTTP ${res.status}`));
  if (values.json) {
    out(json(body));
  } else {
    out(`${clean(body.result.match)} match${body.result.contract ? ` for ${clean(body.result.contract.path)}:${clean(body.result.contract.name)}` : ""}`);
    out(
      body.recorded && body.unchanged
        ? `already recorded with exactly this result; nothing new written${body.recordTx ? ` (${clean(body.recordTx)})` : ""}`
        : body.recorded
          ? `recorded on chain: ${clean(body.recordTx)}`
          : `not recorded: ${clean(body.reason)}`,
    );
  }
  return body.result.match === "none" ? 1 : 0;
}

async function main(): Promise<number> {
  if (values.help || !command) {
    out(HELP);
    return command ? 0 : 1;
  }
  if (command === "status") return status(requireAddress(arg));
  if (command === "check") return check(requireAddress(arg));
  if (command === "verify") return submit();
  throw new Error(`Unknown command "${command}". Run hallmark --help.`);
}

// Calling process.exit() in the same tick as the last request aborts with a libuv assertion
// on Windows (a socket is still closing), and waiting for idle keep-alive sockets takes ~10 s.
// So: set the exit code, then exit on a short timer once the last request has settled.
function finish(code: number) {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 100).unref();
}

main().then(finish, (err) => {
  process.stderr.write(`hallmark: ${err instanceof Error ? err.message : err}\n`);
  finish(1);
});
