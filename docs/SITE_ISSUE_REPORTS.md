# PlanSlayer — “Report an issue” + agent workflow

Same pattern as Hunt/Reg (`Desktop/HuntApp/docs/SITE_ISSUE_REPORTS.md`), but issues land on **this** product’s repo.

## User-facing
- Header **Report an issue** on the PlanSlayer deploy.
- Popup → submit → GitHub Issue on **RockitSaucer/PlanSlayer**.
- Labels auto-applied: `from-site` + `from-planslayer`.

## Security
- Client never holds a GitHub token.
- `POST /api/report-issue` (Vercel serverless in `api/report-issue.js`) uses env **`GITHUB_ISSUE_TOKEN`**.
- Token needs `issues: write` on **RockitSaucer/PlanSlayer** (fine-grained PAT recommended).
- Optional env **`GITHUB_ISSUE_REPO`** (default `RockitSaucer/PlanSlayer`).

## One-time GitHub setup (before first live report)
On **RockitSaucer/PlanSlayer** create labels (colors optional):

| Label | Who | Meaning |
|-------|-----|---------|
| `from-site` | API | From in-app form |
| `from-planslayer` | API | PlanSlayer origin |
| `ready-for-review` | Agent | Plan posted; waiting on Rockit |
| `ready-to-commit` | Rockit | Agent may implement |
| `revised-changes` | Rockit | Agent revises plan only |

If labels are missing, the API still files the issue (without labels) so reports are not lost.

## Vercel setup (when you push this build)
1. Deploy this folder to the PlanSlayer Vercel project (GitHub `RockitSaucer/PlanSlayer`).
2. Project → Settings → Environment Variables → add **`GITHUB_ISSUE_TOKEN`** (Production + Preview if you want previews to work).
3. Redeploy so the serverless function picks up the env.

Local `npx serve` has **no** `/api` — report button will explain that. Use Vercel (or `vercel dev`) to test filing.

## Agent rules (same as Hunt idle gate)
**Idle gate:** Only auto-check if Rockit has not talked to Grok on this machine for **45+ minutes**. Active chat → skip.

1. Pass idle gate + time window (5am–9pm CT during trial) if using the hourly agent.
2. List open issues on **RockitSaucer/PlanSlayer** with `from-site` (or `from-planslayer`).
3. **Never implement** unless labeled `ready-to-commit`.
4. New / needs plan → plan comment → `ready-for-review`.
5. `revised-changes` → revise plan, re-`ready-for-review`.
6. `ready-to-commit` → implement in **`Desktop/PlanSlayer/`**, commit/push **PlanSlayer only** (not Hunt/Reg), comment, clear `ready-to-commit`.

## Rockit at work (no Grok file access)
1. Open [PlanSlayer issues](https://github.com/RockitSaucer/PlanSlayer/issues) (or create one manually).
2. Review agent plan when present.
3. Add **`ready-to-commit`** to approve implementation, or **`revised-changes`** to request a new plan.
4. Home PC + agent (when idle rules allow) ships the fix.

You can also use the in-app **Report an issue** button on the live site after deploy.
