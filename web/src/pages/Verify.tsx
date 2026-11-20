import { useRef, useState } from "react";
import { verify, type VerifyResponse } from "../lib/api.js";
import { prepareBuildInfo, type PreparedBuild } from "../lib/buildInfo.js";
import { Link, MatchTag, PqTag, Spinner, explorer, short, useUserInvalidAria } from "../lib/ui.js";

export function Verify() {
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLDivElement>(null);
  useUserInvalidAria(form);

  const [build, setBuild] = useState<PreparedBuild>();
  const [fileError, setFileError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<VerifyResponse>();
  const [error, setError] = useState<string>();

  async function onFile(input: HTMLInputElement) {
    setBuild(undefined);
    setFileError(undefined);
    input.setCustomValidity("");
    const file = input.files?.[0];
    if (!file) return;
    try {
      setBuild(await prepareBuildInfo(file));
    } catch (err) {
      const message = (err as Error).message;
      setFileError(message);
      input.setCustomValidity(message);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!build) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    setResponse(undefined);
    try {
      setResponse(
        await verify({
          address: String(data.get("address")).trim(),
          txHash: String(data.get("txHash") ?? "").trim() || undefined,
          contract: String(data.get("contract") ?? "") || undefined,
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
      <h1>Verify a contract</h1>
      <p className="lede">
        Upload the build-info file your toolchain wrote when it compiled the contract. Hallmark compiles the same input
        with the same compiler and compares it with the code deployed on <code>qorechain-diana</code>.
      </p>

      <form ref={form} className="form panel" method="post" action="/api/verify" onSubmit={onSubmit} aria-labelledby="verify-title">
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
            id="buildInfo"
            name="buildInfo"
            type="file"
            accept=".json,application/json"
            required
            aria-describedby="file-hint"
            data-error="file-error"
            onChange={(e) => onFile(e.currentTarget)}
          />
          <span id="file-error" className={`error-msg${fileError ? " shown" : ""}`}>
            Error: {fileError ?? "choose the build-info file of your contract."}
          </span>
          {build && (
            <span className="hint" role="status">
              Read: solc {build.compilerVersion}, {Object.keys(build.input.sources).length} source files,{" "}
              {(build.sizeBytes / 1024).toFixed(0)} KB to upload.
            </span>
          )}
        </div>

        {build && build.contracts.length > 0 && (
          <div className="field">
            <label htmlFor="contract">Contract</label>
            <span id="contract-hint" className="hint">The contract in this build that was deployed at the address above.</span>
            <select id="contract" name="contract" required aria-describedby="contract-hint">
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
      <section className="panel" aria-labelledby="outcome-title">
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
    <section className="panel" aria-labelledby="outcome-title">
      <h2 id="outcome-title">
        <MatchTag match={r.match} /> {r.contract?.name}
      </h2>
      <p>
        <PqTag flags={r.pqc?.flags ?? 0} />
      </p>
      {response.recorded ? (
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
