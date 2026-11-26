import { useRef, useState } from "react";
import { verify, type VerifyResponse } from "../lib/api.js";
import { prepareBuildInfo, prepareBuildInfoJson, type PreparedBuild } from "../lib/buildInfo.js";
import { Link, MatchTag, PqTag, Spinner, explorer, short, useUserInvalidAria } from "../lib/ui.js";

const SAMPLE_ADDRESS = "0xf5340e357e16da6b9ded7ad9c86148df2ec5f992";
const SAMPLE_TX = "0xbeed843930cc7d65b62e1abd94bb478cf117172f4c00fa042a3865c29679a970";
const SAMPLE_CONTRACT = "src/examples/QuantumGuestbook.sol:QuantumGuestbook";

export function Verify() {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);
  useUserInvalidAria(form);

  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [contract, setContract] = useState("");
  const [build, setBuild] = useState<PreparedBuild>();
  const [fileError, setFileError] = useState<string>();
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<VerifyResponse>();
  const [error, setError] = useState<string>();

  async function onFile(input: HTMLInputElement) {
    setBuild(undefined);
    setSampleLoaded(false);
    setFileError(undefined);
    input.setCustomValidity("");
    const file = input.files?.[0];
    if (!file) return;
    try {
      const prepared = await prepareBuildInfo(file);
      setBuild(prepared);
      setContract(prepared.contracts[0]?.id ?? "");
    } catch (err) {
      const message = (err as Error).message;
      setFileError(message);
      input.setCustomValidity(message);
    }
  }

  async function loadSample() {
    setSampleLoading(true);
    setFileError(undefined);
    setError(undefined);
    setResponse(undefined);
    try {
      const res = await fetch("/samples/quantum-guestbook.build-info.json");
      if (!res.ok) throw new Error(`Could not load sample build-info (${res.status})`);
      const prepared = prepareBuildInfoJson(await res.json());
      if (fileInput.current) {
        fileInput.current.value = "";
        fileInput.current.setCustomValidity("");
      }
      setBuild(prepared);
      setAddress(SAMPLE_ADDRESS);
      setTxHash(SAMPLE_TX);
      setContract(prepared.contracts.find((c) => c.id === SAMPLE_CONTRACT)?.id ?? prepared.contracts[0]?.id ?? "");
      setSampleLoaded(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSampleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!build) return;
    setBusy(true);
    setError(undefined);
    setResponse(undefined);
    try {
      setResponse(
        await verify({
          address: address.trim(),
          txHash: txHash.trim() || undefined,
          contract: contract || undefined,
          compilerVersion: build.compilerVersion,
          input: build.input,
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => result.current?.focus());
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Verify</span>
        <h1>Hallmark a contract</h1>
        <p className="lede">
          Upload the build-info file your toolchain wrote when it compiled the contract. Hallmark compiles the same input
          with the same compiler and compares it with the code deployed on <code>qorechain-diana</code>.
        </p>
      </div>

      <div className="card" style={{ marginBlockEnd: "1.25rem" }}>
        <p className="hint" style={{ marginBlockEnd: "0.75rem" }}>
          No build-info on hand? Test live recompilation against a deployed contract on diana (no wallet needed, 0 gas).
        </p>
        <div className="actions">
          <button type="button" className="button ghost" onClick={loadSample} disabled={sampleLoading || busy}>
            Load live QuantumGuestbook sample
          </button>
          {sampleLoading && <Spinner label="Loading sample build-info" />}
        </div>
      </div>

      <form ref={form} className="form card" method="post" action="/api/verify" onSubmit={onSubmit} aria-labelledby="verify-title">
        <h2 id="verify-title" className="visually-hidden">Verification details</h2>

        <div className="field">
          <label htmlFor="address">Contract address</label>
          <span id="address-hint" className="hint">The deployed contract on diana, 0x followed by 40 hex characters.</span>
          <input
            id="address"
            name="address"
            className="mono"
            required
            pattern="0x[0-9a-fA-F]{40}"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="address-hint"
            data-error="address-error"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <span id="address-error" className="error-msg">Error: enter 0x followed by 40 hexadecimal characters.</span>
        </div>

        <div className="field">
          <label htmlFor="txHash">
            Deployment transaction <span className="optional">(recommended)</span>
          </label>
          <span id="tx-hint" className="hint">
            The transaction that created the contract. Without it Hallmark can still match the code, but cannot name the
            deployer, so the result is not recorded on chain and cannot be claimed.
          </span>
          <input
            id="txHash"
            name="txHash"
            className="mono"
            pattern="0x[0-9a-fA-F]{64}"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="tx-hint"
            data-error="tx-error"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
          />
          <span id="tx-error" className="error-msg">Error: enter 0x followed by 64 hexadecimal characters.</span>
        </div>

        <div className="field">
          <label htmlFor="buildInfo">Build-info file</label>
          <span id="file-hint" className="hint">
            Foundry: <code>forge build --build-info</code>, then <code>out/build-info/*.json</code>. Hardhat:{" "}
            <code>artifacts/build-info/*.json</code>. Only the sources and settings are uploaded.
          </span>
          <input
            ref={fileInput}
            id="buildInfo"
            name="buildInfo"
            type="file"
            accept=".json,application/json"
            required={!build}
            aria-describedby="file-hint"
            data-error="file-error"
            onChange={(e) => onFile(e.currentTarget)}
          />
          <span id="file-error" className={`error-msg${fileError ? " shown" : ""}`}>
            Error: {fileError ?? "choose the build-info file of your contract."}
          </span>
          {build && (
            <span className="hint" role="status">
              {sampleLoaded ? "Sample loaded: " : "Read: "}solc {build.compilerVersion}, {Object.keys(build.input.sources).length}{" "}
              source files, {(build.sizeBytes / 1024).toFixed(0)} KB to upload.
            </span>
          )}
        </div>

        {build && build.contracts.length > 0 && (
          <div className="field">
            <label htmlFor="contract">Contract</label>
            <span id="contract-hint" className="hint">The contract in this build that was deployed at the address above.</span>
            <select
              id="contract"
              name="contract"
              required
              aria-describedby="contract-hint"
              value={contract}
              onChange={(e) => setContract(e.target.value)}
            >
              {build.contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} ({c.runtimeLength.toLocaleString()} bytes)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="actions">
          <button type="submit" className="button" disabled={busy}>
            Verify contract
          </button>
          {busy && <Spinner label="Compiling and comparing with the chain. This can take up to a minute." />}
        </div>
      </form>

      <div ref={result} tabIndex={-1} aria-live="polite">
        {error && <p className="notice bad">Error: {error}</p>}
        {response && <VerifyOutcome response={response} />}
      </div>
    </>
  );
}

function VerifyOutcome({ response }: { response: VerifyResponse }) {
  const r = response.result;
  if (r.match === "none") {
    return (
      <section className="card" aria-labelledby="outcome-title">
        <h2 id="outcome-title">No match</h2>
        <p>The compiled code does not match the code at {short(r.address, 8)}. What was tried:</p>
        <ul>
          {r.attempts.map((a) => (
            <li key={a.contract}>
              <code>{a.contract}</code>: {a.error}
            </li>
          ))}
        </ul>
        <p className="hint">
          Common causes: a different compiler version, optimizer runs or <code>evmVersion</code> than the deployment, or
          sources changed after deploying. The build-info written by the same build that deployed always has the right ones.
        </p>
      </section>
    );
  }
  return (
    <section className="card" aria-labelledby="outcome-title">
      <h2 id="outcome-title">
        <MatchTag match={r.match} /> {r.contract?.name}
      </h2>
      <p>
        <PqTag flags={r.pqc?.flags ?? 0} />
      </p>
      {response.recorded && response.unchanged ? (
        <p className="notice good">Already in HallmarkRegistry with exactly this result. Nothing new was written on chain.</p>
      ) : response.recorded ? (
        <p className="notice good">
          Recorded in HallmarkRegistry:{" "}
          <a href={explorer("tx", response.recordTx!)} className="mono">{short(response.recordTx, 10)}</a>
        </p>
      ) : (
        <p className="notice">{response.reason}</p>
      )}
      <p>
        <Link to={`/c/${r.address.toLowerCase()}`}>Open the Hallmark page for this contract</Link>
      </p>
    </section>
  );
}
