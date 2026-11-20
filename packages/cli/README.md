# hallmark CLI

Check a QoreChain contract against its HallmarkRegistry record **from your own machine**, without
trusting Hallmark's server. `check` recompiles with the official solc build and compares the result
with the code on chain and with every field of the on-chain record.

```sh
cd packages/cli
npm install
npm run build        # optional: bundles to dist/ so the CLI starts in about a second
node bin/hallmark.mjs --help
```

| Command | What it does |
|---|---|
| `hallmark status <address>` | Print the on-chain record |
| `hallmark check <address> --build-info <file> [--contract path:Name] [--tx hash]` | Recompile your own build and compare |
| `hallmark check <address> --api <url>` | Fetch the recorded sources from a Hallmark server, then recompile and compare **here** |
| `hallmark verify --address <0x…> --build-info <file> --tx <hash> --api <url>` | Submit a build to a Hallmark server (the compiler output is stripped first) |

`check` reports six checks: the code matches, the code is unchanged since the record, the match level,
the sources and settings (source hash), the post-quantum report, and the deployer (with a deployment
transaction). Add `--json` for machine-readable output.

| Exit code | Verdict |
|---|---|
| 0 | **Confirmed**: this machine reproduces the record |
| 2 | **Matches with differences**: the code matches, but not with exactly the recorded sources or settings |
| 1 | **Contradicted** (or an error): this machine does not reproduce the record |
| 3 | Not hallmarked |

Checked live against the registry on diana (21 Nov 2026), with the registry's own build-info:
unchanged → confirmed (0); a comment changed → matches with differences (2); `MAX_TEXT_LENGTH`
changed → contradicted (1); the `pqcKeyStatus` call pointed at another address → contradicted (1);
sources fetched from the server and recompiled locally → confirmed (0); a contract with no record → 3.
