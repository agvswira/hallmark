# Hallmark web app

Vite + React + wagmi (QoreX through `@qorechain/qorex-rainbowkit`), scaffolded from the
`create-qorechain-dapp` viem-wagmi template. The API lives in `api/` as Vercel Functions; in
development the Vite server runs them (see `apiRoutes()` in `vite.config.ts`).

| Route | What |
|---|---|
| `/` | Registry: recently hallmarked contracts, lookup by address |
| `/verify` | Upload a build-info file; the browser strips the compiler output and sends sources and settings |
| `/c/<address>` | The record: match, PQC report with source lines, claim with QoreX, README badge, verified source |
| `POST /api/verify` | Verify, store the sources, and record on chain when the deployer is known |
| `GET /api/contract`, `/api/contracts`, `/api/badge` | Read the record, list the registry, SVG badge |

```sh
npm install
cp .env.example .env   # HALLMARK_VERIFIER_KEY, HALLMARK_PUBLIC_URL (leave empty locally)
npm run dev
```

Locally, leave `HALLMARK_PUBLIC_URL` empty: results are verified and stored in `.data/`, but nothing
is written to the registry, so no `localhost` address ends up in an on-chain record.
