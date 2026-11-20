import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Contract } from "./pages/Contract.js";
import { Home } from "./pages/Home.js";
import { Verify } from "./pages/Verify.js";
import { Link, usePath, useCopyCommands } from "./lib/ui.js";

export function App() {
  const path = usePath();
  useCopyCommands();

  const contract = path.match(/^\/c\/(0x[0-9a-fA-F]{40})\/?$/);
  let page: React.ReactNode;
  if (path === "/") page = <Home />;
  else if (path === "/verify") page = <Verify />;
  else if (contract) page = <Contract address={contract[1].toLowerCase()} />;
  else page = <><h1>Page not found</h1><p><Link to="/">Back to Hallmark</Link></p></>;

  const current = (to: string) => (path === to ? { "aria-current": "page" as const } : {});

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">H</span>
          Hallmark
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link to="/" {...current("/")}>Registry</Link>
          <Link to="/verify" {...current("/verify")}>Verify</Link>
        </nav>
        <ConnectButton chainStatus="none" showBalance={false} />
      </header>
      <main>{page}</main>
      <footer className="site-footer">
        HallmarkRegistry on qorechain-diana:{" "}
        <a className="mono" href="https://explore.qore.network/address/0xa901ee7138266abc456c8d717fa94b043078b8c4">0xa901…b8c4</a>
        {" · "}
        <a href="https://github.com/agvswira/hallmark">Source on GitHub</a>
        {" · "}Built for Build Before Q-Day.
      </footer>
    </>
  );
}
