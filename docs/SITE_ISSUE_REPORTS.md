# PlanSlayer — "Report an issue" + agent workflow

Same pattern as Hunt/Reg (`Desktop/HuntApp/docs/SITE_ISSUE_REPORTS.md`).

## User-facing
- Header **Report an issue** on the PlanSlayer deploy.
- Popup → submit → GitHub Issue on **RockitSaucer/Hunt-Slayer** (shared inbox with Hunt/Reg reports).
- Labels auto-applied: `from-site` + `from-planslayer`.
- **Code still ships only from** `Desktop/PlanSlayer/` → **RockitSaucer/PlanSlayer** unless Rockit says the issue affects all sites.

## Security
- Client never holds a GitHub token.
- `POST /api/report-issue` (Vercel serverless in `api/report-issue.js`) uses env **`GITHUB_ISSUE_TOKEN`**.
- Token needs `issues: write` on **RockitSaucer/Hunt-Slayer** (shared inbox).
- Optional env **`GITHUB_ISSUE_REPO`** (default `RockitSaucer/Hunt-Slayer`).

## Labels (on Hunt-Slayer)
| Label | Who | Meaning |
|-------|-----|---------|
| `from-site` | API | From in-app form |
| `from-planslayer` | API | PlanSlayer origin |
| `ready-for-review` | Agent | Plan posted; waiting on Rockit |
| `ready-to-commit` | Rockit | Agent may implement |
| `revised-changes` | Rockit | Agent revises plan only |

## Agent rules
**Idle gate:** Only auto-check if Rockit has not talked to Grok on this machine for **45+ minutes**.

1. List open `from-site` issues on **Hunt-Slayer** (includes `from-planslayer`) and PlanSlayer repo (legacy).
2. Origin label decides **code path**: `from-planslayer` → `Desktop/PlanSlayer/` only.
3. Never implement without `ready-to-commit`.
4. Kits/skills still update all consumers unless Rockit says otherwise.