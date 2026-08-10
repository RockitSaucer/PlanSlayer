# PlanSlayer V1.2

Group event planning: My lists, invites, expense settle-up, countdown, and **Hunt Slayer kit** map + calendar (no deer zones).

**Hunt kit source pin:** `7.0.50-beta` (`Desktop/HuntApp/reusable-kits/`).

## What’s in V1.2

- Full dark design + **no gray scrollbars** (hard rules)
- In-app dialogs only (including sign-out + Quick Load)
- Multi-day calendar dots, Quick Load modal, map pin filter banner
- PlanMap: measure/draw, GPS, share location, radar, layers (incl. **LiDAR**), pin editor, weather card, offline packs
- Map context bar: Auto · Personal · per-event shared pins (party-style)
- Same Supabase auth/usernames as Hunt/Reg

## Login

Same Supabase project and username scheme as Hunt Slayer / Reg Slayer. One account works across sites.

## Stack

- Static multi-file app (HTML/JS/CSS) + Leaflet
- Supabase Auth + `plan_*` tables (`supabase/migrations/`)
- Vercel static deploy

## Local

```bash
npx serve .
```

## Deploy

GitHub: `RockitSaucer/PlanSlayer` → Vercel (static + `api/report-issue.js`). Apply SQL migration before cloud create/join.

### Report an issue
- In-app header button posts to `/api/report-issue` (token **only** on Vercel as `GITHUB_ISSUE_TOKEN`).
- Creates GitHub issues on this repo with `from-site` + `from-planslayer`.
- Labels for agent workflow: `ready-for-review`, `ready-to-commit`, `revised-changes`.
- Full notes: `docs/SITE_ISSUE_REPORTS.md`.

## Kit consumers

Registered in `Desktop/HuntApp/reusable-kits/CONSUMERS.md`. Changing Hunt map/calendar requires **user OK** before fan-out here.
