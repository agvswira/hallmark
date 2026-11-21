import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { listContracts, type OnchainHallmark } from "../lib/api.js";
import { HSeal } from "../lib/logo.js";
import { Link, MatchTag, PqTag, RepoLink, Spinner, cleanText, navigate, short, useUserInvalidAria } from "../lib/ui.js";

export function Home() {
  const { data, error, isLoading } = useQuery({ queryKey: ["contracts", 0], queryFn: () => listContracts(0) });
  const items = data?.items ?? [];
  const latest = items[0];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow pill">
          <span className="dot" aria-hidden="true" />
          Live on qorechain-diana
        </span>
        <h1 id="hero-title">Proof that the contract on QoreChain is the code in your repo.</h1>
        <p className="lede">
          Hallmark recompiles your build with the exact compiler and settings, matches it against the bytecode on chain,
          records the result in an on-chain registry, and reports which post-quantum precompiles the contract calls.
        </p>
        <div className="actions">
          <Link to="/verify" className="button">
            Verify a contract <span className="arrow" aria-hidden="true">→</span>
          </Link>
          <a className="button ghost" href="#registry">See the registry</a>
        </div>
        <Lookup />
      </section>

      {latest && <ProofDiagram h={latest} />}

      <section className="section split reveal" aria-labelledby="numbers-title">
        <div className="section-head">
          <span className="eyebrow">The registry</span>
          <h2 id="numbers-title">Every hallmark is a record on chain, not a claim on a website.</h2>
          <p className="muted">
            HallmarkRegistry reads each contract's code hash itself, so a record can only describe the code that is
            really deployed. If the code changes, the record says so.
          </p>
          <div className="actions">
            <a className="button ghost" href="https://explore.qore.network/address/0xa901ee7138266abc456c8d717fa94b043078b8c4">
              Registry on the explorer <span className="arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <Stats items={items} total={data?.total} loading={isLoading} />
      </section>

      <section className="section reveal" id="registry" aria-labelledby="registry-title">
        <div className="section-head">
          <span className="eyebrow">Recently hallmarked</span>
          <h2 id="registry-title">Verified contracts</h2>
        </div>
        {isLoading && <Spinner label="Reading the registry on diana" />}
        {error && <p className="notice bad">Error: could not read the registry. {error.message}</p>}
        {data && items.length === 0 && <p>No contracts yet. Be the first: verify one.</p>}
        {items.length > 0 && <RegistryTable items={items} total={data!.total} />}
      </section>

      <section className="section reveal" id="how" aria-labelledby="how-title">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 id="how-title">From build to a claimed hallmark in five steps</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="n">01</span>
            <h3>Build</h3>
            <p>Compile with Foundry (<code>forge build --build-info</code>) or Hardhat and deploy to diana.</p>
          </li>
          <li>
            <span className="n">02</span>
            <h3>Upload</h3>
            <p>Send the build-info file with the address and deployment transaction. The compiler output stays in your browser.</p>
          </li>
          <li>
            <span className="n">03</span>
            <h3>Match</h3>
            <p>Hallmark compiles with the official solc build. Full: every source and setting is identical. Partial: the executable code matches, but the sources, settings and compiler version are not proven.</p>
          </li>
          <li>
            <span className="n">04</span>
            <h3>Record</h3>
            <p>The result goes into HallmarkRegistry with the post-quantum report: which of pqcVerify and pqcKeyStatus the code calls.</p>
          </li>
          <li>
            <span className="n">05</span>
            <h3>Claim</h3>
            <p>The deployer links the repository from QoreX. The registry checks the ML-DSA-87 key on chain before it accepts.</p>
          </li>
        </ol>
      </section>

      <section className="section duo reveal" aria-label="Get started">
        <div className="card">
          <div>
            <span className="eyebrow">For reviewers and jurors</span>
            <h2>Check any contract in seconds.</h2>
            <p className="muted">
              Paste an address to see whether its code matches a repository, and whether it really calls the post-quantum
              precompiles it claims to.
            </p>
          </div>
          <div className="actions">
            <a className="button ghost" href="#lookup">Look up an address <span className="arrow" aria-hidden="true">↑</span></a>
          </div>
        </div>
        <div className="card gold">
          <div>
            <span className="eyebrow" style={{ color: "inherit" }}>For builders</span>
            <h2>Put a hallmark on your contract.</h2>
            <p>Verify it, claim it with QoreX, and add the badge to your README so anyone can check it.</p>
          </div>
          <div className="actions">
            <Link to="/verify" className="button dark">
              Verify a contract <span className="arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Lookup() {
  const form = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  useUserInvalidAria(form);
  return (
    <search className="lookup-wrap">
      <form
        ref={form}
        className="lookup"
        aria-label="Look up a contract"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/c/${query.trim().toLowerCase()}`);
        }}
      >
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
        <button type="submit" className="button">Look up</button>
      </form>
      <span id="lookup-error" className="error-msg">
        Error: enter 0x followed by 40 hexadecimal characters.
      </span>
    </search>
  );
}

/** The newest record, drawn as the logo's idea: repository and chain, joined by the seal. */
function ProofDiagram({ h }: { h: OnchainHallmark }) {
  return (
    <section className="hero-proof reveal" aria-label="Latest hallmark" style={{ display: "grid", justifyItems: "center", marginBlockStart: "1rem" }}>
      <div className="proof">
        <div className="card">
          <div className="label">Repository source</div>
          <div className="value">{h.claim ? cleanText(h.claim.repo).replace(/^https?:\/\//, "") : "source hash"}</div>
          <div className="value muted" title={h.sourceHash}>{short(h.sourceHash, 10)}</div>
        </div>
        <span className="link" aria-hidden="true" />
        <div className="seal">
          <HSeal title="Matched" />
          <MatchTag match={h.match} current={h.isCurrent} />
        </div>
        <span className="link" aria-hidden="true" />
        <div className="card">
          <div className="label">On qorechain-diana</div>
          <div className="value">
            <Link to={`/c/${h.target.toLowerCase()}`}>{short(h.target, 8)}</Link>
          </div>
          <div className="value muted" title={h.runtimeCodeHash}>code {short(h.runtimeCodeHash, 10)}</div>
        </div>
      </div>
    </section>
  );
}

function Stats({ items, total, loading }: { items: OnchainHallmark[]; total?: number; loading: boolean }) {
  const show = (n: number) => (loading ? "–" : n.toLocaleString());
  // The counts below cover the first page of the registry (up to 20 records).
  const full = items.filter((h) => h.match === "full").length;
  const pq = items.filter((h) => h.pqcFlags).length;
  const claimed = items.filter((h) => h.claim).length;
  const of = total && total > items.length ? ` (latest ${items.length})` : "";
  return (
    <ul className="stats">
      <li><span className="num">{show(total ?? 0)}</span><span className="what">contracts hallmarked</span></li>
      <li><span className="num mint">{show(full)}</span><span className="what">full matches{of}</span></li>
      <li><span className="num cobalt">{show(pq)}</span><span className="what">call a post-quantum precompile{of}</span></li>
      <li><span className="num">{show(claimed)}</span><span className="what">claimed with an ML-DSA-87 key{of}</span></li>
    </ul>
  );
}

function RegistryTable({ items, total }: { items: OnchainHallmark[]; total: number }) {
  return (
    <div tabIndex={0} role="region" aria-labelledby="recent-caption" className="table-wrapper">
      <table>
        <caption id="recent-caption">
          {total} contract{total === 1 ? "" : "s"} in HallmarkRegistry, newest first
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
          {items.map((h) => (
            <tr key={h.target}>
              <th scope="row">
                <Link to={`/c/${h.target.toLowerCase()}`} className="mono">{short(h.target, 8)}</Link>
              </th>
              <td><MatchTag match={h.match} current={h.isCurrent} /></td>
              <td><PqTag flags={h.pqcFlags} /></td>
              <td>
                {h.claim ? <RepoLink repo={h.claim.repo} bare /> : <span className="hint">Not claimed</span>}
              </td>
              <td>{new Date(h.verifiedAt * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
