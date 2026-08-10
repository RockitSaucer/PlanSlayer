# PlanSlayer — agent notes

**Product:** group event planning (lists, invites, expenses, Hunt-style map + calendar).  
**Current version:** **V1.3.11** (`app.js` `APP_VERSION`)

### Three-site family
Map/calendar fixes shared with Hunt/Reg unless noted. **Other ways to slay** → Hunt + Reg. See `Desktop/HuntApp/reusable-kits/SYNC_POLICY.md`.

### Report an issue (site → GitHub)
- UI: header **Report an issue** → modal → `POST /api/report-issue`
- API: `api/report-issue.js` (Vercel; env `GITHUB_ISSUE_TOKEN`)
- Issues: **RockitSaucer/Hunt-Slayer** (shared inbox) · labels `from-site` + `from-planslayer` · code still PlanSlayer only
- Workflow: `docs/SITE_ISSUE_REPORTS.md` (plan → `ready-for-review` → Rockit `ready-to-commit` / `revised-changes`)
- **Skill / kit:** Grok skill **`report-site-issue`** · playbook `Desktop/HuntApp/reusable-kits/report-issue/MY_REPORT_ISSUE.md` · phrase **my report issue**
- **Do not push** until Rockit asks; when shipping fixes from issues, push **PlanSlayer only**

### “The left” (user term)
Equal-width columns (`--left-col-w` **525px**): planner card + detail card.

**Left stack order:**
1. Tabs **My lists** | **My events** (above calendar)
2. Calendar
3. Tab content (personal lists only vs events + event-linked lists)
4. Map button / map

**Lists:** optional `eventId` — personal if unset; event-linked packs also appear under **My lists → Event lists**. Opening a list from either tab paints the triad on the right. **Share list** generates/reuses `invite_code`.
**Hunt kit pin:** `7.0.50-beta` — see `Desktop/HuntApp/reusable-kits/SOURCE_OF_TRUTH.md`

## Do not edit Hunt/Reg when working PlanSlayer

Leave `_push_hunt_slayer/` and `_push_reg_slayer/` alone unless the user is working Hunt/Reg.

## Kits in use

| Phrase | Status in PlanSlayer |
|--------|----------------------|
| my map | `plan-map.js` + map chrome in `index.html` |
| my calendar | side calendar + multi-day + Quick Load |
| my pins | pin editor sheet in PlanMap |
| my weather | map weather overlay |
| my design / scrollbars | tokens + full scrollbar CSS |
| my dialogs | appAlert / appConfirm / appPrompt / toast |
| my auth | `auth.js` (shared HuntSlayer Supabase) |
| my party maps | event-scoped pin stores + map context switcher |
| my offline | SW shell v3 + tile packs in PlanMap |

## Sync policy

If Hunt changes map/calendar/pins/etc and the user is shipping Hunt, **ask** before pushing the same change into PlanSlayer (`reusable-kits/SYNC_POLICY.md`).

## Local run

Serve the folder over HTTP (`npx serve .`). Not `file://`.
