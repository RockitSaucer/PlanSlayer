# PlanSlayer V8.0.33 — share invite link once (#144)

## What
Native share sheet was showing the join URL **twice** because `shareInviteLink` put the URL in both `text` and `url`.

## Fix
- Message text: `Join me on Plan Slayer — {label}` (no URL)
- `url` field: join deep link only (OS attaches once)
- Clipboard fallback still copies the single URL

## Shell
- `app.js` **8.0.33** · `plan-slayer-shell-v106`

## Issue
Hunt-Slayer shared inbox **#144** (`from-planslayer`)
