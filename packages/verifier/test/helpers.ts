import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createServer } from "node:net";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  encodeDeployData,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { SolidityJsonInput } from "@ethereum-sourcify/lib-sourcify";
import { SolcJsCompiler } from "../src/compiler.js";

export const SOLC = "0.8.28+commit.7893614a";
// Anvil's first default account (public test key, never used outside the local chain).
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const anvilAccount = privateKeyToAccount(ANVIL_KEY);

export const compiler = new SolcJsCompiler(join(process.cwd(), ".cache", "solc"));

export function standardInput(
  sources: Record<string, string>,
  settings: Partial<SolidityJsonInput["settings"]> = {},
): SolidityJsonInput {
  return {
    language: "Solidity",
    sources: Object.fromEntries(Object.entries(sources).map(([k, content]) => [k, { content }])),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] } },
      ...settings,
    },
  } as SolidityJsonInput;
}

export async function compile(input: SolidityJsonInput) {
  const out: any = await compiler.compile(SOLC, input);
  const errors = (out.errors ?? []).filter((e: any) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e: any) => e.formattedMessage).join("\n"));
  return out;
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

function anvilBinary(): string {
  const require = createRequire(import.meta.url);
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  const pkg = `@foundry-rs/anvil-${process.platform}-${arch}`;
  const dir = dirname(require.resolve(`${pkg}/package.json`));
  return join(dir, "bin", process.platform === "win32" ? "anvil.exe" : "anvil");
}

export interface LocalChain {
  rpcUrl: string;
  stop(): void;
  deploy(abi: Abi, bytecode: Hex, args?: unknown[]): Promise<{ address: Hex; txHash: Hex }>;
  /** Sends a call and waits for it to be mined. */
  send(to: Hex, data: Hex): Promise<void>;
  client: ReturnType<typeof createPublicClient>;
}

export async function startAnvil(chainId = 9800): Promise<LocalChain> {
  const port = await freePort();
  const proc: ChildProcess = spawn(anvilBinary(), ["--port", String(port), "--chain-id", String(chainId), "--silent"], {
    stdio: "ignore",
  });
  const rpcUrl = `http://127.0.0.1:${port}`;
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  for (let i = 0; i < 100; i++) {
    try {
      await publicClient.getChainId();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const wallet = createWalletClient({ account: anvilAccount, transport: http(rpcUrl) });

  return {
    rpcUrl,
    client: publicClient,
    stop: () => proc.kill(),
    async send(to, data) {
      const hash = await wallet.sendTransaction({ to, data, chain: null });
      await publicClient.waitForTransactionReceipt({ hash });
    },
    async deploy(abi, bytecode, args = []) {
      const data = encodeDeployData({ abi, bytecode, args });
      const txHash = await wallet.sendTransaction({ data, chain: null });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (!receipt.contractAddress) throw new Error("deploy failed");
      return { address: receipt.contractAddress, txHash };
    },
  };
}
