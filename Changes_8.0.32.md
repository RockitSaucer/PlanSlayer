# PlanSlayer V8.0.32 — list invite publish must succeed before share (#143)

## What
Invite links that were only stored **locally** (never published to `plan_shared_lists`) made guests see **List not found**. Host UI no longer presents a copyable working link until `publish_plan_list` succeeds.

## Client
- `openListInviteModal`: pending → ready / failed UI; block Copy until ready
- `copyShareCodeForCtx`: for **list** shares, refuse to copy/share if publish returns null
- Event share with packing list: still share event if list publish fails, with a warning toast
- `joinListByCode`: friendlier error when cloud says list not found
- `btn-copy-code`: wait for linked-list publish attempt before share

## Shell
- `app.js` **8.0.32** · `plan-slayer-shell-v105`

## Issue
Hunt-Slayer shared inbox **#143** (`from-planslayer`)
