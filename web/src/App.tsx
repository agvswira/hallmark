import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Contract } from "./pages/Contract.js";
import { Home } from "./pages/Home.js";
import { Verify } from "./pages/Verify.js";
import { HSeal } from "./lib/logo.js";
import { Link, usePath, useCopyCommands } from "./lib/ui.js";

export function App() {
  const path = usePath();
  useCopyCommands();

  const contract = path.match(/^\/c\/(0x[0-9a-fA-F]{40})\/?$/);
  let page: React.ReactNode;
  if (path === "/") page = <Home />;
  else if (path === "/verify") page = <Verify />;
  else if (contract) page = <Contract address={contract[1].toLowerCase()} />;
  else
    page = (
      <div className="page-head">
        <h1>Page not found</h1>
        <p><Link to="/">Back to the registry</Link></p>
      </div>
    );

  const current = (to: string) => (path === to ? { "aria-current": "page" as const } : {});

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">
          <HSeal />
          Hallmark
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link to="/" {...current("/")}>Registry</Link>
          <Link to="/verify" {...current("/verify")}>Verify</Link>
          <a href="https://github.com/agvswira/hallmark">Source</a>
        </nav>
        <div className="header-end">
          <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" />
        </div>
      </header>
      <main>{page}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <Link to="/" className="brand">
            <HSeal />
            Hallmark
          </Link>
          <div className="footer-links">
            <a className="mono" href="https://explore.qore.network/address/0xa901ee7138266abc456c8d717fa94b043078b8c4">
              HallmarkRegistry 0xa901…b8c4
            </a>
            <a href="https://github.com/agvswira/hallmark">GitHub</a>
            <a href="https://build.qorechain.io">Build Before Q-Day</a>
          </div>
          <span>Testnet only: qorechain-diana, EVM chain 9800.</span>
        </div>
      </footer>
    </>
  );
}
