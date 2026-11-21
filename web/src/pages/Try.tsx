import { ConnectButton } from "@rainbow-me/rainbowkit";
import { classifyEvmWindowRejection, evmWindowStatus, type EvmWindowRejection } from "@qorechain/evm";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Abi, Hex } from "viem";
import { useAccount, useChainId, useDeployContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { verify, type VerifyResponse } from "../lib/api.js";
import { Link, MatchTag, PqTag, Spinner, explorer, short } from "../lib/ui.js";

const SAMPLE_URL = "/samples/quantum-guestbook.build-info.json";
const SAMPLE_PATH = "src/examples/QuantumGuestbook.sol";
const SAMPLE_NAME = "QuantumGuestbook";
const DIANA = 9800;
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
  "no-window": "No EVM authorisation window is open for this account. Open one in QoreX, then try again.",
  exhausted: "The EVM window has run out of blocks, transactions or value. Open a new one in QoreX.",
  invalid: "The chain refused the window parameters.",
};

interface SampleBuild {
  solcLongVersion: string;
  input: { language: string; sources: Record<string, { content: string }>; settings: unknown };
  output: { contracts: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>> };
}

/**
 * Hallmark end to end with a sample contract: deploy it from QoreX, verify it with the shipped
 * build-info, then claim it on its record page. Every step is a real transaction on diana.
 */
export function Try() {
  const { address: account, isConnected } = useAccount();
  const chainId = useChainId();
  const sample = useQuery({
    queryKey: ["sample-build"],
    queryFn: async () => (await (await fetch(SAMPLE_URL)).json()) as SampleBuild,
    staleTime: Infinity,
  });
  const key = useReadContract({
    address: PQC_KEY_STATUS,
    abi: pqcKeyStatusAbi,
    functionName: "pqcKeyStatus",
    args: account ? [account] : undefined,
    chainId: DIANA,
    query: { enabled: !!account },
  });
  const windowQ = useQuery({
    queryKey: ["evm-window", account],
    queryFn: () => evmWindowStatus({ rest: "/lcd-testnet", address: account! }),
    enabled: !!account,
    refetchInterval: 15_000,
  });

  const deploy = useDeployContract();
  const receipt = useWaitForTransactionReceipt({ hash: deploy.data, chainId: DIANA });
  const deployed = receipt.data?.contractAddress ?? undefined;

  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResponse>();
  const [verifyError, setVerifyError] = useState<string>();

  const hasKey = key.data?.[0] === true && key.data?.[1] === 1;
  const windowOpen = !!(windowQ.data?.found && windowQ.data.live);
  const onDiana = chainId === DIANA;
  const rejection = deploy.error ? classifyEvmWindowRejection(deploy.error) : undefined;
  const contract = sample.data?.output.contracts[SAMPLE_PATH]?.[SAMPLE_NAME];

  async function runVerify() {
    if (!sample.data || !deployed || !deploy.data) return;
    setVerifying(true);
    setVerifyError(undefined);
    try {
      const { language, sources, settings } = sample.data.input;
      setResult(
        await verify({
          address: deployed,
          txHash: deploy.data,
          contract: `${SAMPLE_PATH}:${SAMPLE_NAME}`,
          compilerVersion: sample.data.solcLongVersion,
          input: { language, sources, settings },
        }),
      );
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Try it</span>
        <h1>Hallmark a contract in three steps</h1>
        <p className="lede">
          Deploy a small sample contract from QoreX, verify it, and claim it. The sample is a guestbook that only accounts
          with a registered ML-DSA-87 key can sign, so its record shows a real post-quantum report. Everything happens on{" "}
          <code>qorechain-diana</code> with your own account.
        </p>
      </div>

      <ol className="steps try">
        <li>
          <span className="n">01</span>
          <h2>Deploy the sample</h2>
          <div>
            <p>
              <code>QuantumGuestbook</code>, compiled with solc {sample.data?.solcLongVersion ?? "0.8.28"}.{" "}
              <a href={SAMPLE_URL} download="quantum-guestbook.build-info.json">Download its build-info</a> to see exactly
              what Hallmark will compile.
            </p>
            {!isConnected ? (
              <ConnectButton label="Connect QoreX" />
            ) : (
              <>
                <ul className="hint">
                  <li>Network: {onDiana ? "qorechain-diana" : "switch QoreX to qorechain-diana (chain 9800)"}</li>
                  <li>ML-DSA-87 key: {key.isLoading ? "checking…" : hasKey ? "registered" : "not registered (register it in QoreX first)"}</li>
                  <li>EVM window: {windowQ.isLoading ? "checking…" : windowOpen ? "open" : "none open (open one in QoreX first)"}</li>
                </ul>
                <div className="actions">
                  <button
                    type="button"
                    className="button"
                    disabled={!contract || !onDiana || deploy.isPending || receipt.isLoading || !!deployed}
                    onClick={() => contract && deploy.deployContract({ abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` as Hex })}
                  >
                    Deploy with QoreX
                  </button>
                  {(deploy.isPending || receipt.isLoading) && <Spinner label={deploy.isPending ? "Approve in QoreX" : "Waiting for the block"} />}
                </div>
              </>
            )}
            {deploy.error && (
              <p className="notice bad" role="alert">
                Error: {rejection ? REMEDY[rejection] : deploy.error.message.split("\n")[0]}
              </p>
            )}
            {deployed && (
              <p className="notice good">
                Deployed at <a className="mono" href={explorer("address", deployed)}>{short(deployed, 8)}</a>, transaction{" "}
                <a className="mono" href={explorer("tx", deploy.data!)}>{short(deploy.data, 10)}</a>.
              </p>
            )}
          </div>
        </li>

        <li>
          <span className="n">02</span>
          <h2>Verify it</h2>
          <div>
            <p>
              Hallmark recompiles the sample with the official solc build, matches it against the code you just deployed,
              and records the result in HallmarkRegistry. Your account is recorded as the deployer.
            </p>
            <div className="actions">
              <button type="button" className="button" disabled={!deployed || verifying || !!result} onClick={runVerify}>
                Verify
              </button>
              {verifying && <Spinner label="Compiling and matching" />}
            </div>
            {verifyError && <p className="notice bad" role="alert">Error: {verifyError}</p>}
            {result && (
              <div className="notice good">
                <p className="actions">
                  <MatchTag match={result.result.match} />
                  <PqTag flags={result.result.pqc?.flags ?? 0} />
                </p>
                <p>
                  {result.recorded
                    ? <>Recorded on chain{result.recordTx ? <> in <a className="mono" href={explorer("tx", result.recordTx)}>{short(result.recordTx, 10)}</a></> : null}.</>
                    : <>Not recorded: {result.reason}</>}
                </p>
              </div>
            )}
          </div>
        </li>

        <li>
          <span className="n">03</span>
          <h2>Claim it</h2>
          <div>
            <p>
              On the record page, link the contract to a repository. The registry checks your ML-DSA-87 key through{" "}
              <code>pqcKeyStatus</code> before it accepts, and QoreX signs the claim.
            </p>
            {result?.recorded && deployed ? (
              <Link to={`/c/${deployed.toLowerCase()}`} className="button">
                Open the record and claim <span className="arrow" aria-hidden="true">→</span>
              </Link>
            ) : (
              <p className="hint">Available once the sample is verified and recorded.</p>
            )}
          </div>
        </li>
      </ol>

      {/* One polite region for step outcomes; progress is shown by the spinners, errors by role="alert". */}
      <p className="visually-hidden" role="status">
        {result ? `Verified: ${result.result.match} match.` : deployed ? "Sample deployed. Next, verify it." : ""}
      </p>
    </>
  );
}
