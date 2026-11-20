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
| `date` | string | UTC date, `YYYY-MM-DD` |
| `commit` | string or null | Short hash of the commit that carries the change; `null` for the entry written in that same commit, filled in by the next entry's commit |
| `role` | string | `research`, `builder`, `reviewer` or `attacker` |
| `files` | string[] | Paths changed |
| `ai` | string | What the agent generated or did |
| `owner` | string | What the owner decided or did for this change (`""` if nothing) |
| `checked` | string | The command or check that verified the change, and its result |
