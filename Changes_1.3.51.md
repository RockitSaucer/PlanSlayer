# PlanSlayer V1.3.51

## My location
- Always opens/snaps the map to you (setView + invalidateSize after chrome open).
- Self directional icon stays painted after redraws while sharing **or** after a My location snap.
- Continuous local GPS watch keeps the icon from disappearing.

## Map viewing switcher (Hunt parity)
- Chip centered **above the bottom toolbar**: shows which map you’re viewing.
- Tap → pick **Plan personal**, **event maps**, or **Hunt/Reg private & shared** maps (same account).
- Loads `map_state` **pins + custom areas only** — no deer/WMA/rut layers.
- Pin edits while on a Hunt/Reg map write pins back into that map’s cloud state (areas preserved).

## Shell
- `plan-slayer-shell-v84`
