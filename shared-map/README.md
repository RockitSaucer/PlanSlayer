# PlanMap — reusable Hunt-style map (PlanSlayer V1.2+)

**Source pin:** Hunt Slayer **7.0.50-beta** (`Desktop/HuntApp/reusable-kits/SOURCE_OF_TRUTH.md`).

Copy into a future app:

- `../plan-map.js` — map engine (Leaflet)
- `../icons/tools/` · `../icons/pins/`
- CSS / HTML chrome in `../index.html` (map bar, pin editor, weather, map-dot)

Or start from **`Desktop/KitHostBlank/`** (map + calendar scaffold).

## Host hooks

```js
PlanMap.configure({
  toast, alert, confirm,
  getPins, savePins,
  getEventLocation, listEventsForLocation, setEventLocationById, openCreateEvent,
  getMyId, getMyName, getMyColor,
  onShareLocation, getShareLocations
});
PlanMap.ensure();
PlanMap.redraw();
```

## Included (Hunt parity, no deer zones)

- Topo / Roads / Satellite / **LiDAR** + labels  
- Solid flush bottom toolbar: measure, draw, GPS, share loc, radar, layers, settings  
- Map-dot: weather, pin, offline 2/5/10 mi, event location, share  
- Pin editor: Pin/Inside/Icon, photos, size, hide  
- Weather compact card + More details  
- Offline tile packs (Cache API + SW)

## PlanSlayer-specific

- Event-scoped pin stores + **map context bar** (Auto / Personal / Event) = party-style map switcher  
- Quick Load calendar modal in `app.js`

## Intentionally omitted

Deer zones, public lands, hunt/stand logging, full Hunt party-maps.js cloud multiplayer (use event invites instead unless you add **my party maps** from Hunt).
