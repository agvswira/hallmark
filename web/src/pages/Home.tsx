import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { listContracts } from "../lib/api.js";
import { Link, MatchTag, PqTag, Spinner, navigate, short, useUserInvalidAria } from "../lib/ui.js";

export function Home() {
  const { data, error, isLoading } = useQuery({ queryKey: ["contracts", 0], queryFn: () => listContracts(0) });
  const form = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  useUserInvalidAria(form);

  return (
    <>
      <section className="hero">
        <h1>Proof that the contract on QoreChain is the code in your repo.</h1>
        <p className="lede">
          Hallmark recompiles your Solidity build with the exact compiler and settings, compares it with the bytecode on
          the <code>qorechain-diana</code> testnet, and records the match on chain. It also reports which post-quantum
          precompiles the contract calls, so nobody has to check them by hand.
        </p>
        <div className="actions">
          <Link to="/verify" className="button">Verify a contract</Link>
          <a className="button secondary" href="#how">How it works</a>
        </div>
      </section>

      <search>
        <form
          ref={form}
          className="search-form"
          aria-labelledby="lookup-title"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/c/${query.trim().toLowerCase()}`);
          }}
        >
          <h2 id="lookup-title" className="visually-hidden">Look up a contract</h2>
          <label htmlFor="lookup" className="visually-hidden">Contract address</label>
          <input
            id="lookup"
            name="address"
            className="mono"
            placeholder="0x… contract address"
            required
            pattern="0x[0-9a-fA-F]{40}"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-error="lookup-error"
          />
          <button type="submit" className="button secondary">Look up</button>
          <span id="lookup-error" className="error-msg" style={{ flexBasis: "100%" }}>
            Error: enter 0x followed by 40 hexadecimal characters.
          </span>
        </form>
      </search>

      <h2 id="recent">Recently hallmarked</h2>
      {isLoading && <Spinner label="Reading the registry on diana" />}
      {error && <p className="notice bad">Could not read the registry: {error.message}</p>}
      {data && data.items.length === 0 && <p>No contracts yet. Be the first: verify one.</p>}
      {data && data.items.length > 0 && (
        <div tabIndex={0} role="region" aria-labelledby="recent-caption" className="table-wrapper">
          <table>
            <caption id="recent-caption">
              {data.total} contract{data.total === 1 ? "" : "s"} in HallmarkRegistry
            </caption>
            <thead>
              <tr>
                <th scope="col">Contract</th>
                <th scope="col">Match</th>
                <th scope="col">Post-quantum</th>
                <th scope="col">Repository</th>
                <th scope="col">Verified</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((h) => (
                <tr key={h.target}>
                  <th scope="row">
                    <Link to={`/c/${h.target.toLowerCase()}`} className="mono">{short(h.target, 8)}</Link>
                  </th>
                  <td><MatchTag match={h.match} current={h.isCurrent} /></td>
                  <td><PqTag flags={h.pqcFlags} /></td>
                  <td>{h.claim ? <a href={h.claim.repo}>{h.claim.repo.replace(/^https?:\/\/(www\.)?/, "")}</a> : <span className="hint">Not claimed</span>}</td>
                  <td>{new Date(h.verifiedAt * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 id="how">How it works</h2>
      <ol>
        <li><strong>Build</strong> with Foundry (<code>forge build --build-info</code>) or Hardhat, and deploy to diana.</li>
        <li><strong>Verify</strong>: upload the build-info file with the contract address and its deployment transaction. Only the sources and settings are sent; the compiler output stays in your browser.</li>
        <li><strong>Match</strong>: Hallmark compiles with the official solc build and compares the result with the code on chain. <em>Full</em>: the metadata hash matches too, so every source file and setting is identical. <em>Partial</em>: the executable code matches but the metadata differs.</li>
        <li><strong>Record</strong>: the result goes into <code>HallmarkRegistry</code>, which reads the contract's code hash itself, so a record can only describe the code that is really deployed.</li>
        <li><strong>Claim</strong>: the deployer links the contract to its repository from QoreX. The registry accepts the claim only if the account has a registered ML-DSA-87 key, checked on chain through the <code>pqcKeyStatus</code> precompile.</li>
      </ol>
    </>
  );
}
