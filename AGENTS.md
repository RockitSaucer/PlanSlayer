# PlanSlayer — agent notes

**Product:** group event planning (lists, invites, expenses, Hunt-style map + calendar).  
**Current version:** **V8.0.34** (`app.js` `APP_VERSION`) · shell **`plan-slayer-shell-v107`**  
**Deploy:** Vercel **plan-slayer** → https://planslayer.com

### Skills (Grok) — keep in sync when this product changes
User skills under `~/.grok/skills/` (SOURCE_OF_TRUTH = this folder):

| Skill | Trigger | Pin |
|-------|---------|-----|
| **make-lists** | Full product (lists, calendar, events, chores, Got it!, **share/join invites**, mobile, header, map viewing) | **V8.0.34** |
| **plan-calendar** | Side calendar + dots | V8.0.33 |
| **plan-events** | Trips/events + packing + Personal {Event} + **event invite links** | V8.0.33 |
| **events-chores-switch** | Events/Chores dual button under calendar | V8.0.33 |
| **hunt-reusable-kits** | Map/pins/weather/design/party (PlanMap module) | PlanMap in this folder |
| **report-site-issue** | Report an issue kit | shared inbox |

When shipping list/calendar/chores/events/**share-join**/mobile/map-viewing UX here: **update those skills** (behavior + pin version + `make-lists/references/*` especially **SHARING.md**).

**Rebuild:** `/make-lists` or read:
- `~/.grok/skills/make-lists/references/SOURCE_OF_TRUTH.md`
- `~/.grok/skills/make-lists/references/FEATURE_MAP.md`
- `~/.grok/skills/make-lists/references/SHARING.md` ← **person-to-person + site-to-site invite knowledge**

### Sharing / invites (V8.0.32 baseline — do not regress)

| What | How |
|------|-----|
| **List invite link** | `/?join=XXXXXX&type=list` → `join_plan_list` RPC → installs list; if linked event, also event membership |
| **Event invite link** | `/?join=XXXXXX&type=event` → `join_plan_event` RPC |
| **Map invite link** | Plan redirects to Hunt `/?join=`; Hunt uses `join_shared_map` |
| **Publish on share** | `publishListInviteToCloud` / `publish_plan_list` (owner snapshot; never My checklist column). **Never hand out a list link until publish succeeds** (V8.0.32) |
| **Same-account devices** | Free lists → `plan_personal_boards.state.freeLists` (+ delete tombstones) |
| **Share in place** | `markListSharedInPlace` — **same list id**, never clone a second list |
| **Pending join** | `plan_slayer_pending_join_v1` until signed in (map-style) |

SQL: `supabase/migrations/20260812010000_plan_shared_lists.sql` (also under HuntApp migrations; same Supabase project).

Full playbook: skill **`make-lists`** → `references/SHARING.md`.

### Three-site family
Map/calendar fixes shared with Hunt/Reg unless noted. **Other ways to slay** → Hunt + Reg. See `Desktop/HuntApp/reusable-kits/SYNC_POLICY.md`.

**Never push** one site without testing impact on the others when kits are shared.

### Report an issue (site → GitHub)
- UI: header **Report an issue** → modal → `POST /api/report-issue`
- API: `api/report-issue.js` (Vercel; env `GITHUB_ISSUE_TOKEN`)
- Issues: **RockitSaucer/Hunt-Slayer** (shared inbox) · labels `from-site` + `from-planslayer`
- **Skill / kit:** **`report-site-issue`** · phrase **my report issue**
- **Do not push** until Rockit asks; when shipping fixes from issues, push **PlanSlayer only**

### Header layout (V1.3.49+)
- Left: title · tagline · **version** · **Other ways to slay** (beside version)
- Right: username chip · **Report an issue** + **Join** (same row)
- User settings: Hunt color dots + Color wheel; footer **Sign out | Close/Save**

### “The left” (user term)
Equal-width columns (`--left-col-w` **525px**): planner card + detail card.

**Left stack order:**
1. **My lists** chrome (+ create, Sync Hunt) — Join is in the **site header**, not here
2. Calendar + Events/Chores switch + under-cal list
3. Personal lists + Event lists
4. Map FAB / map dock (viewing chip centered above map toolbar)

**Lists:** optional `eventId` — personal if unset; event-linked packs under **Event lists**. **Personal {Event}** from Got it!. **My checklist** on shared packs (mobile tabs include it; rebuild from claims after sync).

**Hunt kit pin (Hunt monolith):** `7.0.50-beta` — see `Desktop/HuntApp/reusable-kits/SOURCE_OF_TRUTH.md`  
**PlanMap consumer:** this folder’s `plan-map.js` (share loc 20s/5s, green GPS, map viewing chip, Hunt pins+areas only)

## Do not edit Hunt/Reg when working PlanSlayer

Leave `_push_hunt_slayer/` and `_push_reg_slayer/` alone unless the user is working Hunt/Reg.

## Kits in use

| Phrase | Status in PlanSlayer |
|--------|----------------------|
| my map | `plan-map.js` + map chrome in `index.html` + **map viewing chip** |
| my calendar | side calendar + multi-day + Quick Load |
| my pins | pin editor sheet in PlanMap |
| my weather | map weather overlay |
| my design / scrollbars | tokens + full scrollbar CSS |
| my dialogs | appAlert / appConfirm / appPrompt / toast |
| my auth | `auth.js` (shared HuntSlayer Supabase) |
| my party maps | Hunt/Reg private+shared via switcher; event-scoped pins; share locations on events |
| my offline | SW shell + tile packs in PlanMap |

## Sync policy

If Hunt changes map/calendar/pins/etc and the user is shipping Hunt, **ask** before pushing the same change into PlanSlayer (`reusable-kits/SYNC_POLICY.md`).

## Local run

Serve the folder over HTTP (`npx serve .`). Not `file://`.
