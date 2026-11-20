import { ConnectButton } from "@rainbow-me/rainbowkit";
import { classifyEvmWindowRejection, evmWindowStatus, type EvmWindowRejection } from "@qorechain/evm";
import { hallmarkRegistryAbi } from "@hallmark/verifier/abi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { getContract, type ContractResponse, type SourceRef } from "../lib/api.js";
import { CopyButton, MatchTag, PqTag, Spinner, explorer, short, useUserInvalidAria } from "../lib/ui.js";

const REGISTRY = "0xa901ee7138266abc456c8d717fa94b043078b8c4" as const;
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02" as const;
const pqcKeyStatusAbi = [
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
] as const;

const REMEDY: Record<EvmWindowRejection, string> = {
  "no-pqc-key": "This account has no registered ML-DSA-87 key. Register it in QoreX first.",
  "no-window": "No EVM authorisation window is open for this account. Open one in QoreX or the Dashboard, then try again.",
  exhausted: "The EVM window has run out of blocks, transactions or value. Open a new one.",
  invalid: "The chain refused the window parameters.",
};

export function Contract({ address }: { address: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["contract", address],
    queryFn: () => getContract(address),
    retry: false,
  });

  if (!/^0x[0-9a-f]{40}$/.test(address)) return <p className="notice bad">Error: that is not a contract address.</p>;
  if (isLoading) return <Spinner label="Reading the record on diana" />;
  if (error)
    return (
      <>
        <h1 className="mono">{short(address, 10)}</h1>
        <p className="notice">{error.message}</p>
      </>
    );
  return <ContractView data={data!} />;
}

function ContractView({ data }: { data: ContractResponse }) {
  const h = data.onchain;
  const r = data.stored?.result;
  const match = h?.match ?? r?.match ?? "none";
  const name = r?.contract?.name;
  const flags = h?.pqcFlags ?? r?.pqc?.flags ?? 0;
  const badgeUrl = `${window.location.origin}/api/badge?address=${data.address}`;
  const pageUrl = `${window.location.origin}/c/${data.address}`;
  const markdown = `[![Hallmark](${badgeUrl})](${pageUrl})`;

  return (
    <>
      <div className="record-head">
        <span className="eyebrow">Hallmark record</span>
        <h1>{name ?? "Contract"}</h1>
        <span className="addr">{data.address}</span>
        <p className="actions">
          <MatchTag match={match} current={h?.isCurrent ?? true} />
          <PqTag flags={flags} />
          {!h && <span className="tag partial">Not recorded on chain</span>}
        </p>
      </div>

      <div className="record-grid">
      <section className="facts-wrap" aria-labelledby="facts-title">
        <h2 id="facts-title">Verification</h2>
        <div className="card">
          <dl className="facts">
            {r?.contract && (<><dt>Source</dt><dd><code>{r.contract.path}:{r.contract.name}</code></dd></>)}
            <dt>Compiler</dt><dd><code>solc {h?.compiler ?? r?.compilerVersion}</code></dd>
            {r && (<><dt>Runtime / creation</dt><dd>{r.runtimeMatch ?? "–"} / {r.creationMatch ?? "–"}</dd></>)}
            {(h?.deployer ?? r?.deployer) && (
              <><dt>Deployer</dt><dd><a className="mono" href={explorer("address", (h?.deployer ?? r?.deployer)!)}>{h?.deployer ?? r?.deployer}</a></dd></>
            )}
            {r?.deployTxHash && (<><dt>Deployment</dt><dd><a className="mono" href={explorer("tx", r.deployTxHash)}>{short(r.deployTxHash, 12)}</a></dd></>)}
            {h && (<><dt>Verified</dt><dd>{new Date(h.verifiedAt * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd></>)}
            {data.stored?.recordTx && (<><dt>Record</dt><dd><a className="mono" href={explorer("tx", data.stored.recordTx)}>{short(data.stored.recordTx, 12)}</a></dd></>)}
            {h && (<><dt>Code hash</dt><dd><code>{h.runtimeCodeHash}</code> {h.isCurrent ? "(still deployed)" : "(the code has changed since)"}</dd></>)}
            <dt>Source hash</dt><dd><code>{h?.sourceHash ?? r?.sourceHash}</code></dd>
          </dl>
        </div>
      </section>

      <PqcReport flags={flags} refs={r?.pqc?.sourceRefs ?? []} />
      <ClaimSection data={data} />

      <section aria-labelledby="badge-title">
        <h2 id="badge-title">README badge</h2>
        <div className="badge-preview">
          <img src={badgeUrl} alt={`Hallmark badge: ${match} match`} height={20} />
        </div>
        <div className="copy-row">
          <code id="badge-markdown">{markdown}</code>
          <CopyButton target="badge-markdown" label="Copy badge Markdown" />
        </div>
      </section>

      {data.stored && <Sources sources={data.stored.input.sources} main={r?.contract?.path} />}
      </div>
    </>
  );
}

function PqcReport({ flags, refs }: { flags: number; refs: SourceRef[] }) {
  const own = refs.filter((x) => !/^(lib|node_modules)\//.test(x.file));
  return (
    <section aria-labelledby="pqc-title">
      <h2 id="pqc-title">Post-quantum report</h2>
      <div className="card">
        {flags === 0 ? (
          <p>The deployed code does not call QoreChain's post-quantum precompiles.</p>
        ) : (
          <>
            <p>Read from the deployed bytecode, which covers addresses written in the code and passed in as immutables:</p>
            <ul>
              {flags & 1 ? <li><code>pqcVerify</code> (0x…0a01): verifies an ML-DSA-87 signature on chain.</li> : null}
              {flags & 2 ? <li><code>pqcKeyStatus</code> (0x…0a02): checks that an account has a registered ML-DSA-87 key.</li> : null}
            </ul>
            {own.length > 0 && (
              <>
                <p>Where the source uses them:</p>
                <ul>
                  {own.map((x) => (
                    <li key={`${x.file}:${x.line}`}>
                      <code>{x.file}:{x.line}</code>
                      {x.scope ? <> in <code>{x.scope}</code></> : " (declaration)"}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ClaimSection({ data }: { data: ContractResponse }) {
  const h = data.onchain;
  const { address: account, isConnected } = useAccount();
  const form = useRef<HTMLFormElement>(null);
  const repoId = useId();
  useUserInvalidAria(form);
  const queryClient = useQueryClient();

  const isDeployer = !!(h && account && account.toLowerCase() === h.deployer.toLowerCase());
  const key = useReadContract({
    address: PQC_KEY_STATUS,
    abi: pqcKeyStatusAbi,
    functionName: "pqcKeyStatus",
    args: account ? [account] : undefined,
    query: { enabled: isDeployer },
  });
  const windowQ = useQuery({
    queryKey: ["evm-window", account],
    queryFn: () => evmWindowStatus({ rest: "/lcd-testnet", address: account! }),
    enabled: isDeployer,
    refetchInterval: 15_000,
  });

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  useEffect(() => {
    if (receipt.isSuccess) queryClient.invalidateQueries({ queryKey: ["contract", data.address] });
  }, [receipt.isSuccess, queryClient, data.address]);

  if (!h) return null;

  if (h.claim) {
    return (
      <section aria-labelledby="claim-title">
        <h2 id="claim-title">Repository</h2>
        <div className="card">
          <p>
            Claimed by the deployer: <a href={h.claim.repo}>{h.claim.repo}</a>
          </p>
          <p className="hint">
            The claim was accepted because the deployer has a registered ML-DSA-87 key
            {h.claim.possessionProven ? ", registered with proof of possession" : ""}, checked on chain through{" "}
            <code>pqcKeyStatus</code>.
          </p>
        </div>
      </section>
    );
  }

  const rejection = write.error ? classifyEvmWindowRejection(write.error) : undefined;
  const hasKey = key.data?.[0] === true;

  return (
    <section aria-labelledby="claim-title">
      <h2 id="claim-title">Claim this contract</h2>
      <div className="card">
        <p>
          The deployer, <code>{short(h.deployer, 8)}</code>, can link this contract to its repository. The registry only
          accepts the claim from an account with a registered ML-DSA-87 key.
        </p>
        {!isConnected && <ConnectButton label="Connect QoreX" />}
        {isConnected && !isDeployer && <p className="hint">The connected account is not the deployer of this contract.</p>}
        {isDeployer && (
          <form
            ref={form}
            className="form"
            aria-labelledby="claim-title"
            onSubmit={(e) => {
              e.preventDefault();
              const repo = String(new FormData(e.currentTarget).get("repo")).trim();
              write.writeContract({ address: REGISTRY, abi: hallmarkRegistryAbi, functionName: "claim", args: [h.target as `0x${string}`, repo] });
            }}
          >
            <ul className="hint">
              <li>ML-DSA-87 key: {key.isLoading ? "checking…" : hasKey ? "registered" : "not registered"}</li>
              <li>
                EVM window:{" "}
                {windowQ.isLoading ? "checking…" : windowQ.data?.found && windowQ.data.live ? "open" : "none open (open one in QoreX first)"}
              </li>
            </ul>
            <div className="field">
              <label htmlFor={repoId}>Repository URL</label>
              <span id={`${repoId}-hint`} className="hint">Public repository with the source, for example https://github.com/you/project</span>
              <input
                id={repoId}
                name="repo"
                type="url"
                required
                maxLength={256}
                pattern="https://.+"
                autoComplete="url"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={`${repoId}-hint`}
                data-error={`${repoId}-error`}
              />
              <span id={`${repoId}-error`} className="error-msg">Error: enter a full https:// URL.</span>
            </div>
            <div className="actions">
              <button type="submit" className="button" disabled={write.isPending || receipt.isLoading}>
                Claim with QoreX
              </button>
              {(write.isPending || receipt.isLoading) && <Spinner label={write.isPending ? "Approve in QoreX" : "Waiting for the block"} />}
            </div>
            <div role="status">
              {receipt.isSuccess && <p className="notice good">Claimed. Transaction <a className="mono" href={explorer("tx", write.data!)}>{short(write.data, 10)}</a></p>}
              {write.error && <p className="notice bad">Error: {rejection ? REMEDY[rejection] : write.error.message.split("\n")[0]}</p>}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/** The verified contract's file first, then project files, then tests and scripts, then libraries. */
const sourceRank = (path: string, main?: string) =>
  path === main ? 0 : /^(lib|node_modules)\//.test(path) ? 3 : /(^|\/)(test|script)\/|\.(t|s)\.sol$/.test(path) ? 2 : 1;

function Sources({ sources, main }: { sources: Record<string, { content?: string }>; main?: string }) {
  const files = Object.entries(sources)
    .filter(([, s]) => s.content)
    .sort(([a], [b]) => sourceRank(a, main) - sourceRank(b, main) || a.localeCompare(b));
  return (
    <section aria-labelledby="sources-title">
      <h2 id="sources-title">Verified source ({files.length} files)</h2>
      {files.map(([path, s], i) => (
        <details key={path} className="source" open={i === 0}>
          <summary>{path}</summary>
          <pre tabIndex={0}><code>{s.content}</code></pre>
        </details>
      ))}
    </section>
  );
}
