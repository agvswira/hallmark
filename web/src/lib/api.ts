// Client-side calls to the Hallmark API. Types mirror the server responses.

export interface OnchainHallmark {
  target: string;
  match: "none" | "partial" | "full";
  pqcFlags: number;
  verifiedAt: number;
  deployer: string;
  runtimeCodeHash: string;
  sourceHash: string;
  compiler: string;
  sourceUri: string;
  isCurrent: boolean;
  claim?: { claimant: string; claimedAt: number; possessionProven: boolean; repo: string };
}

export interface SourceRef {
  file: string;
  line: number;
  scope?: string;
  precompile: "pqcVerify" | "pqcKeyStatus";
  text: string;
}

export interface VerifyResult {
  address: string;
  match: "none" | "partial" | "full";
  runtimeMatch: string | null;
  creationMatch: string | null;
  contract?: { path: string; name: string };
  compilerVersion: string;
  sourceHash: string;
  onchainCodeHash: string;
  deployer?: string;
  deployTxHash?: string;
  pqc?: { usesVerify: boolean; usesKeyStatus: boolean; flags: number; sourceRefs: SourceRef[] };
  attempts: { contract: string; error: string }[];
}

export interface ProxyInfo {
  kind: "eip1967" | "eip1967-beacon" | "eip1822" | "eip1167";
  implementation?: string;
  beacon?: string;
  upgradeable: boolean;
}

export interface ContractResponse {
  address: string;
  proxy: ProxyInfo | null;
  onchain: OnchainHallmark | null;
  stored: {
    result: VerifyResult;
    input: { sources: Record<string, { content?: string }> };
    recordTx?: string;
    storedAt: string;
  } | null;
}

export interface VerifyResponse {
  result: VerifyResult;
  recorded: boolean;
  unchanged?: boolean;
  recordTx?: string;
  reason?: string;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const getContract = (address: string) =>
  call<ContractResponse>(`/api/contract?address=${encodeURIComponent(address)}`);

export const listContracts = (page = 0) =>
  call<{ total: number; page: number; limit: number; items: OnchainHallmark[] }>(`/api/contracts?page=${page}`);

export const verify = (body: unknown) =>
  call<VerifyResponse>("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
