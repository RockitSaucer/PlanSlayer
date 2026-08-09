# PlanSlayer V1.0

Group event planning: shared + personal to-do / to-buy / to-bring lists, invites, expense settle-up, countdown, and a simple satellite map.

## Login

Uses the **same Supabase project and username scheme** as Hunt Slayer / Reg Slayer (`users.regslayer.local`). One account works on all three sites.

## Stack

- Static multi-file app (HTML/JS/CSS) + Leaflet
- Supabase Auth + `plan_*` tables (see `supabase/migrations/`)
- Vercel static deploy

## Local

Serve the folder over HTTP (not `file://`):

```bash
npx serve .
```

## Deploy

GitHub: `RockitSaucer/PlanSlayer` → Vercel project (static, no build).

Apply migration on Supabase (SQL editor or CLI) before cloud create/join:

`supabase/migrations/20260810010000_plan_slayer.sql`

Without migration, the app still works **local-first** (device storage) for solo testing.

## Hunt / Reg calendar

Events are stored so Hunt/Reg *can* show them later. **V1 does not modify Hunt or Reg.** Cross-app calendar appears only after a future Hunt/Reg patch that reads `plan_events`.

## Invite

Same idea as shared maps: **6-digit code** + link `?join=123456`.
