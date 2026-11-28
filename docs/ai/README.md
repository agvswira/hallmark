# docs/ai

Evidence behind [AI_USAGE.md](../../AI_USAGE.md).

| File | What it holds |
|---|---|
| `log.md` | Dated session log: what the agent generated, what the owner decided, what was learned |
| `ledger.jsonl` | One JSON line per logical change, for checking against `git log` |
| `reviews/` | AI security and code review reports, one per milestone (from the review milestone on) |
| `redteam.md` | Results of the AI attacker run against the verifier (from the verifier milestone on) |

## Ledger schema

One JSON object per line:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `L-0001`, `L-0002`, … in order |
| `date` | string | The owner's local date (UTC+8), `YYYY-MM-DD`: the day the work was done, which can be the day before its commit when the commit lands just after midnight |
| `commit` | string or null | Short hash of the commit that carries the change; `null` for the entry written in that same commit, filled in by the next entry's commit |
| `role` | string | `research`, `builder`, `reviewer` or `attacker` |
| `files` | string[] | Paths changed |
| `ai` | string | What the agent generated or did |
| `owner` | string | What the owner decided or did for this change. `""` means no separate decision: the owner reviewed the change when deciding to push |
| `checked` | string | The command or check that verified the change, and its result |

## Checking this record

`npm run ai:verify` (from the repository root, with full git history) checks every ledger entry
against `git log`, shows when each entry was written (`git blame`), checks every commit and test named in
AI_USAGE.md's mistakes table, the owner decisions, the git rules in CLAUDE.md, the claimed test and attack
counts, and the links in these documents. It exits non-zero on any failure and runs in CI on every push.
