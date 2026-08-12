# PlanSlayer V8.0.31 — list/event invite links (map-style auto-access)

## What
**Invite members / Share** at the top of a list now generates a deep link that works like Hunt map links:

- Open `/?join=123456&type=list` → signed-in user is **automatically granted access** to that list.
- If the list is linked to an event, they also get **event membership** (list + event).
- Event invite links (`type=event`) still join the event; linked packing lists are published so content can follow.
- Not signed in? Code is saved; after login, join runs automatically.

## Cloud
Migration `20260812010000_plan_shared_lists.sql` (applied to HuntSlayer Supabase):

- `plan_shared_lists` + `plan_shared_list_members`
- `publish_plan_list` — host publishes invite + list snapshot
- `join_plan_list` — joiner membership + optional `plan_event_members`
- `list_my_plan_shared_lists` — pull shared lists I own/joined

## Client
- Publish on share / invite / shared list save (owner only)
- `joinListByCode` + `consumeJoinQuery` + pending join through auth
- Manual **Join** header also tries list then event

## Shell
- `app.js` **8.0.31** · `plan-slayer-shell-v104`

## Cleanup / knowledge (post-ship)
- Removed dead **per-section** invite-code generation from `openListInviteModal` (join is always whole-list).
- DRY `markListSharedInPlace` → `markListSharedInPlaceNoPublish` + schedule publish.
- Invite modal: “Copy link” (deep link), not bare code only.
- Skills pin **V8.0.31**; new playbook `~/.grok/skills/make-lists/references/SHARING.md` (person-to-person + site-to-site + same-account).
- `AGENTS.md` baseline for next session.
