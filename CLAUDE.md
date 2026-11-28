# Working rules for AI agents on Hallmark

These rules are part of the project's AI workflow and are described in AI_USAGE.md.

## Git
- Commits are made under the owner's identity only (set in this repo's git config). Never add
  `Co-Authored-By` or any other AI attribution line to commits or PRs.
- Never push, create the GitHub repository, or change its visibility without the owner's go-ahead.
- One commit per logical change. Run the tests that cover the change before committing.
- The pre-commit hook (`.githooks/pre-commit`) runs a secret scan. Never bypass it (`--no-verify`).

## Secrets
- Keys and mnemonics live only in gitignored `.env` files. Scripts print addresses, never secrets.
- Never paste a secret into chat, logs, docs or test fixtures. Ask the owner to type it into a file.
- Testnet only (qorechain-diana). Never touch an account that has held mainnet funds.

## Documentation of AI use (every session)
- Append a dated entry to `docs/ai/log.md`: what was generated, what the owner decided, what was learned.
- Append one line per logical change to `docs/ai/ledger.jsonl` (schema in `docs/ai/README.md`).
- Record AI mistakes and how they were caught in AI_USAGE.md, with commit hashes.
- Write only what happened. Do not overclaim, do not attribute AI work to the owner or the reverse.
- Every row of the mistakes table names its fix commit and the test that guards it, or says "no test:"
  and why. A row written before its commit says `pending-commit`; fill in the hash in the next commit.
- Run `npm run ai:verify` before committing documentation of AI use; it must pass. Dates in the log and
  ledger are the owner's local time (UTC+8).

## Code
- Contracts: `cd contracts && npm test` (Foundry via the npm-packaged binary, see `scripts/forge.mjs`).
- Frontend work: consult the `modern-web-guidance` skill before writing HTML/CSS/client-side JS, and
  note in the log which guides were applied.
- Verification results must stay deterministic: no model in the verification path.
