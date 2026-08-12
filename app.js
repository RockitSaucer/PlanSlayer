/* PlanSlayer V1.2 — Hunt reusable kits parity (map/calendar/pins/weather/design/dialogs/auth/party/offline) */
(function () {
  'use strict';

  var APP_VERSION = '1.3.61';
  var DEFAULT_CHORE_COLOR = '#6a8ab8';
  var CHORE_COLOR_PRESETS = ['#6a8ab8', '#e59a18', '#d94136', '#16a34a', '#9333ea', '#0ea5e9', '#f59e0b', '#ec4899'];
  /** Private per-user checklist (not shared): key listId:userId → items[] */
  var LOCAL_PRIVATE_CHECKLIST_KEY = 'plan_slayer_private_checklist_v1';
  /**
   * Chores = calendar entries like events (not list-item fields).
   * [{ id, name, start_at, end_at, color, show_on_calendar, created_at, updated_at }]
   */
  var LOCAL_CHORES_KEY = 'plan_slayer_chores_v1';
  /** Legacy key (migrated once into LOCAL_CHORES_KEY) */
  var LOCAL_STANDALONE_CHORES_KEY = 'plan_slayer_standalone_chores_v1';
  var DEFAULT_COL_COLORS = { font: '#f0f4ee', tab: '#2a3222', bg: '#0a0c09' };
  /** Hunt Slayer shared palette (same as map pin / location marker presets) */
  var COL_COLOR_PRESETS = ['#000000', '#ffffff', '#2563eb', '#dc2626', '#facc15', '#e59a18', '#16a34a', '#9333ea'];
  var ME_COLOR_PRESETS_FIXED = ['#000000', '#ffffff', '#2563eb', '#dc2626', '#facc15'];
  var ME_COLOR_PRESETS_SEED = ['#e59a18', '#16a34a', '#9333ea'];
  var ME_CUSTOM_COLORS_KEY = 'plan_slayer_my_custom_colors_v1';
  var LOCAL_ME_COLOR_KEY = 'plan_slayer_my_color_v1';
  /** Pending color in user settings until Save (Close ↔ Save) */
  var _userSettingsPendingColor = null;
  var _userSettingsDirty = false;
  /** Cross-tab / multi-device delete + change signal */
  var LOCAL_SYNC_KEY = 'plan_slayer_sync_v1';
  var LOCAL_TOMBSTONES_KEY = 'plan_slayer_tombstones_v1';
  var LOCAL_CAL_COLLAPSED_KEY = 'plan_slayer_cal_collapsed_v1';
  /** Import Hunt/Reg calendar events (shared browser localStorage) once per session */
  var HUNT_CAL_EVENTS_KEY = 'reg_slayer_cal_events_v2';
  var HUNT_IMPORT_MAP_KEY = 'plan_slayer_hunt_import_map_v1';
  /**
   * Cross-app event packing lists — Hunt/Reg read this for “View list”.
   * Shape: { [eventKey]: { listId, name, eventId, huntEventId, invite_code, columns: [{id,name,items:[{title,qty}]}], updated_at } }
   */
  var SLAYER_EVENT_LISTS_KEY = 'slayer_event_lists_v1';
  /** People you’ve shared maps with (Hunt/Reg/Plan) — for Add members */
  var SLAYER_MAP_PARTNERS_KEY = 'slayer_map_partners_v1';
  /** Kit pin: behavior audited against Hunt Slayer this version */
  var HUNT_KIT_SOURCE = '7.0.50-beta';
  var LOCAL_EVENTS_KEY = 'plan_slayer_events_v1';
  var LOCAL_PERSONAL_KEY = 'plan_slayer_personal_v1';
  var LOCAL_SAVED_KEY = 'plan_slayer_saved_lists_v1';
  var LOCAL_ITEM_TEMPLATES_KEY = 'plan_slayer_item_templates_v1';
  var LOCAL_SECTION_TEMPLATES_KEY = 'plan_slayer_section_templates_v1';
  /** One-shot clean slate for this build (lists + events wiped once) */
  var LOCAL_CLEAN_SLATE_KEY = 'plan_slayer_clean_slate_v1216';
  /** Shared across Hunt / Reg / Plan for friends + nicknames */
  var LOCAL_FRIENDS_KEY = 'slayer_friends_v1';
  var LOCAL_FRIENDS_LEGACY = 'plan_slayer_friends_v1';
  var LOCAL_MAP_SETTINGS_KEY = 'plan_slayer_map_settings_v1';
  var LOCAL_FREE_LISTS_KEY = 'plan_slayer_free_lists_v1'; // My lists (unified)
  var LOCAL_INBOX_PREFIX = 'plan_slayer_inbox_';
  var LOCAL_FREE_QUALIFIERS_KEY = 'plan_slayer_list_qualifiers_v1';
  /** Category usage per event-type / list: { [scopeKey]: { recent: [id,...], counts: {id:n} } } */
  var LOCAL_CAT_USAGE_KEY = 'plan_slayer_cat_usage_v1';
  // Muted member / claim colors (less neon)
  var COLORS = ['#a34a4a', '#4a6d9a', '#4d7a55', '#8a7340', '#6b5a8a', '#8a6048', '#3d6e6e', '#8a4a68'];
  var DEFAULT_ME_COLOR = '#a34a4a';
  var DEFAULT_QUALIFIERS = [
    { id: 'food', name: 'Food', color: '#b8a04a' },
    { id: 'equipment', name: 'Equipment', color: '#6a8ab8' },
    { id: 'clothes', name: 'Clothes', color: '#9a7ab8' },
    { id: 'supplies', name: 'Supplies', color: '#5a9a7a' },
    { id: 'other', name: 'Other', color: '#8a9488' }
  ];

  var state = {
    user: null,
    profile: null,
    events: [],
    activeEventId: null,
    view: 'home', // home | event
    mode: 'shared', // legacy; UI is unified "My lists" + events
    sort: 'soonest',
    search: '',
    listTab: 'todo',
    personalTab: 'todo',
    scopeTab: 'group',
    members: [],
    friends: [],
    eventsScope: 'month', // month | all
    mapMode: 'button', // mini | max | button — default minimized (Map button)
    map: null,
    mapLayer: null,
    radarLayer: null,
    pinMode: false,
    pinsLayer: null,
    gpsMarker: null,
    gpsWatch: null,
    expandedItemId: null,
    moveItemId: null,
    noteItemId: null,
    minimizedItems: {},
    itemDetailSnapshot: null,
    itemDetailMeta: null,
    filterQualifier: 'all',
    sortByType: false,
    sideCal: { y: 0, m: 0, selectedDay: null },
    createCal: { y: 0, m: 0, selected: null, endSelected: null },
    gotItem: null,
    expenseItem: null,
    friendsSearch: '',
    activeNamedListId: null, // custom free list id
    datePick: { field: null, y: 0, m: 0, selected: null }, // field: start|end
    /** Hunt calendar kit: optional map pin filter + Quick Load */
    eventPinsFilter: null, // { eventId, name } | null
    mapContext: 'auto', // auto | personal | event:<id> — party/shared map switcher
    /**
     * Which map layer is open on the dock (Hunt-style switcher).
     * mode: plan | private | shared | event
     * Hunt/Reg maps load map_state pins + customAreas (no deer overlays).
     */
    mapViewing: {
      mode: 'plan',
      id: null,
      name: 'Plan personal map',
      pins: null,
      customAreas: null,
      kind: null
    },
    _mapSwitcherCache: { pmaps: [], smaps: [], at: 0 },
    /** Left column top tabs: personal lists vs events (+ event-linked lists) */
    leftTab: 'lists', // lists | events
    /** Map: when true, show pins from all events + personal; false = current context only */
    showAllPins: true,
    /** Side calendar collapsed to a thin bar */
    calCollapsed: false,
    /** Under-calendar list: events | chores */
    calListMode: 'events',
    /** Item id whose Make Chore panel is expanded */
    makeChoreOpenId: null,
    /** Multi-step chore schedule picker */
    choreWhen: {
      itemId: null, kind: null, scope: null, listId: null, colId: null,
      choreId: null, standaloneId: null, title: '', linkItemKey: '',
      step: 'all', y: 0, m: 0, date: null, start: '', end: '',
      color: DEFAULT_CHORE_COLOR, showOnCalendar: true, mode: 'standalone',
      hasExistingSchedule: false, fromChoresList: false
    },
    /** Mobile full-screen list sheet open */
    mobileSheetOpen: false,
    /** Expanded members drawer under left event/list card (id key) */
    membersDrawerKey: null,
    /** Inline "Add members" search open for drawer key */
    membersAddOpenKey: null
  };
  var _sideCalNavLockUntil = 0;
  var _syncChannel = null;
  var _lastSyncAt = 0;

  function $(id) { return document.getElementById(id); }
  /** Local calendar day — never UTC toISOString slice (Hunt hard rule) */
  function localYmd(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function ymdFromIso(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      // already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return String(iso).slice(0, 10);
      return null;
    }
    return localYmd(d);
  }
  function eventColor(ev) {
    return (ev && (ev.color || ev.event_color)) || '#e59a18';
  }
  function eventSpansYmd(ev, ymd) {
    if (!ev || !ymd) return false;
    var start = ymdFromIso(ev.start_at);
    if (!start) return false;
    var end = ymdFromIso(ev.end_at) || start;
    if (end < start) end = start;
    return start <= ymd && end >= ymd;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- In-app dialogs (Hunt-style: never use browser alert/confirm/prompt) ---------- */
  var _dialogResolvers = { alert: null, confirm: null, prompt: null };
  var _toastTimer = null;

  function appToast(msg, ms) {
    var el = $('app-toast');
    if (!el) return;
    // Prefer hosting inside the open map dock so toast sits above the map toolbar
    // (right side, above Settings) instead of covering the bar.
    try {
      var dock = $('map-dock');
      var mapOpen = dock && dock.classList.contains('is-visible') &&
        (state.mapMode === 'mini' || state.mapMode === 'max');
      if (mapOpen && el.parentElement !== dock) {
        dock.appendChild(el);
      } else if (!mapOpen && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    } catch (eHost) {}
    el.textContent = String(msg || '');
    el.style.display = 'block';
    el.classList.add('is-show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
      el.style.display = 'none';
    }, ms || 2400);
  }

  function appAlert(msg, title) {
    return new Promise(function (resolve) {
      var modal = $('app-alert-modal');
      if (!modal) { resolve(); return; }
      if ($('app-alert-title')) $('app-alert-title').textContent = title || 'Notice';
      if ($('app-alert-msg')) $('app-alert-msg').textContent = String(msg || '');
      _dialogResolvers.alert = resolve;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  function appConfirm(msg, title) {
    return new Promise(function (resolve) {
      var modal = $('app-confirm-modal');
      if (!modal) { resolve(false); return; }
      if ($('app-confirm-title')) $('app-confirm-title').textContent = title || 'Confirm';
      if ($('app-confirm-msg')) $('app-confirm-msg').textContent = String(msg || '');
      _dialogResolvers.confirm = resolve;
      // #93: always above expanded list item options + other modals
      modal.style.zIndex = '50000';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  function appPrompt(msg, def, title) {
    return new Promise(function (resolve) {
      var modal = $('app-prompt-modal');
      if (!modal) { resolve(null); return; }
      if ($('app-prompt-title')) $('app-prompt-title').textContent = title || 'Enter value';
      if ($('app-prompt-msg')) $('app-prompt-msg').textContent = String(msg || '');
      if ($('app-prompt-input')) {
        $('app-prompt-input').value = def != null ? String(def) : '';
        setTimeout(function () { try { $('app-prompt-input').focus(); $('app-prompt-input').select(); } catch (e) {} }, 40);
      }
      _dialogResolvers.prompt = resolve;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }

  function closeAppAlert() {
    var modal = $('app-alert-modal');
    if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }
    var r = _dialogResolvers.alert; _dialogResolvers.alert = null;
    if (r) r();
  }
  function closeAppConfirm(ok) {
    var modal = $('app-confirm-modal');
    if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }
    var r = _dialogResolvers.confirm; _dialogResolvers.confirm = null;
    if (r) r(!!ok);
  }
  function closeAppPrompt(ok) {
    var modal = $('app-prompt-modal');
    if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }
    var r = _dialogResolvers.prompt; _dialogResolvers.prompt = null;
    if (!r) return;
    if (!ok) { r(null); return; }
    r(($('app-prompt-input') && $('app-prompt-input').value) || '');
  }
  function uid() {
    return 'i_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function autoCap(s) {
    s = String(s || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    return s.replace(/\w\S*/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }
  function ensureQualifiers(ev) {
    var fallback = DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); });
    if (!ev) {
      return fallback.filter(function (q) { return q.id !== 'other'; })
        .concat([{ id: 'other', name: 'Other', color: '#8a9488' }]);
    }
    if (!ev.state) ev.state = {};
    if (!ev.state.qualifiers || !Array.isArray(ev.state.qualifiers) || !ev.state.qualifiers.length) {
      ev.state.qualifiers = fallback;
    }
    var rest = [], other = null;
    ev.state.qualifiers.forEach(function (q) {
      if (q && q.id === 'other') other = q;
      else if (q) rest.push(q);
    });
    if (!other) other = { id: 'other', name: 'Other', color: '#8a9488' };
    ev.state.qualifiers = rest.concat([other]);
    return ev.state.qualifiers;
  }
  function qualifierFor(ev, id) {
    var qs = ensureQualifiers(ev);
    return qs.find(function (q) { return q.id === id; }) || null;
  }
  function normalizeNotes(item) {
    if (!item) return [];
    if (Array.isArray(item.notesList)) return item.notesList;
    // migrate old string notes
    if (item.notes && String(item.notes).trim()) {
      item.notesList = [{
        id: uid(),
        text: String(item.notes).trim(),
        by: item.created_by || null,
        byName: 'Someone',
        at: item.created_at || new Date().toISOString()
      }];
    } else {
      item.notesList = [];
    }
    return item.notesList;
  }
  function latestNote(item) {
    var list = normalizeNotes(item);
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      return new Date(b.at || 0) - new Date(a.at || 0);
    })[0];
  }
  function needsBuyFlag(ev, item, kind) {
    if (!item) return false;
    if (kind !== 'bring' && kind !== 'buy') return false;
    var t = String(item.title || '').toLowerCase();
    if (!t) return false;
    // Named free list: badge when the other column has the same title
    try {
      var nl = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
      if (nl) {
        sanitizeNamedList(nl);
        var otherId = kind === 'bring' ? 'buy' : 'bring';
        var otherCol = getListColumn(nl, otherId);
        if (otherCol && (otherCol.items || []).some(function (b) {
          return b && String(b.title || '').toLowerCase() === t;
        })) return true;
      }
    } catch (eN) {}
    // Event packing lists
    if (!ev || !ev.state || !ev.state.lists) return false;
    var otherKind = kind === 'bring' ? 'buy' : 'bring';
    var otherList = ev.state.lists[otherKind];
    var other = (otherList && Array.isArray(otherList.group)) ? otherList.group : [];
    try {
      return other.some(function (b) { return b && String(b.title || '').toLowerCase() === t; });
    } catch (e) {
      return false;
    }
  }

  /** True if this column is the To buy section (by id or name) */
  function isBuyColumnKind(kind, list) {
    var k = String(kind || '').toLowerCase();
    if (k === 'buy') return true;
    if (list) {
      try {
        var col = getListColumn(list, kind);
        if (col && String(col.name || '').toLowerCase().replace(/\s+/g, ' ') === 'to buy') return true;
      } catch (e) {}
    }
    return false;
  }

  /**
   * When you “Got it” on To buy, also put a copy in To bring (keeps claim checked on buy).
   * claimQty 0 removes the auto-linked bring copy.
   */
  function syncBuyGotToBringOnNamedList(list, buyItem, claimQty, buyColId) {
    if (!list || !buyItem) return;
    sanitizeNamedList(list);
    if (!isBuyColumnKind(buyColId || 'buy', list)) return;
    var bringCol = getListColumn(list, 'bring');
    if (!bringCol) {
      bringCol = defaultColumn('bring', 'To bring');
      list.columns.push(bringCol);
      sanitizeNamedList(list);
      bringCol = getListColumn(list, 'bring');
    }
    if (!bringCol) return;
    if (!Array.isArray(bringCol.items)) bringCol.items = [];
    var me = myId() || 'local';
    var existingIdx = bringCol.items.findIndex(function (it) {
      return it && String(it.bought_from_id || '') === String(buyItem.id);
    });
    if (claimQty <= 0) {
      if (existingIdx >= 0) {
        var ex = bringCol.items[existingIdx];
        // Only auto-remove copies we created from Got it on buy
        if (ex && ex.bought_from_id) bringCol.items.splice(existingIdx, 1);
      }
      return;
    }
    if (existingIdx >= 0) {
      var existing = bringCol.items[existingIdx];
      if (!existing.claims || typeof existing.claims !== 'object') existing.claims = {};
      existing.claims[me] = claimQty;
      existing.qty = Math.max(1, Number(buyItem.qty) || Number(existing.qty) || 1);
      existing.title = buyItem.title || existing.title;
      return;
    }
    var copy = newItem(buyItem.title || 'Item', {
      qty: Math.max(1, Number(buyItem.qty) || 1),
      qualifier: buyItem.qualifier || 'other',
      priority: buyItem.priority || 0,
      notes: buyItem.notes || '',
      notesList: Array.isArray(buyItem.notesList) ? buyItem.notesList.slice() : [],
      bought_from_id: buyItem.id,
      from_buy: true,
      shared_from: 'From To buy'
    });
    copy.claims = {};
    copy.claims[me] = claimQty;
    bringCol.items.push(copy);
  }

  /** Same for personal board / event group buckets (arrays) */
  function syncBuyGotToBringOnBucket(buyBucket, bringBucket, buyItem, claimQty) {
    if (!buyItem || !Array.isArray(bringBucket)) return;
    var me = myId() || 'local';
    var existingIdx = bringBucket.findIndex(function (it) {
      return it && String(it.bought_from_id || '') === String(buyItem.id);
    });
    if (claimQty <= 0) {
      if (existingIdx >= 0 && bringBucket[existingIdx] && bringBucket[existingIdx].bought_from_id) {
        bringBucket.splice(existingIdx, 1);
      }
      return;
    }
    if (existingIdx >= 0) {
      var existing = bringBucket[existingIdx];
      if (!existing.claims || typeof existing.claims !== 'object') existing.claims = {};
      existing.claims[me] = claimQty;
      existing.qty = Math.max(1, Number(buyItem.qty) || Number(existing.qty) || 1);
      existing.title = buyItem.title || existing.title;
      return;
    }
    var copy = newItem(buyItem.title || 'Item', {
      qty: Math.max(1, Number(buyItem.qty) || 1),
      qualifier: buyItem.qualifier || 'other',
      priority: buyItem.priority || 0,
      notes: buyItem.notes || '',
      bought_from_id: buyItem.id,
      from_buy: true,
      shared_from: 'From To buy'
    });
    copy.claims = {};
    copy.claims[me] = claimQty;
    bringBucket.push(copy);
  }

  /**
   * After Got it claims are set on `item`, mirror buy→bring if needed.
   * free-list: reloads list, applies claims, syncs bring, saves — returns true if saved.
   */
  function afterGotItClaim(item, kind, scope, claimQty) {
    claimQty = Math.max(0, Number(claimQty) || 0);
    try {
      if (scope === 'free-list') {
        var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
        if (!list || !item) return false;
        sanitizeNamedList(list);
        var hit = resolveNamedListItemHit(list, kind, item.id);
        if (!hit || !hit.item) return false;

        // Got it from My checklist → complete personal packing row (full highlight for its qty)
        if ((String(hit.colId) === 'personal' || hit.isChecklist || hit.isPrivateOnly)) {
          var mePers = myId();
          if (!hit.item.claims || typeof hit.item.claims !== 'object') hit.item.claims = {};
          // #117: personal row need is its own qty; fill claim to complete (home packing)
          var needP = Math.max(1, Number(hit.item.qty) || Number(hit.item.claimed_qty) || 1);
          if (claimQty > 0) {
            hit.item.qty = needP;
            hit.item.claims[mePers] = Math.min(needP, Math.max(claimQty, needP));
            // Full complete face: claim fills the personal qty
            hit.item.claims[mePers] = needP;
          } else {
            delete hit.item.claims[mePers];
          }
          // Also keep group source claim in sync when linked
          if (hit.item.source_item_id) {
            var srcHit = findInNamedListColumn(list, hit.item.source_col || null, hit.item.source_item_id) ||
              findInNamedListColumn(list, null, hit.item.source_item_id);
            if (srcHit && srcHit.item) {
              if (!srcHit.item.claims || typeof srcHit.item.claims !== 'object') srcHit.item.claims = {};
              var packAmt = Math.max(1, Number(hit.item.claimed_qty) || needP);
              if (claimQty > 0) srcHit.item.claims[mePers] = packAmt;
              else delete srcHit.item.claims[mePers];
              if (isBuyColumnKind(srcHit.colId, list)) {
                syncBuyGotToBringOnNamedList(list, srcHit.item, claimQty > 0 ? packAmt : 0, srcHit.colId);
              }
            }
          }
          saveNamedList(list);
          return true;
        }

        // Apply claims from the toggled item onto the store list, then sync bring
        hit.item.claims = Object.assign({}, item.claims || {});
        if (isBuyColumnKind(kind, list) || isBuyColumnKind(hit.colId, list)) {
          syncBuyGotToBringOnNamedList(list, hit.item, claimQty, hit.colId || kind);
        }
        // Got it! → Personal {Event/List} under Personal lists (always for packing packs)
        try {
          var colId = hit.colId || kind;
          if (String(colId) !== 'personal' && !isPersonalEventShadowList(list)) {
            try {
              if (listWantsPersonalChecklist(list) || list.eventId || activeEvent()) {
                ensurePersonalColumn(list);
                syncClaimToPrivateChecklist(list, hit.item, claimQty, colId);
              }
            } catch (ePc) {}
            // Always ensure personal list exists + copy claim (even if eventId was missing)
            try {
              var evHint = resolveEventForList(list) || activeEvent();
              if (evHint) ensurePersonalEventList(evHint, list);
              else ensurePersonalEventList(null, list);
            } catch (eEns) {}
            var pList = syncClaimToPersonalEventList(list, hit.item, claimQty, colId);
            if (pList && claimQty > 0) {
              try { appToast('Added to ' + (pList.name || 'personal list')); } catch (eT) {}
            } else if (claimQty > 0 && !pList) {
              console.warn('[PlanSlayer] Got it! did not create personal list', list && list.id, list && list.eventId);
              try { appToast('Could not add to personal list — try again'); } catch (eT2) {}
            }
          }
        } catch (ePriv) {
          console.warn('afterGotItClaim personal event list', ePriv);
        }
        saveNamedList(list);
        return true;
      }
      if (scope === 'personal-board') {
        if (String(kind) === 'buy') {
          var board = loadPersonalBoard();
          if (!Array.isArray(board.bring)) board.bring = [];
          var buyIt = (board.buy || []).find(function (x) { return String(x.id) === String(item.id); }) || item;
          if (!buyIt.claims) buyIt.claims = {};
          buyIt.claims = Object.assign({}, item.claims || {});
          syncBuyGotToBringOnBucket(board.buy, board.bring, buyIt, claimQty);
          savePersonalBoard(board);
          return true;
        }
      }
      if (scope === 'group') {
        var ev = activeEvent();
        if (ev && ev.state && ev.state.lists) {
          if (String(kind) === 'buy') {
            var buyB = getListBucket(ev, 'buy', 'group');
            var bringB = getListBucket(ev, 'bring', 'group');
            var live = (buyB || []).find(function (x) { return String(x.id) === String(item.id); }) || item;
            syncBuyGotToBringOnBucket(buyB, bringB, live, claimQty);
          }
          try {
            var pack = ensureAssociatedListForEvent(ev);
            if (pack) {
              syncClaimToPrivateChecklist(pack, item, claimQty, kind);
              syncClaimToPersonalEventList(pack, item, claimQty, kind);
            }
          } catch (ePk) {}
        }
      }
    } catch (eSync) {
      console.warn('afterGotItClaim', eSync);
    }
    return false;
  }
  function loadJson(key, fb) {
    try {
      var r = localStorage.getItem(key);
      return r ? JSON.parse(r) : fb;
    } catch (e) { return fb; }
  }
  function saveJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  /* ---------- Cross-tab / device sync (deletes show up faster) ---------- */
  /**
   * Tombstones:
   *  - events: deleted event ids
   *  - lists: deleted list ids (block re-save)
   *  - eventLists: event ids whose packing list pack was deleted by the user
   *    (blocks ensureAssociatedListForEvent from recreating “Texas NXL · lists” etc.)
   */
  function loadTombstones() {
    var t = loadJson(LOCAL_TOMBSTONES_KEY, null) || { events: {}, lists: {}, eventLists: {} };
    if (!t.events || typeof t.events !== 'object') t.events = {};
    if (!t.lists || typeof t.lists !== 'object') t.lists = {};
    if (!t.eventLists || typeof t.eventLists !== 'object') t.eventLists = {};
    // Drop entries older than 90 days (list/event deletes should stick longer than 14d)
    var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    ['events', 'lists', 'eventLists'].forEach(function (k) {
      Object.keys(t[k]).forEach(function (id) {
        if (Number(t[k][id]) < cutoff) delete t[k][id];
      });
    });
    return t;
  }
  function tombstoneBag(t, kind) {
    if (kind === 'event') return t.events;
    if (kind === 'eventList' || kind === 'event-list' || kind === 'event_list') return t.eventLists;
    return t.lists;
  }
  function markTombstone(kind, id) {
    if (id == null || id === '') return;
    var t = loadTombstones();
    tombstoneBag(t, kind)[String(id)] = Date.now();
    saveJson(LOCAL_TOMBSTONES_KEY, t);
  }
  function clearTombstone(kind, id) {
    if (id == null || id === '') return;
    var t = loadTombstones();
    var bag = tombstoneBag(t, kind);
    if (bag[String(id)]) {
      delete bag[String(id)];
      saveJson(LOCAL_TOMBSTONES_KEY, t);
    }
  }
  function isTombstoned(kind, id) {
    if (id == null || id === '') return false;
    var t = loadTombstones();
    return !!tombstoneBag(t, kind)[String(id)];
  }
  /** Permanently remove a named list from storage + tombstone (and its event pack slot). */
  function permanentlyDeleteNamedList(listOrId, opts) {
    opts = opts || {};
    var list = null;
    var lid = null;
    if (listOrId && typeof listOrId === 'object') {
      list = listOrId;
      lid = String(list.id || '');
    } else {
      lid = String(listOrId || '');
      try { list = findNamedListById(lid); } catch (eF) { list = null; }
    }
    if (!lid) return false;
    var eventId = list && list.eventId ? String(list.eventId) : (opts.eventId ? String(opts.eventId) : null);
    markTombstone('list', lid);
    if (eventId) markTombstone('eventList', eventId);
    try {
      var store = loadFreeListsStoreRaw();
      store.named = (store.named || []).filter(function (n) { return String(n && n.id) !== lid; });
      // Also drop any other packs still linked to this event if opts.stripEventPacks
      if (opts.stripEventPacks && eventId) {
        store.named = store.named.filter(function (n) {
          if (!n) return false;
          if (String(n.id) === lid) return false;
          if (n.eventId && String(n.eventId) === eventId) {
            markTombstone('list', n.id);
            return false;
          }
          return true;
        });
      }
      saveJson(LOCAL_FREE_LISTS_KEY, store);
    } catch (eS) {
      console.warn('permanentlyDeleteNamedList', eS);
      return false;
    }
    if (String(state.activeNamedListId) === lid) {
      state.activeNamedListId = null;
      state.mobileSheetOpen = false;
    }
    return true;
  }
  function broadcastSync(payload) {
    payload = payload || {};
    payload.at = Date.now();
    payload.src = payload.src || (myId() || 'local');
    try {
      localStorage.setItem(LOCAL_SYNC_KEY, JSON.stringify(payload));
    } catch (e) {}
    try {
      if (!_syncChannel && typeof BroadcastChannel !== 'undefined') {
        _syncChannel = new BroadcastChannel('plan_slayer_sync');
      }
      if (_syncChannel) _syncChannel.postMessage(payload);
    } catch (e2) {}
  }
  function applyRemoteSync(payload, fromSelf) {
    if (!payload || !payload.at) return;
    if (payload.at <= _lastSyncAt) return;
    _lastSyncAt = payload.at;
    // Ignore echo of our own save within 400ms (we already re-rendered)
    if (fromSelf) return;
    try {
      if (payload.type === 'delete-event' && payload.id) {
        markTombstone('event', payload.id);
        state.events = (state.events || []).filter(function (e) { return String(e.id) !== String(payload.id); });
        if (String(state.activeEventId) === String(payload.id)) {
          state.activeEventId = null;
          state.view = 'home';
        }
        // personal board too
        try {
          var board = loadPersonalBoard();
          board.events = (board.events || []).filter(function (e) { return String(e.id) !== String(payload.id); });
          savePersonalBoard(board);
        } catch (eB) {}
      }
      if (payload.type === 'delete-list' && payload.id) {
        markTombstone('list', payload.id);
        if (payload.eventId) markTombstone('eventList', payload.eventId);
        try {
          var store = loadFreeListsStoreRaw();
          store.named = (store.named || []).filter(function (n) {
            if (!n) return false;
            if (String(n.id) === String(payload.id)) return false;
            // Never delete Personal {Event} claim lists when a shared pack is deleted
            if (n.isPersonalEventList || n.personalForEventId) return true;
            // Drop other shared packs for the same event so they can't reappear
            if (payload.eventId && n.eventId && String(n.eventId) === String(payload.eventId)) {
              markTombstone('list', n.id);
              return false;
            }
            return true;
          });
          saveJson(LOCAL_FREE_LISTS_KEY, store);
        } catch (eL) {}
        if (String(state.activeNamedListId) === String(payload.id)) {
          state.activeNamedListId = null;
          state.mobileSheetOpen = false;
        }
      }
      // Soft reload from storage for any change
      try {
        var localEv = loadJson(LOCAL_EVENTS_KEY, []);
        if (Array.isArray(localEv)) {
          var dead = loadTombstones().events;
          state.events = localEv.filter(function (e) { return e && !dead[String(e.id)]; }).map(normalizeEvent);
        }
      } catch (eE) {}
      if (payload.type === 'delete-event' || payload.type === 'delete-list') {
        try { closeMobileListSheet(true); } catch (eC) {}
      }
      // Don't wipe list add inputs if the user is mid-type
      if (typeof renderUnlessTypingInListAdd === 'function') renderUnlessTypingInListAdd();
      else render();
    } catch (eR) {
      console.warn('applyRemoteSync', eR);
    }
  }
  /** List column “Type item…” boxes — full render() used to destroy these mid-keystroke */
  var LIST_ADD_INPUT_SEL = '[data-col-add-input], [data-event-col-add-input], #add-item-input';

  function isTypingInListAdd() {
    try {
      var ae = document.activeElement;
      if (!ae) return false;
      // #115: also protect qty / expanded item detail fields from mid-edit re-render → snap to 1
      if (ae.matches && ae.matches('.li-detail input, .li-detail textarea, .li-detail select')) return true;
      if (ae.closest && ae.closest('.li-detail')) return true;
      if (ae.tagName !== 'INPUT' && ae.tagName !== 'TEXTAREA') return false;
      if (ae.matches && ae.matches(LIST_ADD_INPUT_SEL)) return true;
      if (ae.closest && ae.closest('.list-col-add')) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function listAddInputKey(inp) {
    if (!inp) return '';
    if (inp.id === 'add-item-input') return '#add-item-input';
    return inp.getAttribute('data-col-add-input') ||
      inp.getAttribute('data-event-col-add-input') || '';
  }

  function captureListAddDrafts() {
    var draft = { values: {}, focusKey: null, selStart: null, selEnd: null };
    try {
      document.querySelectorAll(LIST_ADD_INPUT_SEL).forEach(function (inp) {
        var key = listAddInputKey(inp);
        if (!key) return;
        var v = String(inp.value || '');
        // Prefer non-empty when desktop + mobile both paint the same column
        if (draft.values[key] == null || v) draft.values[key] = v;
        if (document.activeElement === inp) {
          draft.focusKey = key;
          try {
            draft.selStart = inp.selectionStart;
            draft.selEnd = inp.selectionEnd;
          } catch (eS) {}
        }
      });
    } catch (e) {}
    return draft;
  }

  function restoreListAddDrafts(draft) {
    if (!draft || !draft.values) return;
    try {
      Object.keys(draft.values).forEach(function (key) {
        var val = draft.values[key];
        if (val == null) return;
        var nodes = key === '#add-item-input'
          ? (function () {
              var el = $('add-item-input');
              return el ? [el] : [];
            })()
          : Array.prototype.slice.call(document.querySelectorAll(
              '[data-col-add-input="' + String(key).replace(/"/g, '') + '"],' +
              '[data-event-col-add-input="' + String(key).replace(/"/g, '') + '"]'
            ));
        nodes.forEach(function (inp) {
          if (inp) inp.value = val;
        });
      });
      if (!draft.focusKey) return;
      var candidates = draft.focusKey === '#add-item-input'
        ? (function () {
            var el = $('add-item-input');
            return el ? [el] : [];
          })()
        : Array.prototype.slice.call(document.querySelectorAll(
            '[data-col-add-input="' + String(draft.focusKey).replace(/"/g, '') + '"],' +
            '[data-event-col-add-input="' + String(draft.focusKey).replace(/"/g, '') + '"]'
          ));
      var focusInp = candidates[0] || null;
      if (state.mobileSheetOpen) {
        for (var i = 0; i < candidates.length; i++) {
          if (candidates[i].closest && candidates[i].closest('#mobile-list-sheet')) {
            focusInp = candidates[i];
            break;
          }
        }
      } else {
        for (var j = 0; j < candidates.length; j++) {
          if (candidates[j].closest && candidates[j].closest('#ev-list')) {
            focusInp = candidates[j];
            break;
          }
        }
      }
      if (!focusInp) return;
      try {
        focusInp.focus({ preventScroll: true });
      } catch (eF0) {
        try { focusInp.focus(); } catch (eF1) {}
      }
      if (draft.selStart != null) {
        try {
          var end = draft.selEnd != null ? draft.selEnd : draft.selStart;
          focusInp.setSelectionRange(draft.selStart, end);
        } catch (eSel) {}
      }
    } catch (eR) {}
  }

  /** Background sync must not steal the add-item cursor — queue until blur/idle */
  function renderUnlessTypingInListAdd() {
    if (isTypingInListAdd()) {
      state._pendingRenderWhileTyping = true;
      return;
    }
    state._pendingRenderWhileTyping = false;
    try { render(); } catch (e) { console.warn('renderUnlessTypingInListAdd', e); }
  }

  function flushPendingRenderIfIdle() {
    if (!state._pendingRenderWhileTyping) return;
    if (isTypingInListAdd()) return;
    state._pendingRenderWhileTyping = false;
    try { render(); } catch (e) {}
  }

  function wireCrossTabSync() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        _syncChannel = new BroadcastChannel('plan_slayer_sync');
        _syncChannel.onmessage = function (ev) {
          applyRemoteSync(ev.data || {}, false);
        };
      }
    } catch (e) {}
    window.addEventListener('storage', function (e) {
      if (!e) return;
      if (e.key === LOCAL_SYNC_KEY && e.newValue) {
        try { applyRemoteSync(JSON.parse(e.newValue), false); } catch (err) {}
        return;
      }
      // Another tab wrote events or lists — refresh UI soon
      if (e.key === LOCAL_EVENTS_KEY || e.key === LOCAL_FREE_LISTS_KEY || e.key === LOCAL_PERSONAL_KEY || e.key === LOCAL_TOMBSTONES_KEY) {
        try {
          if (e.key === LOCAL_EVENTS_KEY && e.newValue) {
            var arr = JSON.parse(e.newValue);
            if (Array.isArray(arr)) {
              var dead = loadTombstones().events;
              state.events = arr.filter(function (x) { return x && !dead[String(x.id)]; }).map(normalizeEvent);
            }
          }
          renderUnlessTypingInListAdd();
        } catch (err2) {}
      }
    });
    // When tab becomes visible, re-sync Plan events + Hunt calendar cloud
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (typeof resyncHuntEventsNow === 'function') {
        resyncHuntEventsNow({ quiet: true }).then(function () {
          if (typeof loadEvents === 'function') return loadEvents();
        }).then(function () { renderUnlessTypingInListAdd(); })
          .catch(function () { renderUnlessTypingInListAdd(); });
      } else if (typeof loadEvents === 'function') {
        loadEvents().then(function () { renderUnlessTypingInListAdd(); })
          .catch(function () { renderUnlessTypingInListAdd(); });
      }
    });
    // #103: poll cloud events + list packs so other members' edits appear while open
    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (typeof isTypingInListAdd === 'function' && isTypingInListAdd()) return;
      // Prefer full loadEvents (pulls plan_events + applies namedListPack)
      if (typeof loadEvents === 'function') {
        loadEvents().then(function () {
          renderUnlessTypingInListAdd();
        }).catch(function () {
          if (typeof resyncHuntEventsNow === 'function') {
            resyncHuntEventsNow({ quiet: true }).then(function () {
              renderUnlessTypingInListAdd();
            }).catch(function () {});
          }
        });
      } else if (typeof resyncHuntEventsNow === 'function') {
        resyncHuntEventsNow({ quiet: true }).then(function () {
          renderUnlessTypingInListAdd();
        }).catch(function () {});
      }
    }, 3500);
    // After leaving an add box, apply any sync re-render we deferred
    if (!document._psListAddFocusFlush) {
      document._psListAddFocusFlush = true;
      document.addEventListener('focusout', function (e) {
        var t = e.target;
        if (!t || !t.matches) return;
        if (!t.matches(LIST_ADD_INPUT_SEL) && !(t.closest && t.closest('.list-col-add'))) return;
        setTimeout(flushPendingRenderIfIdle, 0);
      }, true);
    }
  }
  function isMobileLayout() {
    try {
      return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    } catch (e) {
      return window.innerWidth <= 900;
    }
  }
  /** V1.2.16: wipe lists + events once so this build starts clean for bug-checking */
  function maybeCleanSlateThisBuild() {
    try {
      if (localStorage.getItem(LOCAL_CLEAN_SLATE_KEY)) return;
      [
        LOCAL_EVENTS_KEY,
        LOCAL_CHORES_KEY,
        LOCAL_STANDALONE_CHORES_KEY,
        LOCAL_PERSONAL_KEY,
        LOCAL_FREE_LISTS_KEY,
        LOCAL_SAVED_KEY,
        LOCAL_ITEM_TEMPLATES_KEY,
        LOCAL_SECTION_TEMPLATES_KEY,
        LOCAL_FREE_QUALIFIERS_KEY,
        LOCAL_INBOX_PREFIX + (myId() || 'local')
      ].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (eR) {}
      });
      // Also clear any plan_slayer_inbox_* keys
      try {
        var kill = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(LOCAL_INBOX_PREFIX) === 0) kill.push(key);
        }
        kill.forEach(function (k) { localStorage.removeItem(k); });
      } catch (eI) {}
      localStorage.setItem(LOCAL_CLEAN_SLATE_KEY, JSON.stringify({
        wiped_at: new Date().toISOString(),
        version: APP_VERSION
      }));
      state.events = [];
      state.activeEventId = null;
      state.activeNamedListId = null;
      console.info('[PlanSlayer] Clean slate applied for', APP_VERSION);
    } catch (e) {
      console.warn('clean slate failed', e);
    }
  }
  function sb() {
    return window.PlanSlayerAuth && window.PlanSlayerAuth.getClient && window.PlanSlayerAuth.getClient();
  }
  function me() {
    return (window.PlanSlayerAuth && window.PlanSlayerAuth.getUser && window.PlanSlayerAuth.getUser()) || state.user;
  }
  function myId() {
    var u = me();
    return u ? u.id : null;
  }
  function myName() {
    try {
      var localNick = localStorage.getItem('plan_slayer_nickname_v1');
      if (localNick && String(localNick).trim()) return String(localNick).trim();
    } catch (eN) {}
    var p = state.profile || (window.PlanSlayerAuth && window.PlanSlayerAuth.getProfile && window.PlanSlayerAuth.getProfile());
    if (p && (p.display_name || p.username)) return p.display_name || p.username;
    var u = me();
    return (u && u.email) ? String(u.email).split('@')[0] : 'You';
  }
  function myColor() {
    try {
      var saved = localStorage.getItem(LOCAL_ME_COLOR_KEY);
      if (saved && /^#[0-9a-fA-F]{3,8}$/.test(String(saved).trim())) {
        return normalizeHexColor(saved) || DEFAULT_ME_COLOR;
      }
    } catch (eC) {}
    var p = state.profile || (window.PlanSlayerAuth && window.PlanSlayerAuth.getProfile && window.PlanSlayerAuth.getProfile());
    var c = (p && p.arrow_color) || DEFAULT_ME_COLOR;
    // Soften classic bright red if still stored as Hunt default
    if (String(c).toLowerCase() === '#e11d1d' || String(c).toLowerCase() === '#ff0000') {
      return DEFAULT_ME_COLOR;
    }
    return c;
  }
  function normalizeHexColor(hex) {
    if (!hex) return null;
    var s = String(hex).trim();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
    return s.toLowerCase();
  }
  function applyMyColor(hex) {
    hex = normalizeHexColor(hex);
    if (!hex) return false;
    if (!state.profile) state.profile = {};
    state.profile.arrow_color = hex;
    try { localStorage.setItem(LOCAL_ME_COLOR_KEY, hex); } catch (e) {}
    var me = myId() || 'local';
    // Update active event members + list members so fill color updates immediately
    (state.members || []).forEach(function (m) {
      if (m && String(m.user_id) === String(me)) m.arrow_color = hex;
    });
    try {
      var store = loadFreeListsStore();
      (store.named || []).forEach(function (n) {
        (n.members || []).forEach(function (m) {
          if (m && String(m.user_id) === String(me)) m.arrow_color = hex;
        });
      });
      saveFreeListsStore(store);
    } catch (eL) {}
    try {
      var client = sb();
      if (client && me && me !== 'local') {
        client.from('profiles').upsert({
          id: me,
          arrow_color: hex,
          display_name: myName(),
          username: (state.profile && state.profile.username) || undefined
        }).then(function () {}).catch(function () {});
      }
    } catch (eP) {}
    return true;
  }
  function loadMyRecentCustomColors() {
    try {
      var arr = JSON.parse(localStorage.getItem(ME_CUSTOM_COLORS_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(normalizeHexColor).filter(Boolean).slice(0, 3);
    } catch (e) { return []; }
  }
  function saveMyRecentCustomColor(hex) {
    hex = normalizeHexColor(hex);
    if (!hex) return;
    if (ME_COLOR_PRESETS_FIXED.indexOf(hex) >= 0 || ME_COLOR_PRESETS_SEED.indexOf(hex) >= 0) return;
    var list = loadMyRecentCustomColors().filter(function (c) { return c !== hex; });
    list.unshift(hex);
    try { localStorage.setItem(ME_CUSTOM_COLORS_KEY, JSON.stringify(list.slice(0, 3))); } catch (e) {}
  }
  /** Hunt-style row: fixed 5 + up to 3 custom/seed trailing slots */
  function getMyColorPresetRow() {
    var custom = loadMyRecentCustomColors();
    var row = ME_COLOR_PRESETS_FIXED.slice();
    for (var i = 0; i < 3; i++) row.push(custom[i] || ME_COLOR_PRESETS_SEED[i] || '#888888');
    return row;
  }
  function renderMyColorPicker(selected) {
    selected = normalizeHexColor(selected) || myColor();
    var row = $('user-color-swatches');
    if (row) {
      row.innerHTML = getMyColorPresetRow().map(function (c) {
        var on = normalizeHexColor(c) === selected;
        return '<button type="button" class="cp-swatch' + (on ? ' selected' : '') +
          '" data-my-color="' + c + '" style="background:' + c +
          (c === '#ffffff' ? ';box-shadow:inset 0 0 0 1px #666' : '') +
          '" title="' + c + '"></button>';
      }).join('');
    }
    if ($('user-color-wheel')) $('user-color-wheel').value = selected;
    if ($('user-color-preview')) $('user-color-preview').style.background = selected;
    if ($('user-color-value')) $('user-color-value').textContent = selected;
  }
  /** Close stays Close until a color is picked; then it becomes Save (primary). */
  function syncUserSettingsCloseSaveBtn() {
    var btn = $('user-settings-cancel');
    if (!btn) return;
    if (_userSettingsDirty) {
      btn.textContent = 'Save';
      btn.classList.add('btn-primary');
      btn.setAttribute('data-mode', 'save');
    } else {
      btn.textContent = 'Close';
      btn.classList.remove('btn-primary');
      btn.setAttribute('data-mode', 'close');
    }
  }
  function setUserSettingsPendingColor(hex) {
    hex = normalizeHexColor(hex);
    if (!hex) return;
    _userSettingsPendingColor = hex;
    _userSettingsDirty = true;
    if (ME_COLOR_PRESETS_FIXED.indexOf(hex) < 0 && ME_COLOR_PRESETS_SEED.indexOf(hex) < 0) {
      saveMyRecentCustomColor(hex);
    }
    renderMyColorPicker(hex);
    syncUserSettingsCloseSaveBtn();
  }
  function saveUserSettingsFromModal() {
    var nick = ($('user-settings-nick') && $('user-settings-nick').value) || '';
    var nickOk = true;
    if (String(nick || '').trim()) {
      nickOk = applyNicknameEverywhere(nick);
      if (!nickOk) {
        appToast('Enter a nickname');
        return false;
      }
      if ($('user-chip-btn')) $('user-chip-btn').textContent = myName();
    }
    if (_userSettingsPendingColor) {
      if (applyMyColor(_userSettingsPendingColor)) {
        renderMyColorPicker(_userSettingsPendingColor);
      }
    }
    _userSettingsPendingColor = null;
    _userSettingsDirty = false;
    syncUserSettingsCloseSaveBtn();
    appToast('Settings saved');
    closeUserSettingsModal();
    try { render(); } catch (eR) {}
    return true;
  }

  function loadPersonalBoard() {
    var b = loadJson(LOCAL_PERSONAL_KEY, null) || {};
    if (!Array.isArray(b.todo)) b.todo = [];
    if (!Array.isArray(b.buy)) b.buy = [];
    if (!Array.isArray(b.bring)) b.bring = [];
    if (!Array.isArray(b.events)) b.events = [];
    if (!Array.isArray(b.inbox)) b.inbox = [];
    return b;
  }
  function savePersonalBoard(b) {
    saveJson(LOCAL_PERSONAL_KEY, b);
  }
  function inboxKeyFor(uid) {
    return LOCAL_INBOX_PREFIX + String(uid || 'local');
  }
  function loadInboxFor(uid) {
    return loadJson(inboxKeyFor(uid), []) || [];
  }
  function saveInboxFor(uid, items) {
    saveJson(inboxKeyFor(uid), items || []);
  }
  function mergeInboxIntoPersonal() {
    var uid = myId() || 'local';
    var inbox = loadInboxFor(uid);
    if (!inbox.length) return;
    var board = loadPersonalBoard();
    inbox.forEach(function (pack) {
      var kind = pack.kind || 'todo';
      if (!board[kind]) board[kind] = [];
      (pack.items || []).forEach(function (it) {
        var copy = newItem(it.title || 'Item', {
          qty: it.qty || 1,
          notes: it.notes || '',
          notesList: it.notesList || [],
          qualifier: it.qualifier || 'other',
          priority: it.priority || 0,
          shared_from: pack.fromName || 'Someone',
          shared_at: pack.at || new Date().toISOString()
        });
        board[kind].push(copy);
      });
      board.inbox.push({
        id: uid(),
        fromName: pack.fromName || 'Someone',
        kind: kind,
        count: (pack.items || []).length,
        at: pack.at || new Date().toISOString()
      });
    });
    savePersonalBoard(board);
    saveInboxFor(uid, []);
  }
  function normalizeFriend(f) {
    if (!f) return null;
    var nicknames = Array.isArray(f.nicknames) ? f.nicknames.slice() : [];
    if (f.nickname && nicknames.indexOf(f.nickname) < 0) nicknames.push(String(f.nickname));
    return {
      user_id: f.user_id || f.id || null,
      display_name: f.display_name || f.name || f.username || 'Friend',
      username: f.username || '',
      nicknames: nicknames.map(function (n) { return String(n || '').trim(); }).filter(Boolean),
      arrow_color: f.arrow_color || COLORS[0],
      last_seen: f.last_seen || new Date().toISOString(),
      provisional: !!f.provisional
    };
  }
  function friendSearchBlob(f) {
    if (!f) return '';
    var parts = [f.display_name, f.username].concat(f.nicknames || []);
    return parts.join(' ').toLowerCase();
  }
  function friendLabel(f) {
    if (!f) return 'Friend';
    var nick = (f.nicknames && f.nicknames[0]) || '';
    if (nick && f.username) return nick + ' (' + f.username + ')';
    if (nick) return nick;
    if (f.display_name && f.username && f.display_name !== f.username) {
      return f.display_name + ' (' + f.username + ')';
    }
    return f.display_name || f.username || 'Friend';
  }
  function rememberFriend(f) {
    if (!f) return;
    var nf = normalizeFriend(f);
    if (!nf) return;
    if (nf.user_id && String(nf.user_id) === String(myId())) return;
    var list = loadFriendsRaw();
    var idx = -1;
    if (nf.user_id) {
      idx = list.findIndex(function (x) { return x.user_id && String(x.user_id) === String(nf.user_id); });
    }
    if (idx < 0 && nf.username) {
      idx = list.findIndex(function (x) {
        return String(x.username || '').toLowerCase() === String(nf.username).toLowerCase();
      });
    }
    if (idx < 0 && !nf.user_id && nf.display_name) {
      idx = list.findIndex(function (x) {
        return !x.user_id && String(x.display_name || '').toLowerCase() === String(nf.display_name).toLowerCase();
      });
    }
    if (idx >= 0) {
      var prev = list[idx];
      var nicks = (prev.nicknames || []).slice();
      (nf.nicknames || []).forEach(function (n) {
        if (nicks.indexOf(n) < 0) nicks.push(n);
      });
      list[idx] = Object.assign({}, prev, nf, {
        nicknames: nicks,
        display_name: nf.display_name || prev.display_name,
        username: nf.username || prev.username,
        user_id: nf.user_id || prev.user_id
      });
    } else {
      list.push(nf);
    }
    saveJson(LOCAL_FRIENDS_KEY, list);
    state.friends = list;
  }
  function loadFriendsRaw() {
    var list = loadJson(LOCAL_FRIENDS_KEY, null);
    if (!Array.isArray(list) || !list.length) {
      var legacy = loadJson(LOCAL_FRIENDS_LEGACY, []) || [];
      if (legacy.length) {
        list = legacy.map(normalizeFriend).filter(Boolean);
        saveJson(LOCAL_FRIENDS_KEY, list);
      } else list = [];
    } else {
      list = list.map(normalizeFriend).filter(Boolean);
    }
    return list;
  }
  function loadFriends() {
    state.friends = loadFriendsRaw();
  }
  function searchFriends(q, limit) {
    q = String(q || '').toLowerCase().trim();
    var list = loadFriendsRaw();
    if (!q) return list.slice(0, limit || 12);
    return list.filter(function (f) {
      return friendSearchBlob(f).indexOf(q) >= 0;
    }).slice(0, limit || 12);
  }
  function addNicknameToFriend(friendKey, nickname) {
    nickname = autoCap(String(nickname || '').trim());
    if (!nickname) return;
    var list = loadFriendsRaw();
    var idx = list.findIndex(function (f) {
      return (f.user_id && String(f.user_id) === String(friendKey)) ||
        String(f.username || '').toLowerCase() === String(friendKey).toLowerCase() ||
        String(f.display_name || '').toLowerCase() === String(friendKey).toLowerCase();
    });
    if (idx < 0) {
      list.push(normalizeFriend({
        user_id: null,
        display_name: nickname,
        nicknames: [nickname],
        provisional: true
      }));
    } else {
      if (!list[idx].nicknames) list[idx].nicknames = [];
      if (list[idx].nicknames.indexOf(nickname) < 0) list[idx].nicknames.push(nickname);
    }
    saveJson(LOCAL_FRIENDS_KEY, list);
    state.friends = list;
  }
  function collectFriendsFromMembers() {
    (state.members || []).forEach(function (m) {
      rememberFriend(m);
    });
  }
  function shareIconSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
      '<path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  }
  function freeListQualifiers() {
    var qs = loadJson(LOCAL_FREE_QUALIFIERS_KEY, null);
    if (!Array.isArray(qs) || !qs.length) {
      qs = DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); });
      saveJson(LOCAL_FREE_QUALIFIERS_KEY, qs);
    }
    return qs;
  }
  function saveFreeListQualifiers(qs) {
    saveJson(LOCAL_FREE_QUALIFIERS_KEY, qs || []);
  }

  /** Scope key for category ranking: event type, or list id, or "personal" */
  function catUsageScopeKey(ev, freeList) {
    if (freeList && freeList.id) {
      if (freeList.eventId) {
        var fe = findEventById(freeList.eventId);
        if (fe && fe.event_type) return 'type:' + String(fe.event_type).toLowerCase();
        return 'event:' + String(freeList.eventId);
      }
      return 'list:' + String(freeList.id);
    }
    if (ev && !ev._personalOnly) {
      if (ev.event_type) return 'type:' + String(ev.event_type).toLowerCase();
      return 'event:' + String(ev.id || 'unknown');
    }
    return 'personal';
  }
  function loadCatUsageBag() {
    var bag = loadJson(LOCAL_CAT_USAGE_KEY, null);
    return bag && typeof bag === 'object' ? bag : {};
  }
  function getCatUsage(scopeKey) {
    var bag = loadCatUsageBag();
    var row = bag[scopeKey] || { recent: [], counts: {} };
    if (!Array.isArray(row.recent)) row.recent = [];
    if (!row.counts || typeof row.counts !== 'object') row.counts = {};
    return row;
  }
  function recordCategoryUse(catId, ev, freeList) {
    if (!catId || catId === '__add_category__') return;
    var key = catUsageScopeKey(ev, freeList);
    var bag = loadCatUsageBag();
    var row = bag[key] || { recent: [], counts: {} };
    if (!Array.isArray(row.recent)) row.recent = [];
    if (!row.counts || typeof row.counts !== 'object') row.counts = {};
    row.counts[catId] = (Number(row.counts[catId]) || 0) + 1;
    row.recent = [String(catId)].concat(row.recent.filter(function (id) {
      return String(id) !== String(catId);
    })).slice(0, 12);
    bag[key] = row;
    saveJson(LOCAL_CAT_USAGE_KEY, bag);
    // Keep permanent category list ordered: last 3 used first, then by frequency
    try { promoteCategoryInQualifiers(catId, ev, freeList); } catch (eP) {}
  }
  function promoteCategoryInQualifiers(catId, ev, freeList) {
    var key = catUsageScopeKey(ev, freeList);
    var usage = getCatUsage(key);
    function reorder(qs) {
      if (!Array.isArray(qs)) return qs;
      var other = null;
      var rest = [];
      qs.forEach(function (q) {
        if (!q) return;
        if (q.id === 'other') other = q;
        else rest.push(q);
      });
      var byId = {};
      rest.forEach(function (q) { byId[String(q.id)] = q; });
      var ordered = [];
      var recent3 = (usage.recent || []).slice(0, 3);
      recent3.forEach(function (id) {
        if (byId[String(id)]) {
          ordered.push(byId[String(id)]);
          delete byId[String(id)];
        }
      });
      // remaining by frequency desc then name
      var leftovers = Object.keys(byId).map(function (id) { return byId[id]; });
      leftovers.sort(function (a, b) {
        var ca = Number(usage.counts[a.id]) || 0;
        var cb = Number(usage.counts[b.id]) || 0;
        if (cb !== ca) return cb - ca;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      ordered = ordered.concat(leftovers);
      if (!other) other = { id: 'other', name: 'Other', color: '#8a9488' };
      return ordered.concat([other]);
    }
    if (ev && !ev._personalOnly && !(freeList && freeList.id && !freeList.eventId)) {
      // Event-linked or pure event
      if (ev && ev.state) {
        ensureQualifiers(ev);
        ev.state.qualifiers = reorder(ev.state.qualifiers);
      }
    }
    if (freeList || !ev || ev._personalOnly) {
      var fqs = freeListQualifiers();
      saveFreeListQualifiers(reorder(fqs));
    }
  }
  function orderedQualifiersForSelect(ev, freeList) {
    var qs;
    if (ev && !ev._personalOnly && !(freeList && !freeList.eventId)) {
      qs = ensureQualifiers(ev).map(function (q) { return Object.assign({}, q); });
    } else {
      qs = freeListQualifiers().map(function (q) { return Object.assign({}, q); });
    }
    var usage = getCatUsage(catUsageScopeKey(ev, freeList));
    var other = null;
    var rest = [];
    qs.forEach(function (q) {
      if (!q) return;
      if (q.id === 'other') other = q;
      else rest.push(q);
    });
    var byId = {};
    rest.forEach(function (q) { byId[String(q.id)] = q; });
    var ordered = [];
    (usage.recent || []).slice(0, 3).forEach(function (id) {
      if (byId[String(id)]) {
        ordered.push(byId[String(id)]);
        delete byId[String(id)];
      }
    });
    var leftovers = Object.keys(byId).map(function (id) { return byId[id]; });
    leftovers.sort(function (a, b) {
      var ca = Number(usage.counts[a.id]) || 0;
      var cb = Number(usage.counts[b.id]) || 0;
      if (cb !== ca) return cb - ca;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    ordered = ordered.concat(leftovers);
    if (!other) other = { id: 'other', name: 'Other', color: '#8a9488' };
    return ordered.concat([other]);
  }

  /** Raw store — no normalize (safe for surgical saves) */
  function loadFreeListsStoreRaw() {
    var s = loadJson(LOCAL_FREE_LISTS_KEY, null) || {};
    if (!Array.isArray(s.named)) s.named = [];
    if (!s.personal) s.personal = { todo: [], buy: [], bring: [], named: [] };
    if (!s.shared) s.shared = { todo: [], buy: [], bring: [], named: [] };
    return s;
  }

  /**
   * Rebuild a named list into a always-valid structure. NEVER throws.
   * Used for load, save, and render so a half-corrupt list can always open.
   */
  function sanitizeNamedList(n) {
    if (!n || typeof n !== 'object') {
      n = { id: uid(), name: 'List', owner_id: myId() || 'local' };
    }
    try {
      if (!n.id) n.id = uid();
      n.name = n.name != null ? String(n.name) : 'Untitled list';
      n.owner_id = n.owner_id != null ? n.owner_id : (myId() || 'local');
      n.creators = Array.isArray(n.creators) ? n.creators.filter(Boolean) : [];
      n.members = Array.isArray(n.members)
        ? n.members.filter(function (m) { return m && typeof m === 'object'; })
        : [];
      if (n.eventId == null && n.event_id != null) n.eventId = n.event_id;
      if (n.eventId === '' || n.eventId === undefined) n.eventId = null;
      if (n.eventId != null) n.eventId = String(n.eventId);

      // Collect items from any legacy shape
      var bucketSrc = (n.buckets && typeof n.buckets === 'object') ? n.buckets : {};
      var legacyItems = Array.isArray(n.items) ? n.items.filter(Boolean) : [];

      var colsIn = Array.isArray(n.columns) ? n.columns : [];
      var byId = {};
      colsIn.forEach(function (c) {
        if (!c || typeof c !== 'object') return;
        var id = c.id != null ? String(c.id) : ('col_' + uid());
        var fromCol = Array.isArray(c.items)
          ? c.items.filter(function (it) { return it && typeof it === 'object'; })
          : [];
        var fromBucket = Array.isArray(bucketSrc[id])
          ? bucketSrc[id].filter(function (it) { return it && typeof it === 'object'; })
          : [];
        // Merge column + bucket by id so a partial column never wipes the rest (#63)
        var itemMap = {};
        var itemOrder = [];
        function takeItem(it) {
          if (!it || typeof it !== 'object') return;
          if (!it.id) it.id = uid();
          var iid = String(it.id);
          if (!itemMap[iid]) {
            itemMap[iid] = it;
            itemOrder.push(iid);
          } else {
            // Keep richer / later fields without dropping the row
            try { itemMap[iid] = Object.assign({}, itemMap[iid], it); } catch (eM) { itemMap[iid] = it; }
          }
        }
        fromCol.forEach(takeItem);
        fromBucket.forEach(takeItem);
        var items = itemOrder.map(function (iid) { return itemMap[iid]; });
        // Sanitize each item lightly (preserve chore_* calendar fields)
        items = items.map(function (it) {
          try {
            if (!it.id) it.id = uid();
            if (it.title == null) it.title = 'Item';
            if (!it.claims || typeof it.claims !== 'object' || Array.isArray(it.claims)) it.claims = {};
            if (!Array.isArray(it.notesList)) it.notesList = [];
            it.notesList = it.notesList.filter(function (x) { return x && typeof x === 'object'; });
            it.qty = Math.max(1, parseInt(it.qty, 10) || 1);
            // Keep chore schedule + show-on-calendar flag (default show when scheduled)
            if (it.chore_at != null && it.chore_at !== '') {
              it.chore_at = String(it.chore_at);
              if (it.chore_end_at != null && it.chore_end_at !== '') it.chore_end_at = String(it.chore_end_at);
              else it.chore_end_at = it.chore_end_at || null;
              if (it.chore_color) it.chore_color = String(it.chore_color);
              // undefined → true (legacy chores show on calendar); explicit false stays off
              if (it.chore_show_on_calendar === false || it.chore_show_on_calendar === 0 || it.chore_show_on_calendar === 'false') {
                it.chore_show_on_calendar = false;
              } else if (it.chore_show_on_calendar != null) {
                it.chore_show_on_calendar = true;
              }
            }
            return it;
          } catch (eI) {
            return { id: uid(), title: 'Item', qty: 1, claims: {}, notesList: [], qualifier: 'other' };
          }
        });
        var colors = (c.colors && typeof c.colors === 'object') ? c.colors : {};
        byId[id] = {
          id: id,
          name: c.name ? String(c.name) : listKindLabel(id),
          items: items,
          minimized: !!c.minimized,
          colors: {
            font: colors.font || DEFAULT_COL_COLORS.font,
            tab: colors.tab || DEFAULT_COL_COLORS.tab,
            bg: colors.bg || DEFAULT_COL_COLORS.bg
          },
          invite_code: c.invite_code != null ? c.invite_code : null
        };
      });

      // Ensure classic three columns always exist
      ['todo', 'buy', 'bring'].forEach(function (k) {
        if (!byId[k]) {
          var fromBucket = Array.isArray(bucketSrc[k])
            ? bucketSrc[k].filter(function (it) { return it && typeof it === 'object'; })
            : [];
          // Put legacy root items into todo once
          if (k === 'todo' && legacyItems.length && !fromBucket.length) {
            fromBucket = legacyItems.filter(function (it) { return it && typeof it === 'object'; });
          }
          byId[k] = defaultColumn(k, listKindLabel(k));
          byId[k].items = fromBucket;
        }
      });
      // Event / shared packing lists: private “My checklist” (my claims only — not for others)
      var wantPersonal = !!n.eventId || (Array.isArray(n.members) && n.members.length > 1);
      if (wantPersonal) {
        if (!byId.personal) {
          byId.personal = defaultColumn('personal', 'My checklist');
          byId.personal.colors = { font: '#f0f4ee', tab: '#2a3a4a', bg: '#0a1014' };
        } else {
          byId.personal.name = 'My checklist';
          if (!Array.isArray(byId.personal.items)) byId.personal.items = [];
        }
      } else if (byId.personal) {
        delete byId.personal;
      }

      // Preserve custom columns + classic order first; My checklist always last when present
      var order = [];
      ['todo', 'buy', 'bring'].forEach(function (k) { order.push(k); });
      Object.keys(byId).forEach(function (k) {
        if (k === 'personal') return;
        if (order.indexOf(k) < 0) order.push(k);
      });
      if (Array.isArray(n.columnOrder)) {
        n.columnOrder.forEach(function (k) {
          k = String(k);
          if (k === 'personal') return;
          if (byId[k] && order.indexOf(k) < 0) order.push(k);
        });
      }
      if (wantPersonal && byId.personal) order.push('personal');

      n.columns = order.map(function (k) { return byId[k]; }).filter(Boolean);
      n.buckets = {};
      n.columnOrder = n.columns.map(function (c) {
        n.buckets[c.id] = c.items;
        return c.id;
      });
      var activeK = 'todo';
      try {
        activeK = state.listTab || n.kind || 'todo';
      } catch (eA) { activeK = 'todo'; }
      if (!n.buckets[activeK]) activeK = (n.columns[0] && n.columns[0].id) || 'todo';
      n.items = n.buckets[activeK] || [];
      n.kind = activeK;

      var oid = String(n.owner_id);
      if (!n.members.some(function (m) { return m && String(m.user_id || m.id) === oid; })) {
        var dn = 'Owner';
        try {
          if (String(n.owner_id) === String(myId())) dn = myName() || 'You';
        } catch (eN) {}
        n.members.unshift({ user_id: n.owner_id, display_name: dn, role: 'owner' });
      }
    } catch (eSan) {
      console.warn('sanitizeNamedList hard fallback', eSan);
      n.id = n.id || uid();
      n.name = n.name || 'List';
      n.owner_id = n.owner_id || myId() || 'local';
      n.members = [{ user_id: n.owner_id, display_name: 'Owner', role: 'owner' }];
      n.creators = [];
      n.columns = ['todo', 'buy', 'bring'].map(function (k) { return defaultColumn(k, listKindLabel(k)); });
      n.buckets = { todo: [], buy: [], bring: [] };
      n.columnOrder = ['todo', 'buy', 'bring'];
      n.items = [];
      n.kind = 'todo';
      n.eventId = n.eventId || null;
    }
    return n;
  }

  /** My lists — unified store (migrates old personal/shared split) */
  function loadFreeListsStore() {
    var s = loadFreeListsStoreRaw();
    // Migrate legacy personal/shared buckets once
    if (!s._migratedV11) {
      var seen = {};
      s.named.forEach(function (n) { if (n && n.id) seen[String(n.id)] = true; });
      function absorb(arr) {
        (arr || []).forEach(function (n) {
          if (!n || !n.id || seen[String(n.id)]) return;
          seen[String(n.id)] = true;
          s.named.push(sanitizeNamedList(n));
        });
      }
      if (s.personal) absorb(s.personal.named);
      if (s.shared) absorb(s.shared.named);
      ['personal', 'shared'].forEach(function (sc) {
        if (!s[sc]) return;
        ['todo', 'buy', 'bring'].forEach(function (kind) {
          var items = s[sc][kind];
          if (Array.isArray(items) && items.length) {
            var id = 'legacy_' + sc + '_' + kind;
            if (seen[id]) return;
            seen[id] = true;
            s.named.push(sanitizeNamedList({
              id: id,
              name: (sc === 'personal' ? 'Personal · ' : 'Shared · ') + listKindLabel(kind),
              kind: kind,
              items: items,
              owner_id: myId() || 'local',
              created_at: new Date().toISOString()
            }));
          }
        });
      });
      s._migratedV11 = true;
      try { saveJson(LOCAL_FREE_LISTS_KEY, s); } catch (eM) {}
    }
    // Always heal every list so open never sticks on "Could not render"
    var tombs = loadTombstones();
    var deadLists = tombs.lists || {};
    var deadEventLists = tombs.eventLists || {};
    s.named = (s.named || []).map(function (n) {
      return sanitizeNamedList(n);
    }).filter(function (n) {
      if (!n || !n.id) return false;
      if (deadLists[String(n.id)]) return false;
      // User deleted this event's packing pack — drop shared packs only
      // (never drop Personal {Event} claim lists)
      if (n.eventId && deadEventLists[String(n.eventId)] && !n.isPersonalEventList && !n.personalForEventId) {
        return false;
      }
      return true;
    });
    return s;
  }
  function defaultColumn(id, name) {
    return {
      id: id || ('col_' + uid()),
      name: name || 'New list',
      items: [],
      minimized: false,
      colors: {
        font: DEFAULT_COL_COLORS.font,
        tab: DEFAULT_COL_COLORS.tab,
        bg: DEFAULT_COL_COLORS.bg
      },
      invite_code: null
    };
  }
  function listKindLabel(k) {
    if (k === 'buy') return 'To buy';
    if (k === 'bring') return 'To bring';
    if (k === 'todo') return 'To do';
    if (k === 'personal') return 'My checklist';
    return 'New list';
  }

  /** Whether $ / shared-expense UI is enabled for this list or event.
   *  Default OFF unless creator explicitly enables showExpense (#59). */
  function showExpenseEnabled(list, ev) {
    if (list && list.showExpense === true) return true;
    if (list && list.showExpense === false) return false;
    if (ev && ev.state && ev.state.showExpense === true) return true;
    if (ev && ev.state && ev.state.showExpense === false) return false;
    // Default off — creator must turn $ on
    return false;
  }

  function choreDateVal(item) {
    if (!item || !item.chore_at) return '';
    try {
      var d = new Date(item.chore_at);
      if (isNaN(d.getTime())) return '';
      return localYmd(d);
    } catch (e) { return ''; }
  }
  function choreTimeVal(item) {
    if (!item || !item.chore_at) return '';
    try {
      var d = new Date(item.chore_at);
      if (isNaN(d.getTime())) return '';
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    } catch (e) { return ''; }
  }
  function choreEndTimeVal(item) {
    if (!item || !item.chore_end_at) return '';
    try {
      var d = new Date(item.chore_end_at);
      if (isNaN(d.getTime())) return '';
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    } catch (e) { return ''; }
  }
  function combineChoreDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    var t = timeStr || '09:00';
    var p = String(dateStr).split('-');
    var tp = String(t).split(':');
    if (p.length < 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]),
      Number(tp[0]) || 0, Number(tp[1]) || 0, 0, 0);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  /* ========== Chores = calendar entries (same idea as events) ========== */
  function normalizeChore(ch) {
    if (!ch || typeof ch !== 'object') return null;
    if (!ch.id) ch.id = uid();
    ch.name = ch.name != null ? String(ch.name) : (ch.title != null ? String(ch.title) : 'Chore');
    // Accept legacy field names
    if (!ch.start_at && ch.chore_at) ch.start_at = ch.chore_at;
    if (!ch.end_at && ch.chore_end_at) ch.end_at = ch.chore_end_at;
    if (!ch.color && ch.chore_color) ch.color = ch.chore_color;
    if (ch.show_on_calendar == null && ch.chore_show_on_calendar != null) {
      ch.show_on_calendar = ch.chore_show_on_calendar !== false;
    }
    if (ch.show_on_calendar == null) ch.show_on_calendar = true;
    if (ch.show_on_calendar === false || ch.show_on_calendar === 0 || ch.show_on_calendar === 'false') {
      ch.show_on_calendar = false;
    } else {
      ch.show_on_calendar = true;
    }
    ch.color = ch.color || DEFAULT_CHORE_COLOR;
    ch.done = !!ch.done;
    if (!ch.start_at) return null;
    return ch;
  }
  function loadChores() {
    var arr = loadJson(LOCAL_CHORES_KEY, null);
    if (!Array.isArray(arr)) arr = [];
    // One-time migrate legacy standalone store
    try {
      if (!arr.length) {
        var legacy = loadJson(LOCAL_STANDALONE_CHORES_KEY, null);
        if (Array.isArray(legacy) && legacy.length) {
          arr = legacy.map(function (c) {
            return normalizeChore({
              id: c.id,
              name: c.title || c.name || 'Chore',
              start_at: c.chore_at || c.start_at,
              end_at: c.chore_end_at || c.end_at || null,
              color: c.chore_color || c.color || DEFAULT_CHORE_COLOR,
              show_on_calendar: c.chore_show_on_calendar !== false && c.show_on_calendar !== false,
              created_at: c.created_at || c.updated_at || new Date().toISOString(),
              updated_at: c.updated_at || new Date().toISOString()
            });
          }).filter(Boolean);
          if (arr.length) saveJson(LOCAL_CHORES_KEY, arr);
        }
      }
    } catch (eMig) {}
    return arr.map(normalizeChore).filter(Boolean);
  }
  function saveChores(arr) {
    try {
      var clean = (Array.isArray(arr) ? arr : []).map(normalizeChore).filter(Boolean).slice(0, 500);
      var ok = saveJson(LOCAL_CHORES_KEY, clean);
      if (!ok) {
        console.warn('[PlanSlayer] saveChores localStorage failed');
        return false;
      }
      // Verify
      var check = loadJson(LOCAL_CHORES_KEY, null);
      if (!Array.isArray(check)) return false;
      return true;
    } catch (e) {
      console.warn('[PlanSlayer] saveChores', e);
      return false;
    }
  }
  function findChoreById(id) {
    if (id == null || id === '') return null;
    return loadChores().find(function (c) { return String(c.id) === String(id); }) || null;
  }
  function upsertChore(ch) {
    ch = normalizeChore(ch);
    if (!ch || !ch.start_at) return false;
    ch.updated_at = new Date().toISOString();
    if (!ch.created_at) ch.created_at = ch.updated_at;
    var arr = loadChores();
    var idx = arr.findIndex(function (c) { return String(c.id) === String(ch.id); });
    if (idx >= 0) arr[idx] = ch;
    else arr.push(ch);
    if (!saveChores(arr)) return false;
    // Confirm row is readable
    return !!findChoreById(ch.id);
  }
  function deleteChore(id) {
    if (!id) return false;
    var arr = loadChores().filter(function (c) { return String(c.id) !== String(id); });
    return saveChores(arr);
  }
  function markChoreDone(id, done) {
    var ch = findChoreById(id);
    if (!ch) return false;
    ch.done = done !== false;
    if (ch.done) ch.show_on_calendar = false;
    return upsertChore(ch);
  }
  function choreShowsOnCalendar(ch) {
    if (!ch || !(ch.start_at || ch.chore_at)) return false;
    if (ch.done) return false;
    var v = ch.show_on_calendar != null ? ch.show_on_calendar : ch.chore_show_on_calendar;
    if (v === false || v === 0 || v === 'false') return false;
    return true;
  }
  function choreYmd(ch) {
    if (!ch) return null;
    return ymdFromIso(ch.start_at || ch.chore_at) || null;
  }
  /**
   * All chores for calendar dots + Chores list (event-style).
   * @param {{ includeHidden?: boolean }} opts
   */
  function collectAllChores(opts) {
    opts = opts || {};
    var includeHidden = !!opts.includeHidden; // hidden-from-calendar still listed when true
    var includeDone = !!opts.includeDone;
    var out = [];
    try {
      loadChores().forEach(function (ch) {
        if (!ch || !ch.start_at) return;
        if (ch.done && !includeDone) return;
        // Calendar default: only show-on-calendar chores. List uses includeHidden:true for all incomplete.
        if (!includeHidden && !choreShowsOnCalendar(ch)) return;
        out.push({
          id: ch.id,
          choreId: ch.id,
          title: ch.name || 'Chore',
          name: ch.name || 'Chore',
          chore_at: ch.start_at,
          start_at: ch.start_at,
          chore_end_at: ch.end_at || null,
          end_at: ch.end_at || null,
          color: ch.color || DEFAULT_CHORE_COLOR,
          showOnCalendar: choreShowsOnCalendar(ch),
          done: !!ch.done,
          source: 'chore',
          item: ch
        });
      });
    } catch (e) {
      console.warn('[PlanSlayer] collectAllChores', e);
    }
    out.sort(function (a, b) {
      return new Date(a.chore_at || 0).getTime() - new Date(b.chore_at || 0).getTime();
    });
    return out;
  }
  function focusCalendarOnChore(choreAtIso, opts) {
    opts = opts || {};
    try {
      var ymd = opts.ymd || ymdFromIso(choreAtIso);
      if (ymd) {
        var p = String(ymd).split('-');
        state.sideCal.y = Number(p[0]);
        state.sideCal.m = Number(p[1]) - 1;
        state.sideCal.selectedDay = null;
      }
      if (opts.switchToChores !== false) state.calListMode = 'chores';
    } catch (eF) {}
  }
  /**
   * Save chore from the schedule modal — same reliability path as events (localStorage only).
   * @returns {boolean}
   */
  function saveChoreFromModal(clear) {
    readChoreWhenFormIntoState();
    var c = state.choreWhen || {};
    var choreId = c.choreId || c.standaloneId || null;

    if (clear) {
      if (!choreId) return true;
      var okDel = deleteChore(choreId);
      return okDel;
    }
    if (!c.date) {
      appToast('Pick a day first');
      return false;
    }
    var name = autoCap(c.title || '');
    if (!name) name = 'Chore';
    var startAt = combineChoreDateTime(c.date, c.start || null);
    if (!c.start) startAt = combineChoreDateTime(c.date, '12:00');
    if (!startAt) {
      appToast('Invalid date/time');
      return false;
    }
    var endAt = (c.end && c.date) ? combineChoreDateTime(c.date, c.end) : null;
    var showCal = true;
    try {
      if ($('chore-when-show-cal')) showCal = !!$('chore-when-show-cal').checked;
      else if (c.showOnCalendar === false) showCal = false;
    } catch (eSc) {}

    var ch = {
      id: choreId || uid(),
      name: name,
      start_at: startAt,
      end_at: endAt,
      color: c.color || DEFAULT_CHORE_COLOR,
      show_on_calendar: showCal,
      created_at: (findChoreById(choreId) || {}).created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!upsertChore(ch)) {
      console.warn('[PlanSlayer] upsertChore failed', ch);
      return false;
    }
    c.choreId = ch.id;
    c.standaloneId = ch.id;
    focusCalendarOnChore(startAt, { ymd: c.date });
    return true;
  }
  /** Find a list item by id across every named list (chore save fallback) */
  function findItemAcrossNamedLists(itemId) {
    if (itemId == null || itemId === '') return null;
    var sid = String(itemId);
    try {
      var store = loadFreeListsStoreRaw();
      var found = null;
      (store.named || []).some(function (list) {
        if (!list) return false;
        try { sanitizeNamedList(list); } catch (e) {}
        // columns
        var hitCol = (list.columns || []).some(function (col) {
          if (!col) return false;
          var it = (col.items || []).find(function (x) { return x && String(x.id) === sid; });
          if (it) {
            found = { item: it, list: list, colId: col.id, scope: 'free-list', bucket: col.items };
            return true;
          }
          return false;
        });
        if (hitCol) return true;
        // buckets fallback
        if (list.buckets && typeof list.buckets === 'object') {
          return Object.keys(list.buckets).some(function (bk) {
            var arr = list.buckets[bk] || [];
            var it2 = arr.find(function (x) { return x && String(x.id) === sid; });
            if (it2) {
              found = { item: it2, list: list, colId: bk, scope: 'free-list', bucket: arr };
              return true;
            }
            return false;
          });
        }
        return false;
      });
      return found;
    } catch (eF) {
      return null;
    }
  }
  function choreColor(ch) {
    if (ch && ch.color) return ch.color;
    if (ch && ch.item && ch.item.chore_color) return ch.item.chore_color;
    return DEFAULT_CHORE_COLOR;
  }
  function choreColorSwatchesHtml(selected, dataAttr) {
    dataAttr = dataAttr || 'data-chore-color';
    var sel = selected || DEFAULT_CHORE_COLOR;
    return CHORE_COLOR_PRESETS.map(function (c) {
      var on = String(c).toLowerCase() === String(sel).toLowerCase();
      return '<button type="button" class="chore-color-swatch' + (on ? ' is-on' : '') +
        '" ' + dataAttr + '="' + esc(c) + '" style="background:' + esc(c) + '" title="' + esc(c) +
        '" aria-label="Chore color ' + esc(c) + '"></button>';
    }).join('');
  }

  function privateChecklistKey(listId) {
    return String(listId || 'none') + ':' + String(myId() || 'local');
  }
  function loadPrivateChecklistBag() {
    var bag = loadJson(LOCAL_PRIVATE_CHECKLIST_KEY, null);
    return bag && typeof bag === 'object' ? bag : {};
  }
  function getPrivateChecklist(listId) {
    var bag = loadPrivateChecklistBag();
    var arr = bag[privateChecklistKey(listId)];
    return Array.isArray(arr) ? arr : [];
  }
  function savePrivateChecklist(listId, items) {
    var bag = loadPrivateChecklistBag();
    bag[privateChecklistKey(listId)] = Array.isArray(items) ? items.slice(0, 500) : [];
    saveJson(LOCAL_PRIVATE_CHECKLIST_KEY, bag);
  }
  /** Event packing lists get a private “My checklist” (personal column) */
  function listWantsPersonalChecklist(list) {
    if (!list) return false;
    if (list.eventId) return true;
    if (Array.isArray(list.members) && list.members.length > 1) return true;
    return false;
  }
  /** Ensure personal / My checklist column exists on a list */
  function ensurePersonalColumn(list) {
    if (!list) return null;
    sanitizeNamedList(list);
    // Force personal column for event / shared lists even if sanitize skipped it
    if (!listWantsPersonalChecklist(list)) return null;
    var col = (list.columns || []).find(function (c) { return c && String(c.id) === 'personal'; });
    if (!col) {
      col = defaultColumn('personal', 'My checklist');
      col.colors = { font: '#f0f4ee', tab: '#2a3a4a', bg: '#0a1014' };
      list.columns = (list.columns || []).filter(function (c) { return c && String(c.id) !== 'personal'; });
      list.columns.push(col);
      list.columnOrder = (list.columns || []).map(function (c) { return c.id; });
      if (!list.buckets) list.buckets = {};
      list.buckets.personal = col.items;
    } else {
      col.name = 'My checklist';
    }
    return col;
  }
  /**
   * After cloud pull (or open on a second device), rebuild My checklist + Personal {Event}
   * from claims on the shared pack so phone matches desktop without device-only storage.
   */
  function rebuildMyChecklistFromClaims(list) {
    if (!list || isPersonalEventShadowList(list)) return false;
    if (!listWantsPersonalChecklist(list) && !list.eventId) return false;
    var me = String(myId() || 'local');
    var any = false;
    try { ensurePersonalColumn(list); } catch (eE) {}
    (list.columns || []).forEach(function (c) {
      if (!c || String(c.id) === 'personal') return;
      (c.items || []).forEach(function (it) {
        if (!it || !it.id) return;
        var q = 0;
        try { q = Number((it.claims || {})[me] || 0); } catch (eQ) { q = 0; }
        if (q > 0) {
          any = true;
          try { syncClaimToPrivateChecklist(list, it, q, c.id); } catch (e1) {}
          try { syncClaimToPersonalEventList(list, it, q, c.id); } catch (e2) {}
        }
      });
    });
    if (any) {
      try { saveNamedList(list); } catch (eS) {}
    } else if (list.eventId || listWantsPersonalChecklist(list)) {
      // Still ensure empty Personal {Event} shell exists so parity with desktop structure
      try {
        var evHint = resolveEventForList(list) || activeEvent();
        if (evHint) ensurePersonalEventList(evHint, list);
        else ensurePersonalEventList(null, list);
      } catch (eP) {}
    }
    return any;
  }
  /** Rebuild personal checklists for every packing pack (login / cloud load). */
  function rebuildAllMyChecklistsFromClaims() {
    try {
      (allMyLists() || []).forEach(function (n) {
        try {
          if (!n || isPersonalEventShadowList(n)) return;
          if (n.eventId || listWantsPersonalChecklist(n)) rebuildMyChecklistFromClaims(n);
        } catch (eOne) {}
      });
    } catch (eAll) {
      console.warn('rebuildAllMyChecklistsFromClaims', eAll);
    }
  }
  /**
   * When I Got it! on To do / To buy / To bring, mirror into my private checklist
   * (device-local) AND the list’s personal column so it always shows under My checklist.
   */
  function syncClaimToPrivateChecklist(list, sourceItem, claimQty, sourceColId) {
    if (!list || !list.id || !sourceItem) return;
    // Event packing / shared lists only
    if (!listWantsPersonalChecklist(list)) return;
    var me = String(myId() || 'local');
    claimQty = Math.max(0, Number(claimQty) || 0);
    var srcId = String(sourceItem.id);

    // 1) Device-local private store
    var items = getPrivateChecklist(list.id);
    var idx = items.findIndex(function (it) {
      return it && String(it.source_item_id || it.id) === srcId;
    });
    if (claimQty <= 0) {
      if (idx >= 0) {
        items.splice(idx, 1);
        savePrivateChecklist(list.id, items);
      }
    } else {
      var prevPriv = idx >= 0 ? items[idx] : null;
      // #117: personal packing row qty = claimed amount; starts unclaimed so home “Got it!” completes fully
      var copy = Object.assign({}, cloneItemOptionFields(sourceItem), {
        id: prevPriv && prevPriv.id ? prevPriv.id : uid(),
        source_item_id: srcId,
        source_col: sourceColId || (prevPriv && prevPriv.source_col) || null,
        private_to: me,
        qty: Math.max(1, claimQty),
        claims: (prevPriv && prevPriv.claims && typeof prevPriv.claims === 'object')
          ? Object.assign({}, prevPriv.claims)
          : {},
        claimed_qty: claimQty,
        from_claim: true,
        created_by: (prevPriv && prevPriv.created_by) || me,
        created_at: (prevPriv && prevPriv.created_at) || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      // Do not auto-fill my claim — packing checklist is “not grabbed” until Got it again
      if (!prevPriv || !prevPriv.claims || !prevPriv.claims[me]) {
        copy.claims = {};
      }
      if (idx >= 0) items[idx] = Object.assign({}, prevPriv, copy, {
        qty: Math.max(1, claimQty),
        claims: (prevPriv.claims && Object.keys(prevPriv.claims).length) ? prevPriv.claims : {}
      });
      else items.push(copy);
      savePrivateChecklist(list.id, items);
    }

    // 2) Live personal column on the list (so My checklist always has the row)
    try {
      var pcol = ensurePersonalColumn(list);
      if (pcol) {
        if (!Array.isArray(pcol.items)) pcol.items = [];
        var pIdx = pcol.items.findIndex(function (it) {
          return it && (String(it.source_item_id) === srcId || String(it.id) === srcId);
        });
        if (claimQty <= 0) {
          if (pIdx >= 0) pcol.items.splice(pIdx, 1);
        } else {
          var row = pIdx >= 0 ? pcol.items[pIdx] : null;
          var hadHomeClaim = !!(row && row.claims && row.claims[me]);
          if (!row) {
            row = Object.assign({}, cloneItemOptionFields(sourceItem), {
              id: uid(),
              source_item_id: srcId,
              source_col: sourceColId || null,
              private_to: me,
              qty: Math.max(1, claimQty),
              claims: {},
              from_claim: true,
              created_by: me
            });
            pcol.items.push(row);
          } else {
            Object.assign(row, cloneItemOptionFields(sourceItem), {
              id: row.id,
              source_item_id: srcId,
              source_col: sourceColId || row.source_col || null,
              private_to: me,
              from_claim: true
            });
            // Keep home packing progress if already Got-it on checklist; else unclaimed
            if (!hadHomeClaim) row.claims = {};
            else if (!row.claims || typeof row.claims !== 'object') row.claims = {};
          }
          row.qty = Math.max(1, claimQty);
          row.claimed_qty = claimQty;
        }
        if (!list.buckets) list.buckets = {};
        list.buckets.personal = pcol.items;
      }
    } catch (eCol) {
      console.warn('syncClaim personal column', eCol);
    }
  }

  function updateChoreWhenSummary() {
    var el = $('chore-when-summary');
    if (!el) return;
    var c = state.choreWhen || {};
    var startVal = ($('chore-when-start') && $('chore-when-start').value) || c.start || '';
    var endVal = ($('chore-when-end') && $('chore-when-end').value) || c.end || '';
    if (!c.date) {
      el.textContent = 'Select a day to enable Save';
      return;
    }
    var bits = [c.date];
    if (startVal) bits.push(startVal);
    if (endVal) bits.push('– ' + endVal);
    el.textContent = 'Selected: ' + bits.join(' · ');
  }
  function syncChoreWhenSaveEnabled() {
    var saveBtn = $('chore-when-save');
    if (!saveBtn) return;
    var hasDay = !!(state.choreWhen && state.choreWhen.date);
    saveBtn.disabled = !hasDay;
    saveBtn.title = hasDay ? 'Save chore schedule' : 'Pick a day first';
    updateChoreWhenSummary();
  }
  function syncChoreWhenClearVisible() {
    var clearBtn = $('chore-when-clear');
    if (!clearBtn) return;
    // Clear only when editing an existing scheduled chore (e.g. from Chores list)
    clearBtn.style.display = (state.choreWhen && state.choreWhen.hasExistingSchedule) ? '' : 'none';
  }
  function renderChoreWhenGrid() {
    var c = state.choreWhen;
    if (!c.y) {
      var n = new Date();
      c.y = n.getFullYear();
      c.m = n.getMonth();
    }
    if ($('chore-when-label')) {
      $('chore-when-label').textContent = new Date(c.y, c.m, 1).toLocaleString(undefined, {
        month: 'long', year: 'numeric'
      });
    }
    var grid = $('chore-when-grid');
    if (!grid) return;
    var first = new Date(c.y, c.m, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(c.y, c.m + 1, 0).getDate();
    var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) {
      return '<div class="dow">' + d + '</div>';
    }).join('');
    var today = new Date();
    for (var i = 0; i < startPad; i++) html += '<button type="button" class="cal-day-btn" disabled></button>';
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = c.y + '-' + pad2(c.m + 1) + '-' + pad2(d);
      var isSel = c.date === iso;
      var isToday = today.getFullYear() === c.y && today.getMonth() === c.m && today.getDate() === d;
      html += '<button type="button" class="cal-day-btn' +
        (isSel ? ' is-selected' : '') +
        (isToday ? ' is-today' : '') +
        '" data-chore-day="' + iso + '">' + d + '</button>';
    }
    grid.innerHTML = html;
  }
  function syncChoreModalChrome() {
    var c = state.choreWhen || {};
    var titleEl = $('chore-when-title');
    var stepLabel = $('chore-when-step-label');
    var titleField = $('chore-when-title-input');
    var titleFieldWrap = $('chore-when-title-field');
    var linkWrap = $('chore-when-link-wrap');
    if (titleEl) titleEl.textContent = c.hasExistingSchedule ? 'Edit chore' : 'Schedule chore';
    if (stepLabel) stepLabel.textContent = 'Name · day · start/end · Save (like an event)';
    if (titleField) {
      titleField.value = c.title || '';
      titleField.placeholder = 'Chore name';
    }
    if (titleFieldWrap) titleFieldWrap.style.display = '';
    if (linkWrap) linkWrap.style.display = 'none';
    syncChoreWhenClearVisible();
    syncChoreWhenSaveEnabled();
  }
  /**
   * Open chore builder (event-style calendar entry).
   * @param {object|null} item — optional list item to seed name only
   * @param {string|null} kind
   * @param {string|null} scope
   * @param {{ choreId?: string, standaloneId?: string, title?: string, fromChoresList?: boolean }} extra
   */
  function openChoreWhenPicker(item, kind, scope, extra) {
    extra = extra || {};
    var seedDate = null;
    var seedStart = '';
    var seedEnd = '';
    var seedColor = DEFAULT_CHORE_COLOR;
    var seedShow = true;
    var seedTitle = '';
    var choreId = extra.choreId || extra.standaloneId || null;

    if (choreId) {
      var existing = findChoreById(choreId);
      if (existing) {
        seedDate = ymdFromIso(existing.start_at) || null;
        try {
          var d0 = new Date(existing.start_at);
          if (!isNaN(d0.getTime())) seedStart = pad2(d0.getHours()) + ':' + pad2(d0.getMinutes());
        } catch (e0) {}
        if (existing.end_at) {
          try {
            var d1 = new Date(existing.end_at);
            if (!isNaN(d1.getTime())) seedEnd = pad2(d1.getHours()) + ':' + pad2(d1.getMinutes());
          } catch (e1) {}
        }
        seedColor = existing.color || DEFAULT_CHORE_COLOR;
        seedShow = existing.show_on_calendar !== false;
        seedTitle = existing.name || '';
      }
    } else if (item) {
      // Seed name from list item only — still saves as a calendar chore (like an event)
      seedTitle = item.title || '';
      seedDate = choreDateVal(item) || null;
      seedStart = choreTimeVal(item) || '';
      seedEnd = choreEndTimeVal(item) || '';
      seedColor = item.chore_color || DEFAULT_CHORE_COLOR;
      seedShow = item.chore_show_on_calendar === false ? false : true;
    }
    if (extra.title) seedTitle = extra.title;
    if (!seedDate && state.sideCal && state.sideCal.selectedDay) {
      seedDate = state.sideCal.selectedDay;
    }
    var hasExisting = !!choreId || !!extra.fromChoresList;
    state.choreWhen = {
      itemId: null,
      kind: null,
      scope: null,
      listId: null,
      colId: null,
      choreId: choreId,
      standaloneId: choreId,
      title: seedTitle,
      linkItemKey: '',
      step: 'all',
      y: 0,
      m: 0,
      date: seedDate,
      start: seedStart,
      end: seedEnd,
      color: seedColor,
      showOnCalendar: seedShow,
      mode: 'standalone',
      hasExistingSchedule: hasExisting,
      fromChoresList: !!extra.fromChoresList
    };
    if (state.choreWhen.date) {
      try {
        var p = state.choreWhen.date.split('-');
        state.choreWhen.y = Number(p[0]);
        state.choreWhen.m = Number(p[1]) - 1;
      } catch (e) {}
    } else {
      var n = new Date();
      state.choreWhen.y = n.getFullYear();
      state.choreWhen.m = n.getMonth();
    }
    if ($('chore-when-start')) $('chore-when-start').value = state.choreWhen.start || '';
    if ($('chore-when-end')) $('chore-when-end').value = state.choreWhen.end || '';
    if ($('chore-when-show-cal')) $('chore-when-show-cal').checked = state.choreWhen.showOnCalendar !== false;
    renderChoreColorPickers(state.choreWhen.color);
    syncChoreModalChrome();
    renderChoreWhenGrid();
    if ($('chore-when-modal')) {
      $('chore-when-modal').classList.add('is-open');
      $('chore-when-modal').setAttribute('aria-hidden', 'false');
    }
  }
  function openScheduleChoreBuilder(opts) {
    opts = opts || {};
    openChoreWhenPicker(null, null, null, {
      title: opts.title || '',
      choreId: opts.choreId || opts.standaloneId || null,
      fromChoresList: !!opts.fromChoresList
    });
  }
  function renderChoreColorPickers(selected) {
    var box = $('chore-when-colors');
    if (box) box.innerHTML = choreColorSwatchesHtml(selected || DEFAULT_CHORE_COLOR, 'data-chore-when-color');
  }
  function closeChoreWhenPicker() {
    if ($('chore-when-modal')) {
      $('chore-when-modal').classList.remove('is-open');
      $('chore-when-modal').setAttribute('aria-hidden', 'true');
    }
    state.choreWhen = {
      itemId: null, kind: null, scope: null, listId: null, colId: null,
      choreId: null, standaloneId: null, title: '', linkItemKey: '',
      step: 'all', y: 0, m: 0, date: null, start: '', end: '',
      color: DEFAULT_CHORE_COLOR, showOnCalendar: true, mode: 'standalone',
      hasExistingSchedule: false, fromChoresList: false
    };
  }
  function readChoreWhenFormIntoState() {
    var c = state.choreWhen;
    if (!c) return;
    if ($('chore-when-title-input')) c.title = ($('chore-when-title-input').value || '').trim();
    if ($('chore-when-start')) c.start = $('chore-when-start').value || '';
    if ($('chore-when-end')) c.end = $('chore-when-end').value || '';
    if ($('chore-when-show-cal')) c.showOnCalendar = !!$('chore-when-show-cal').checked;
  }
  /** @deprecated — chores are event-like; use saveChoreFromModal */
  function applyChoreWhenToItem(clear) {
    return saveChoreFromModal(!!clear);
  }

  /** True when left chrome is fully minimized — only then show Back on the right */
  function leftSideFullyMinimized() {
    try {
      if (isMobileLayout()) return true;
    } catch (e) {}
    // Calendar collapsed + map tucked away as a button
    return !!state.calCollapsed && state.mapMode === 'button';
  }
  function updateBackButtonsVisibility() {
    // #71 — Back under list/event title removed (extra vertical space for triad)
    if ($('btn-lists-back')) $('btn-lists-back').style.display = 'none';
    if ($('ev-back')) $('ev-back').style.display = 'none';
  }

  /** Full option fields so My checklist rows match To do / To buy / To bring */
  function cloneItemOptionFields(src) {
    src = src || {};
    var notesList = [];
    try {
      notesList = Array.isArray(src.notesList) ? src.notesList.map(function (n) {
        return n && typeof n === 'object' ? Object.assign({}, n) : n;
      }) : [];
    } catch (eN) { notesList = []; }
    return {
      title: src.title || 'Item',
      qty: Math.max(1, Number(src.qty) || 1),
      notes: src.notes || '',
      notesList: notesList,
      priority: src.priority || 0,
      highlight: !!src.highlight,
      highlight_color: src.highlight_color || 'red',
      qualifier: src.qualifier || 'other',
      shared_expense: !!src.shared_expense,
      expense_amount: Number(src.expense_amount) || 0,
      expense_share_with: Array.isArray(src.expense_share_with) ? src.expense_share_with.slice() : [],
      due_mode: src.due_mode || 'anytime_before',
      due_days: Number(src.due_days) || 0,
      creator_only_edit: !!src.creator_only_edit,
      require_all: !!src.require_all,
      chore_at: src.chore_at || null,
      chore_end_at: src.chore_end_at || null,
      chore_show_on_calendar: src.chore_show_on_calendar !== false,
      chore_color: src.chore_color || DEFAULT_CHORE_COLOR,
      delegated_to: src.delegated_to || null,
      shared_from: src.shared_from || null
    };
  }

  function itemIdMatches(it, itemId) {
    if (!it || itemId == null || itemId === '') return false;
    var sid = String(itemId);
    return String(it.id) === sid || String(it.source_item_id || '') === sid;
  }

  /**
   * Enrich a My checklist mirror with private-store + source-item option fields
   * so expand/options UI is identical to other columns.
   */
  function enrichChecklistDisplayItem(list, row) {
    if (!row || !list) return row;
    var out = Object.assign({}, row);
    try {
      if (row.source_item_id) {
        var srcHit = findInNamedListColumn(list, row.source_col || null, row.source_item_id) ||
          findInNamedListColumn(list, null, row.source_item_id);
        if (srcHit && srcHit.item) {
          out = Object.assign({}, cloneItemOptionFields(srcHit.item), out, {
            id: row.id,
            source_item_id: row.source_item_id || srcHit.item.id,
            source_col: row.source_col || srcHit.colId || null,
            from_claim: true,
            claims: row.claims && typeof row.claims === 'object' ? row.claims : (srcHit.item.claims || {})
          });
        }
      }
    } catch (eS) {}
    try {
      var priv = getPrivateChecklist(list.id);
      var p = priv.find(function (it) {
        return itemIdMatches(it, row.id) ||
          (row.source_item_id && String(it.source_item_id || '') === String(row.source_item_id));
      });
      if (p) {
        // Private edits win for fields the user set on the checklist copy
        out = Object.assign({}, out, cloneItemOptionFields(p), {
          id: row.id,
          source_item_id: row.source_item_id || p.source_item_id || null,
          source_col: row.source_col || p.source_col || null,
          from_claim: true,
          private_to: p.private_to || row.private_to,
          claims: (p.claims && typeof p.claims === 'object') ? p.claims
            : (out.claims && typeof out.claims === 'object') ? out.claims : {},
          claimed_qty: p.claimed_qty != null ? p.claimed_qty : out.claimed_qty
        });
      }
    } catch (eP) {}
    if (!out.claims || typeof out.claims !== 'object') out.claims = {};
    return out;
  }

  /**
   * Resolve list item for clicks/saves — includes My checklist private mirrors
   * (which live outside normal column buckets by id).
   */
  function resolveNamedListItemHit(list, kind, itemId) {
    if (!list || itemId == null || itemId === '') return null;
    try { sanitizeNamedList(list); } catch (e) {}

    var hit = findInNamedListColumn(list, kind, itemId);
    if (hit) {
      if (String(hit.colId) === 'personal') hit.isChecklist = true;
      return hit;
    }

    var wantPersonal = !kind || String(kind) === 'personal';
    if (wantPersonal) {
      // Personal column by source_item_id / id
      try {
        var pcol = getListColumn(list, 'personal');
        if (pcol && Array.isArray(pcol.items)) {
          var cIdx = pcol.items.findIndex(function (it) { return itemIdMatches(it, itemId); });
          if (cIdx >= 0) {
            // Keep live object in column; enrich missing option fields in place
            var enriched = enrichChecklistDisplayItem(list, pcol.items[cIdx]);
            Object.keys(enriched).forEach(function (k) {
              if (k === 'id') return;
              pcol.items[cIdx][k] = enriched[k];
            });
            return {
              list: list,
              col: pcol,
              bucket: pcol.items,
              item: pcol.items[cIdx],
              index: cIdx,
              colId: 'personal',
              isChecklist: true
            };
          }
        }
      } catch (eC) {}

      // Device-local private checklist store
      try {
        var priv = getPrivateChecklist(list.id);
        var pIdx = priv.findIndex(function (it) { return itemIdMatches(it, itemId); });
        if (pIdx >= 0) {
          var pItem = priv[pIdx];
          // Prefer mutating personal column mirror when present (same source)
          var pcol2 = getListColumn(list, 'personal') || ensurePersonalColumn(list);
          if (pcol2) {
            if (!Array.isArray(pcol2.items)) pcol2.items = [];
            var cIdx2 = pcol2.items.findIndex(function (it) {
              return itemIdMatches(it, itemId) ||
                (pItem.source_item_id && String(it.source_item_id || '') === String(pItem.source_item_id)) ||
                (pItem.source_item_id && String(it.id) === String(pItem.source_item_id));
            });
            if (cIdx2 < 0) {
              // Materialize private row into personal column so expand/save use list store
              var material = Object.assign({}, enrichChecklistDisplayItem(list, pItem), {
                id: pItem.id || uid(),
                source_item_id: pItem.source_item_id || null,
                source_col: pItem.source_col || null,
                private_to: pItem.private_to || String(myId() || 'local'),
                from_claim: true
              });
              pcol2.items.push(material);
              cIdx2 = pcol2.items.length - 1;
              if (!list.buckets) list.buckets = {};
              list.buckets.personal = pcol2.items;
            } else {
              var en2 = enrichChecklistDisplayItem(list, pcol2.items[cIdx2]);
              Object.keys(en2).forEach(function (k) {
                if (k === 'id') return;
                pcol2.items[cIdx2][k] = en2[k];
              });
            }
            return {
              list: list,
              col: pcol2,
              bucket: pcol2.items,
              item: pcol2.items[cIdx2],
              index: cIdx2,
              colId: 'personal',
              isChecklist: true
            };
          }
          return {
            list: list,
            col: null,
            bucket: priv,
            item: pItem,
            index: pIdx,
            colId: 'personal',
            isChecklist: true,
            isPrivateOnly: true
          };
        }
      } catch (eP) {}

      // Live claim on todo/buy/bring still shown in My checklist
      var live = null;
      (list.columns || []).some(function (c) {
        if (!c || String(c.id) === 'personal') return false;
        var i = (c.items || []).findIndex(function (x) { return String(x.id) === String(itemId); });
        if (i >= 0) {
          live = {
            list: list,
            col: c,
            bucket: c.items,
            item: c.items[i],
            index: i,
            colId: c.id,
            isChecklistView: true
          };
          return true;
        }
        return false;
      });
      if (live) return live;
    }

    return findInNamedListColumn(list, null, itemId);
  }

  /** Persist a resolved list hit (My checklist private + personal column + named list). */
  function saveNamedListItemHit(hit) {
    if (!hit || !hit.list) return false;
    try {
      if (hit.isPrivateOnly) {
        savePrivateChecklist(hit.list.id, hit.bucket);
      }
      if (hit.isChecklist || hit.isPrivateOnly || String(hit.colId) === 'personal') {
        try {
          var item = hit.item;
          if (item) {
            var priv = getPrivateChecklist(hit.list.id);
            var srcKey = String(item.source_item_id || item.id);
            var pIdx = priv.findIndex(function (it) {
              return it && (
                String(it.id) === String(item.id) ||
                String(it.source_item_id || it.id) === srcKey ||
                String(it.id) === srcKey
              );
            });
            var me = String(myId() || 'local');
            var next = Object.assign({}, (pIdx >= 0 ? priv[pIdx] : {}), cloneItemOptionFields(item), {
              id: pIdx >= 0 && priv[pIdx].id ? priv[pIdx].id : item.id,
              source_item_id: item.source_item_id || (pIdx >= 0 ? priv[pIdx].source_item_id : null) || null,
              source_col: item.source_col || (pIdx >= 0 ? priv[pIdx].source_col : null) || null,
              private_to: me,
              from_claim: true,
              claims: item.claims && typeof item.claims === 'object' ? Object.assign({}, item.claims) : {},
              updated_at: new Date().toISOString()
            });
            if (pIdx >= 0) priv[pIdx] = next;
            else priv.push(next);
            savePrivateChecklist(hit.list.id, priv);

            // Keep personal column in sync when we mutated private-only
            if (hit.isPrivateOnly) {
              var pcol = ensurePersonalColumn(hit.list);
              if (pcol) {
                if (!Array.isArray(pcol.items)) pcol.items = [];
                var cIdx = pcol.items.findIndex(function (it) { return itemIdMatches(it, item.id); });
                if (cIdx >= 0) {
                  Object.assign(pcol.items[cIdx], cloneItemOptionFields(item), {
                    id: pcol.items[cIdx].id,
                    source_item_id: next.source_item_id,
                    source_col: next.source_col,
                    private_to: me,
                    from_claim: true,
                    claims: next.claims
                  });
                } else {
                  pcol.items.push(Object.assign({}, next, { id: item.id || uid() }));
                }
                if (!hit.list.buckets) hit.list.buckets = {};
                hit.list.buckets.personal = pcol.items;
              }
            }
          }
        } catch (ePriv) {
          console.warn('saveNamedListItemHit private', ePriv);
        }
      }
      saveNamedList(hit.list);
      return true;
    } catch (e) {
      console.warn('saveNamedListItemHit', e);
      return false;
    }
  }

  /**
   * My private checklist for an event/shared list.
   * Prefer personal-column rows (clickable ids) enriched with full options;
   * then private store; then live claims.
   */
  function collectMyClaimedItems(list) {
    var me = String(myId() || 'local');
    var seen = {};
    var out = [];
    if (!list) return out;
    try { sanitizeNamedList(list); } catch (e) {}

    function markSeen(it) {
      if (!it) return;
      seen[String(it.id)] = true;
      if (it.source_item_id) seen[String(it.source_item_id)] = true;
    }
    function already(it) {
      if (!it || !it.id) return true;
      if (seen[String(it.id)]) return true;
      if (it.source_item_id && seen[String(it.source_item_id)]) return true;
      return false;
    }

    // 1) Personal column first — stable ids that expand/options can resolve
    try {
      var pcol = getListColumn(list, 'personal');
      if (pcol) {
        (pcol.items || []).forEach(function (it) {
          if (!it || !it.id) return;
          if (it.private_to && String(it.private_to) !== me) return;
          if (already(it)) return;
          markSeen(it);
          out.push(enrichChecklistDisplayItem(list, it));
        });
      }
    } catch (eCol) {}

    // 2) Private store rows not yet on personal column
    try {
      getPrivateChecklist(list.id).forEach(function (it) {
        if (!it || !it.id) return;
        if (it.private_to && String(it.private_to) !== me) return;
        if (already(it)) return;
        markSeen(it);
        out.push(enrichChecklistDisplayItem(list, it));
      });
    } catch (eP) {}

    // 3) Live claims not yet mirrored (todo/buy/bring Got it!)
    (list.columns || []).forEach(function (c) {
      if (!c || String(c.id) === 'personal') return;
      (c.items || []).forEach(function (it) {
        if (!it || !it.id || already(it)) return;
        var q = 0;
        try { q = Number((it.claims || {})[me] || 0); } catch (eQ) { q = 0; }
        if (q > 0) {
          markSeen(it);
          out.push(it);
        }
      });
    });
    return out;
  }
  function getListColumn(list, colId) {
    if (!list) return null;
    sanitizeNamedList(list);
    return (list.columns || []).find(function (c) { return String(c.id) === String(colId); }) || null;
  }
  /** @deprecated use sanitizeNamedList — kept as alias for call sites */
  function normalizeNamedList(n) {
    return sanitizeNamedList(n);
  }

  /** Show/hide the right details panel reliably (avoid CSS !important traps on inline style) */
  function setRightPanelMode(mode) {
    // mode: 'list' | 'event' | 'empty'
    var listsPh = $('lists-placeholder');
    var listsAct = $('lists-active');
    var meta = $('event-meta');
    if (listsAct) {
      listsAct.classList.toggle('is-visible', mode === 'list' || mode === 'event');
      listsAct.hidden = !(mode === 'list' || mode === 'event');
      // Clear inline display so stylesheet + .is-visible control it
      listsAct.style.display = '';
      if (mode === 'list' || mode === 'event') {
        listsAct.style.display = 'flex';
        listsAct.style.flexDirection = 'column';
        listsAct.style.flex = '1 1 auto';
        listsAct.style.minHeight = '0';
      } else {
        listsAct.style.display = 'none';
      }
    }
    if (listsPh) {
      listsPh.style.display = mode === 'empty' ? '' : 'none';
      listsPh.hidden = mode !== 'empty';
    }
    if (meta) {
      meta.style.display = mode === 'event' ? '' : 'none';
      meta.hidden = mode !== 'event';
    }
  }
  function reorderListColumn(list, fromId, toId) {
    if (!list || !fromId || !toId || fromId === toId) return;
    normalizeNamedList(list);
    var from = list.columns.findIndex(function (c) { return String(c.id) === String(fromId); });
    var to = list.columns.findIndex(function (c) { return String(c.id) === String(toId); });
    if (from < 0 || to < 0) return;
    var moved = list.columns.splice(from, 1)[0];
    list.columns.splice(to, 0, moved);
    list.columnOrder = list.columns.map(function (c) { return c.id; });
    list.updated_at = new Date().toISOString();
  }
  function addListColumn(list, name) {
    if (!list) return null;
    normalizeNamedList(list);
    var col = defaultColumn(null, name || 'New list');
    list.columns.push(col);
    list.columnOrder = list.columns.map(function (c) { return c.id; });
    list.buckets[col.id] = col.items;
    list.updated_at = new Date().toISOString();
    return col;
  }
  function deleteListColumn(list, colId) {
    if (!list) return false;
    normalizeNamedList(list);
    if (list.columns.length <= 1) return false;
    list.columns = list.columns.filter(function (c) { return String(c.id) !== String(colId); });
    delete list.buckets[colId];
    list.columnOrder = list.columns.map(function (c) { return c.id; });
    list.updated_at = new Date().toISOString();
    return true;
  }
  function promoteListColumn(list, kind) {
    if (!list) return;
    normalizeNamedList(list);
    reorderListColumn(list, kind, list.columns[0] && list.columns[0].id);
    // move to front
    var idx = list.columns.findIndex(function (c) { return String(c.id) === String(kind); });
    if (idx > 0) {
      var m = list.columns.splice(idx, 1)[0];
      list.columns.unshift(m);
      list.columnOrder = list.columns.map(function (c) { return c.id; });
    }
    list.kind = kind;
    state.listTab = kind;
    list.updated_at = new Date().toISOString();
  }
  /** Publish event packing lists so Hunt/Reg can “View list”. */
  function publishEventListBridge(list) {
    if (!list || !list.eventId) return;
    try {
      sanitizeNamedList(list);
      var bag = loadJson(SLAYER_EVENT_LISTS_KEY, null) || {};
      var ev = findEventById(list.eventId);
      var huntId = (ev && (ev.hunt_event_id || ev.huntEventId)) || null;
      var pack = {
        listId: String(list.id),
        name: list.name || 'List',
        eventId: String(list.eventId),
        huntEventId: huntId ? String(huntId) : null,
        invite_code: list.invite_code || null,
        eventName: (ev && ev.name) || list.name || 'Event',
        columns: (list.columns || []).filter(function (c) {
          // Never publish private My checklist to Hunt/Reg or other devices as shared pack data
          return c && String(c.id) !== 'personal';
        }).map(function (c) {
          return {
            id: c.id,
            name: c.name || listKindLabel(c.id),
            items: (c.items || []).filter(function (it) { return it && it.title; }).map(function (it) {
              return {
                id: it.id,
                title: it.title,
                qty: it.qty || 1,
                claims: it.claims || {},
                highlight: !!it.highlight
              };
            })
          };
        }),
        members: (list.members || []).map(function (m) {
          return {
            user_id: m.user_id,
            display_name: m.display_name || m.username || 'Member',
            role: m.role || 'member'
          };
        }),
        updated_at: new Date().toISOString()
      };
      bag[String(list.eventId)] = pack;
      if (huntId) bag['hunt:' + String(huntId)] = pack;
      if (list.id) bag['list:' + String(list.id)] = pack;
      saveJson(SLAYER_EVENT_LISTS_KEY, bag);
      // Stamp plan event for reverse lookup
      if (ev) {
        ev.planListId = list.id;
        ev.plan_list_id = list.id;
      }
    } catch (ePub) {
      console.warn('publishEventListBridge', ePub);
    }
  }

  function saveNamedList(list) {
    if (!list) return false;
    try {
      // Guard: refuse writes that would wipe most items (category/type glitches) (#63)
      try {
        var prevSnap = null;
        var store0 = loadFreeListsStoreRaw && loadFreeListsStoreRaw();
        if (store0 && Array.isArray(store0.named)) {
          prevSnap = store0.named.find(function (n) { return n && String(n.id) === String(list.id); });
        }
        if (prevSnap) {
          function countItems(n) {
            var c = 0;
            try {
              (n.columns || []).forEach(function (col) {
                if (col && Array.isArray(col.items)) c += col.items.length;
              });
              if (!c && n.buckets && typeof n.buckets === 'object') {
                Object.keys(n.buckets).forEach(function (k) {
                  if (Array.isArray(n.buckets[k])) c += n.buckets[k].length;
                });
              }
            } catch (eC) {}
            return c;
          }
          var beforeN = countItems(prevSnap);
          var afterN = countItems(list);
          if (beforeN >= 3 && afterN < Math.max(1, Math.floor(beforeN * 0.35))) {
            console.warn('[PlanSlayer] blocked saveNamedList wipe', list.id, beforeN, '→', afterN);
            try { appToast('Save blocked — list looked empty after an edit. Refresh and try again.'); } catch (eT) {}
            return false;
          }
        }
      } catch (eGuard) {}
      sanitizeNamedList(list);
      // Never re-save a deleted list (or a pack for an event whose list was deleted)
      if (isTombstoned('list', list.id)) {
        console.info('[PlanSlayer] skip saveNamedList — list tombstoned', list.id);
        return false;
      }
      if (list.eventId && isTombstoned('eventList', list.eventId) && isTombstoned('list', list.id)) {
        return false;
      }
      list.updated_at = new Date().toISOString();
      // Clone through JSON so we never store live shared refs
      var snapshot;
      try {
        snapshot = sanitizeNamedList(JSON.parse(JSON.stringify(list)));
      } catch (eJ) {
        // Manual minimal clone — preserve personal-for-event + expense flags
        snapshot = sanitizeNamedList({
          id: list.id,
          name: list.name,
          owner_id: list.owner_id,
          eventId: list.eventId || null,
          personalForEventId: list.personalForEventId || null,
          isPersonalEventList: !!list.isPersonalEventList,
          showExpense: list.showExpense,
          choreColor: list.choreColor || null,
          members: list.members || [],
          creators: list.creators || [],
          columns: (list.columns || []).map(function (c) {
            return {
              id: c.id,
              name: c.name,
              items: (c.items || []).slice(),
              minimized: !!c.minimized,
              colors: c.colors,
              invite_code: c.invite_code
            };
          }),
          invite_code: list.invite_code || null,
          created_at: list.created_at,
          updated_at: list.updated_at
        });
      }
      // Always re-attach flags sanitize may not know about
      if (list.personalForEventId) snapshot.personalForEventId = String(list.personalForEventId);
      if (list.isPersonalEventList) snapshot.isPersonalEventList = true;
      if (list.showExpense != null) snapshot.showExpense = list.showExpense;
      if (list.choreColor) snapshot.choreColor = list.choreColor;
      if (isTombstoned('list', snapshot.id)) return false;
      // Never tombstone-skip personal claim lists on save
      if (snapshot.isPersonalEventList || snapshot.personalForEventId) {
        try { clearTombstone('list', snapshot.id); } catch (eT) {}
      }
      var store = loadFreeListsStoreRaw();
      if (!Array.isArray(store.named)) store.named = [];
      var deadLists = loadTombstones().lists;
      var idx = store.named.findIndex(function (n) { return n && String(n.id) === String(snapshot.id); });
      if (idx >= 0) store.named[idx] = snapshot;
      else store.named.push(snapshot);
      // Heal every other list too so store can't stay permanently broken
      store.named = store.named.map(function (n) {
        try { return sanitizeNamedList(n); } catch (e) { return n; }
      }).filter(function (n) {
        if (!n || !n.id) return false;
        // Keep personal-for-event lists even if something marked them dead by mistake
        if (n.isPersonalEventList || n.personalForEventId) return true;
        if (deadLists[String(n.id)]) return false;
        return true;
      });
      var ok = saveJson(LOCAL_FREE_LISTS_KEY, store);
      if (ok && snapshot.eventId) {
        try { publishEventListBridge(snapshot); } catch (eB) {}
        // Push list items into the linked plan event + cloud so phones/other people see them soon
        try { syncNamedListToEventCloud(snapshot); } catch (eSync) {}
      }
      return ok;
    } catch (eS) {
      console.warn('saveNamedList', eS);
      return false;
    }
  }

  /**
   * Mirror a named packing list into plan_events.state so multi-device/cloud users get updates.
   * Also dual-writes Hunt/Reg View list packs.
   */
  function syncNamedListToEventCloud(list) {
    if (!list || !list.eventId) return;
    var ev = findEventById(list.eventId);
    if (!ev) return;
    if (!ev.state) ev.state = {};
    normalizeEvent(ev);
    // Snapshot full named list for rebuild on other devices
    try {
      ev.state.namedListPack = {
        listId: String(list.id),
        name: list.name || 'List',
        members: list.members || [],
        // Shared pack only — never put private My checklist rows in the cloud pack
        columns: (list.columns || []).filter(function (c) {
          return c && String(c.id) !== 'personal';
        }).map(function (c) {
          return {
            id: c.id,
            name: c.name,
            items: (c.items || []).map(function (it) {
              return Object.assign({}, it);
            }),
            minimized: !!c.minimized,
            colors: c.colors || null
          };
        }),
        invite_code: list.invite_code || null,
        updated_at: list.updated_at || new Date().toISOString()
      };
    } catch (eP) {}
    // Also mirror classic todo/buy/bring buckets when those column ids exist
    ['todo', 'buy', 'bring'].forEach(function (k) {
      var col = (list.columns || []).find(function (c) { return c && String(c.id) === k; });
      if (!col) return;
      if (!ev.state.lists[k]) ev.state.lists[k] = { group: [], personal: {} };
      ev.state.lists[k].group = (col.items || []).map(function (it) { return Object.assign({}, it); });
    });
    // Copy list members into event localMembers for display (never re-add removed)
    try {
      if (!Array.isArray(ev.state.localMembers)) ev.state.localMembers = [];
      (list.members || []).forEach(function (m) {
        if (!m) return;
        if (isMemberRemoved(ev, m.user_id)) return;
        var exists = ev.state.localMembers.some(function (x) {
          return String(x.user_id) === String(m.user_id) ||
            String(x.display_name || '').toLowerCase() === String(m.display_name || '').toLowerCase();
        });
        if (!exists) {
          ev.state.localMembers.push({
            user_id: m.user_id,
            display_name: m.display_name || m.username || 'Member',
            role: m.role || 'member',
            arrow_color: m.arrow_color || COLORS[0]
          });
        }
      });
      // Drop anyone on the removed denylist
      ev.state.localMembers = (ev.state.localMembers || []).filter(function (m) {
        return m && !isMemberRemoved(ev, m.user_id);
      });
    } catch (eM) {}
    ev.updated_at = new Date().toISOString();
    persistLocal();
    cloudSaveEvent(ev);
    try { dualWriteHuntCalendarEvent(ev, list); } catch (eD) {}
  }

  /** After cloud pull, rebuild free packing lists from event.state.namedListPack / lists */
  function applyCloudListPackToLocal(ev) {
    if (!ev || !ev.id) return;
    var pack = ev.state && ev.state.namedListPack;
    var store = loadFreeListsStoreRaw();
    var existing = (store.named || []).find(function (n) {
      return n && n.eventId && String(n.eventId) === String(ev.id);
    });
    if (pack && pack.columns && pack.columns.length) {
      var listId = (existing && existing.id) || pack.listId || uid();
      var localUpdated = existing && existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      var cloudUpdated = pack.updated_at ? new Date(pack.updated_at).getTime() : 0;
      function countPackItems(cols) {
        var n = 0;
        (cols || []).forEach(function (c) { n += (c && c.items ? c.items.length : 0); });
        return n;
      }
      var localItems = existing ? countPackItems(existing.columns) : 0;
      var cloudItems = countPackItems(pack.columns);
      // #103: prefer cloud when clearly newer; never wipe local if cloud empty
      var cloudWins = !existing ||
        (cloudUpdated > localUpdated + 400 && !(localItems > 0 && cloudItems === 0));
      if (cloudWins) {
        // Keep local members that cloud pack might have dropped after a race
        var members = pack.members || [];
        if (existing && existing.members && existing.members.length) {
          var byM = {};
          members.forEach(function (m) { if (m && m.user_id) byM[String(m.user_id)] = m; });
          existing.members.forEach(function (m) {
            if (!m || !m.user_id) return;
            if (isMemberRemoved(ev, m.user_id)) return;
            if (!byM[String(m.user_id)]) members.push(m);
          });
        }
        members = members.filter(function (m) {
          return m && !isMemberRemoved(ev, m.user_id);
        });
        var rebuilt = sanitizeNamedList({
          id: listId,
          name: pack.name || ((ev.name || 'Event') + ' · lists'),
          owner_id: (existing && existing.owner_id) || ev.owner_user_id || myId() || 'local',
          eventId: String(ev.id),
          members: members,
          creators: (existing && existing.creators) || [],
          columns: pack.columns,
          invite_code: pack.invite_code || (existing && existing.invite_code) || null,
          created_at: (existing && existing.created_at) || new Date().toISOString(),
          updated_at: pack.updated_at || new Date().toISOString()
        });
        var idx = (store.named || []).findIndex(function (n) { return n && String(n.id) === String(listId); });
        if (idx >= 0) store.named[idx] = rebuilt;
        else {
          // Replace shared packs for this event only — never remove Personal {Event} lists
          store.named = (store.named || []).filter(function (n) {
            if (!n) return false;
            if (n.isPersonalEventList || n.personalForEventId) return true;
            return !(n.eventId && String(n.eventId) === String(ev.id));
          });
          store.named.push(rebuilt);
        }
        saveJson(LOCAL_FREE_LISTS_KEY, store);
        try { publishEventListBridge(rebuilt); } catch (eB) {}
        return;
      }
    }
    // Fallback: seed from classic lists if no named pack
    if (!existing) {
      try { ensureAssociatedListForEvent(ev); } catch (eA) {}
    } else if (ev.state && ev.state.lists) {
      var evT = ev.updated_at ? new Date(ev.updated_at).getTime() : 0;
      var locT = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      // Only merge classic buckets when cloud is clearly ahead and has items
      if (evT > locT + 1500) {
        sanitizeNamedList(existing);
        var anyCloudItems = false;
        ['todo', 'buy', 'bring'].forEach(function (k) {
          var group = (ev.state.lists[k] && ev.state.lists[k].group) || [];
          if (group.length) anyCloudItems = true;
        });
        if (anyCloudItems) {
          ['todo', 'buy', 'bring'].forEach(function (k) {
            var group = (ev.state.lists[k] && ev.state.lists[k].group) || [];
            var col = getListColumn(existing, k);
            if (col && Array.isArray(group) && group.length) {
              col.items = group.map(function (it) { return Object.assign({}, it); });
            }
          });
          existing.updated_at = ev.updated_at || existing.updated_at;
          var idx2 = (store.named || []).findIndex(function (n) { return n && String(n.id) === String(existing.id); });
          if (idx2 >= 0) store.named[idx2] = existing;
          saveJson(LOCAL_FREE_LISTS_KEY, store);
          try { publishEventListBridge(existing); } catch (eB2) {}
        }
      }
    }
  }

  /** Map partners + friends for Add members */
  function loadMapPartnersRaw() {
    var list = loadJson(SLAYER_MAP_PARTNERS_KEY, []) || [];
    return Array.isArray(list) ? list : [];
  }
  function rememberMapPartner(p) {
    if (!p) return;
    var list = loadMapPartnersRaw();
    var id = String(p.user_id || p.id || '');
    var name = p.display_name || p.username || p.name || '';
    if (!id && !name) return;
    var idx = list.findIndex(function (x) {
      return (id && String(x.user_id) === id) ||
        (name && String(x.display_name || '').toLowerCase() === String(name).toLowerCase());
    });
    var row = {
      user_id: id || (list[idx] && list[idx].user_id) || null,
      display_name: name || (list[idx] && list[idx].display_name) || 'Member',
      username: p.username || (list[idx] && list[idx].username) || '',
      arrow_color: p.arrow_color || p.color || (list[idx] && list[idx].arrow_color) || COLORS[0],
      from_map: p.from_map || (list[idx] && list[idx].from_map) || '',
      updated_at: new Date().toISOString()
    };
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], row);
    else list.push(row);
    saveJson(SLAYER_MAP_PARTNERS_KEY, list);
    rememberFriend(row);
  }
  function allPeopleForAddMembers(q, limit) {
    q = String(q || '').toLowerCase().trim();
    var byId = {};
    var out = [];
    function add(p) {
      if (!p) return;
      var id = String(p.user_id || p.id || p.display_name || p.username || '');
      if (!id || byId[id]) return;
      byId[id] = true;
      out.push({
        user_id: p.user_id || p.id || null,
        display_name: p.display_name || p.username || p.name || 'Member',
        username: p.username || '',
        arrow_color: p.arrow_color || p.color || COLORS[out.length % COLORS.length]
      });
    }
    loadMapPartnersRaw().forEach(add);
    loadFriendsRaw().forEach(add);
    (state.members || []).forEach(add);
    if (q) {
      out = out.filter(function (p) {
        return String(p.display_name || '').toLowerCase().indexOf(q) >= 0 ||
          String(p.username || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    return out.slice(0, limit || 40);
  }
  /** Pull partners from every shared map (async, best-effort). */
  function refreshMapPartnersFromCloud() {
    var client = sb();
    if (!client) return Promise.resolve([]);
    return client.rpc('list_my_shared_maps').then(function (res) {
      var maps = (res && res.data) || [];
      if (!Array.isArray(maps) || !maps.length) return [];
      var chain = Promise.resolve();
      maps.forEach(function (m) {
        if (!m || !m.id) return;
        chain = chain.then(function () {
          return client.rpc('list_shared_map_members', { p_map_id: m.id }).then(function (r2) {
            var mems = (r2 && r2.data) || [];
            (Array.isArray(mems) ? mems : []).forEach(function (mem) {
              if (!mem) return;
              var uid = mem.user_id || mem.id;
              if (uid && String(uid) === String(myId())) return;
              rememberMapPartner({
                user_id: uid,
                display_name: mem.display_name || mem.username || mem.name || 'Member',
                username: mem.username || '',
                arrow_color: mem.arrow_color || mem.color,
                from_map: m.name || ''
              });
            });
          }).catch(function () {});
        });
      });
      return chain.then(function () { return loadMapPartnersRaw(); });
    }).catch(function () { return loadMapPartnersRaw(); });
  }

  var _sharePeopleCtx = { kind: 'list', id: null }; // kind: list | event
  /** Selected people in Add members popup: [{user_id, display_name}] */
  var _sharePeopleSelected = [];

  function openSharePeopleChooser(kind, id) {
    _sharePeopleCtx = { kind: kind || 'list', id: id };
    var title = kind === 'event' ? 'Share event' : 'Share list';
    if ($('share-people-title')) $('share-people-title').textContent = title;
    if ($('share-people-sub')) {
      $('share-people-sub').textContent = kind === 'event'
        ? 'Share this event with others, or copy an invite code.'
        : 'Share this list with others, or copy an invite code.';
    }
    if ($('share-people-copy-label')) {
      $('share-people-copy-label').textContent = 'Copy invite code';
    }
    if ($('share-people-chooser')) {
      $('share-people-chooser').classList.add('is-open');
      $('share-people-chooser').setAttribute('aria-hidden', 'false');
    }
  }
  function closeSharePeopleChooser() {
    if ($('share-people-chooser')) {
      $('share-people-chooser').classList.remove('is-open');
      $('share-people-chooser').setAttribute('aria-hidden', 'true');
    }
  }
  function openSharePeopleMembers() {
    closeSharePeopleChooser();
    _sharePeopleSelected = [];
    if ($('share-people-search')) $('share-people-search').value = '';
    if ($('share-people-members-title')) {
      $('share-people-members-title').textContent =
        _sharePeopleCtx.kind === 'event' ? 'Add members to event' : 'Add members to list';
    }
    fillSharePeoplePick('');
    refreshMapPartnersFromCloud().then(function () {
      fillSharePeoplePick(($('share-people-search') && $('share-people-search').value) || '');
    });
    if ($('share-people-members')) {
      $('share-people-members').classList.add('is-open');
      $('share-people-members').setAttribute('aria-hidden', 'false');
    }
  }
  function closeSharePeopleMembers(commit) {
    if (commit) commitSharePeopleSelected();
    else _sharePeopleSelected = [];
    if ($('share-people-members')) {
      $('share-people-members').classList.remove('is-open');
      $('share-people-members').setAttribute('aria-hidden', 'true');
    }
  }
  function isSharePersonSelected(id) {
    return _sharePeopleSelected.some(function (p) { return String(p.user_id) === String(id); });
  }
  function toggleSharePerson(personId, personName) {
    if (!personId && !personName) return;
    var key = String(personId || personName);
    var idx = _sharePeopleSelected.findIndex(function (p) {
      return String(p.user_id) === key ||
        String(p.display_name || '').toLowerCase() === String(personName || '').toLowerCase();
    });
    if (idx >= 0) _sharePeopleSelected.splice(idx, 1);
    else _sharePeopleSelected.push({ user_id: personId || personName, display_name: personName || 'Member' });
    // Light up without wiping the whole list if possible
    var btn = document.querySelector('#share-people-pick [data-share-person="' +
      String(personId || personName).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
    if (!btn) {
      // attribute selector may fail on special chars — re-render
      fillSharePeoplePick(($('share-people-search') && $('share-people-search').value) || '');
      return;
    }
    btn.classList.toggle('is-selected', isSharePersonSelected(personId || personName));
  }
  function fillSharePeoplePick(q) {
    var box = $('share-people-pick');
    if (!box) return;
    var people = allPeopleForAddMembers(q, 40);
    box.innerHTML = people.map(function (p) {
      var id = p.user_id || p.display_name;
      var on = isSharePersonSelected(id);
      return '<button type="button" class="btn share-person-btn' + (on ? ' is-selected' : '') +
        '" data-share-person="' + esc(String(id)) + '" data-share-person-name="' + esc(p.display_name || '') + '">' +
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
        esc(p.arrow_color || COLORS[0]) + ';margin-right:8px;flex-shrink:0"></span>' +
        '<span style="flex:1;min-width:0">' + esc(p.display_name || 'Member') +
        (p.username ? (' <span class="muted">@' + esc(p.username) + '</span>') : '') +
        '</span>' +
        (on ? '<span style="margin-left:8px;color:var(--accent);font-weight:900">✓</span>' : '') +
        '</button>';
    }).join('') || '<p class="muted">No map partners yet. Share maps on Hunt/Reg, or type a name below.</p>';
  }
  function copyShareCodeForCtx() {
    var code = '';
    var label = 'Code';
    if (_sharePeopleCtx.kind === 'event') {
      var ev = findEventById(_sharePeopleCtx.id) || activeEvent();
      if (ev) {
        if (!ev.invite_code) {
          ev.invite_code = String(Math.floor(100000 + Math.random() * 900000));
          try { saveActiveEvent(); } catch (eS) { persistLocal(); }
        }
        code = ev.invite_code;
        label = 'Event code';
      }
    } else {
      var list = findNamedListById(_sharePeopleCtx.id || state.activeNamedListId);
      if (list) {
        if (!list.invite_code) {
          list.invite_code = makeListInviteCode();
          saveNamedList(list);
        }
        code = list.invite_code;
        label = 'List code';
      }
    }
    if (!code) {
      appToast('Could not create a code');
      return;
    }
    var text = code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        appToast(label + ' copied: ' + code);
      }).catch(function () { appToast(code); });
    } else {
      appToast(code);
    }
  }
  function isUuidLike(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
  }
  /** Add one person to event or list; returns true if newly added. */
  function addPersonToShareCtx(personId, personName, opts) {
    opts = opts || {};
    var quiet = !!opts.quiet;
    if (_sharePeopleCtx.kind === 'event') {
      var ev = findEventById(_sharePeopleCtx.id) || activeEvent();
      if (!ev) return false;
      if (!ev.state) ev.state = {};
      if (!Array.isArray(ev.state.localMembers)) ev.state.localMembers = [];
      var already = (ev.state.localMembers || []).some(function (m) {
        return String(m.user_id) === String(personId) ||
          String(m.display_name || '').toLowerCase() === String(personName || '').toLowerCase();
      });
      if (!already && state.members) {
        already = state.members.some(function (m) {
          return String(m.user_id) === String(personId) ||
            String(m.display_name || '').toLowerCase() === String(personName || '').toLowerCase();
        });
      }
      if (already) {
        if (!quiet) appToast('Already on this event');
        return false;
      }
      var row = {
        user_id: personId,
        display_name: personName || 'Member',
        role: 'member',
        arrow_color: COLORS[(ev.state.localMembers.length) % COLORS.length]
      };
      ev.state.localMembers.push(row);
      if (!state.members) state.members = [];
      if (!state.members.some(function (m) { return String(m.user_id) === String(personId); })) {
        state.members.push(Object.assign({}, row));
      }
      rememberMapPartner({ user_id: personId, display_name: personName });
      // Cloud: real accounts appear on their login via plan_event_members
      if (isUuidLike(personId) && isUuidLike(ev.id) && !ev._localOnly) {
        try {
          var client = sb();
          if (client) {
            client.from('plan_event_members').upsert({
              event_id: ev.id,
              user_id: personId,
              role: 'member'
            }, { onConflict: 'event_id,user_id' }).then(function () {}).catch(function () {});
          }
        } catch (eCloud) {}
      }
      // Event list pack also gets the member
      try {
        var linked = listsForEvent(ev.id);
        if (linked[0]) {
          addListMemberFromPick(linked[0], personId || personName, !isUuidLike(personId));
        }
      } catch (eL) {}
      try { saveActiveEvent(); } catch (e) { persistLocal(); }
      if (!quiet) appToast('Added ' + (personName || 'member') + ' to event');
      return true;
    }
    var list = findNamedListById(_sharePeopleCtx.id || state.activeNamedListId);
    if (!list) return false;
    var before = (list.members || []).length;
    addListMemberFromPick(list, personId || personName, !isUuidLike(personId));
    // If list is linked to an event, add them there too (so they see the event)
    if (list.eventId) {
      var prevKind = _sharePeopleCtx.kind;
      var prevId = _sharePeopleCtx.id;
      _sharePeopleCtx = { kind: 'event', id: list.eventId };
      addPersonToShareCtx(personId, personName, { quiet: true });
      _sharePeopleCtx = { kind: prevKind, id: prevId };
    }
    var after = (findNamedListById(list.id) || list).members || [];
    var ok = after.length > before || after.some(function (m) {
      return String(m.user_id) === String(personId) ||
        String(m.display_name || '').toLowerCase() === String(personName || '').toLowerCase();
    });
    if (!quiet && ok) appToast('Added ' + (personName || 'member') + ' to list');
    return ok;
  }
  function commitSharePeopleSelected() {
    if (!_sharePeopleSelected.length) {
      appToast('Select at least one person');
      return 0;
    }
    var n = 0;
    _sharePeopleSelected.slice().forEach(function (p) {
      if (addPersonToShareCtx(p.user_id, p.display_name, { quiet: true })) n++;
    });
    _sharePeopleSelected = [];
    if (n > 0) {
      appToast('Added ' + n + ' member' + (n === 1 ? '' : 's'));
      try { render(); } catch (eR) {}
      try { loadMembers(_sharePeopleCtx.kind === 'event' ? _sharePeopleCtx.id : (state.activeEventId || null)); } catch (eM) {}
    } else {
      appToast('Already members, or nothing to add');
    }
    return n;
  }
  function saveFreeListsStore(s) {
    if (!s) return false;
    try {
      if (Array.isArray(s.named)) {
        s.named = s.named.map(function (n) {
          try { return sanitizeNamedList(n); } catch (e) { return n; }
        }).filter(function (n) { return n && n.id; });
      }
      return saveJson(LOCAL_FREE_LISTS_KEY, s);
    } catch (e) {
      return false;
    }
  }
  function freeScope() {
    // Unified My lists — kept for legacy call sites
    return 'shared';
  }
  function allMyLists() {
    return (loadFreeListsStore().named || []).slice().sort(function (a, b) {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
  }
  function listItemCount(list) {
    if (!list) return 0;
    normalizeNamedList(list);
    var n = 0;
    (list.columns || []).forEach(function (c) {
      n += (c.items || []).length;
    });
    return n;
  }
  /** True when this is my private “Personal {Event}” list (not the shared packing pack) */
  function isPersonalEventShadowList(n) {
    return !!(n && (n.isPersonalEventList || n.personalForEventId));
  }
  /**
   * Personal lists: true personal packs + my private “Personal {Event}” lists
   * (countdown comes from personalForEventId / event dates).
   */
  function personalListsOnly() {
    return allMyLists().filter(function (n) {
      normalizeNamedList(n);
      if (isPersonalEventShadowList(n)) return true;
      // Shared packing packs stay under Event lists
      return !n.eventId;
    });
  }
  /** Shared packing lists linked to a given event (not Personal {Event} shadows) */
  function listsForEvent(eventId) {
    if (eventId == null || eventId === '') return [];
    var id = String(eventId);
    return allMyLists().filter(function (n) {
      normalizeNamedList(n);
      if (isPersonalEventShadowList(n)) return false;
      return n.eventId && String(n.eventId) === id;
    });
  }
  /** Shared event packing lists (exclude personal-for-event shadows) */
  function eventLinkedListsAll() {
    return allMyLists().filter(function (n) {
      normalizeNamedList(n);
      if (isPersonalEventShadowList(n)) return false;
      return !!n.eventId;
    });
  }
  /**
   * My private list of stuff I Got it! from a shared packing list.
   * Named “Personal {EventName}” (e.g. event “Gator” → “Personal Gator”).
   * Lives under Personal lists; countdown uses the event dates when known.
   */
  function personalEventListName(evOrName) {
    var base = '';
    if (evOrName && typeof evOrName === 'object') base = evOrName.name || '';
    else base = String(evOrName || '');
    base = String(base).replace(/\s*[·•]\s*lists?\s*$/i, '').trim();
    base = autoCap(base) || 'List';
    if (/^personal\s/i.test(base)) return base;
    return 'Personal ' + base;
  }
  /**
   * Resolve event for a packing list (eventId, active event, or name match).
   */
  function resolveEventForList(list) {
    if (!list) return activeEvent() || null;
    if (list.eventId) {
      var ev = findEventById(list.eventId);
      if (ev) return ev;
    }
    if (list.personalForEventId) {
      var pev = findEventById(list.personalForEventId);
      if (pev) return pev;
    }
    var ae = activeEvent();
    if (ae) return ae;
    // Name match: “Gator · lists” → event “Gator”
    try {
      var nm = String(list.name || '').replace(/\s*[·•]\s*lists?\s*$/i, '').trim().toLowerCase();
      if (nm) {
        var hit = allEventsCombined().find(function (e) {
          return e && String(e.name || '').trim().toLowerCase() === nm;
        });
        if (hit) return hit;
      }
    } catch (eN) {}
    return null;
  }
  function ensurePersonalEventList(ev, sourceList) {
    var eid = ev && ev.id ? String(ev.id) : null;
    var me = String(myId() || 'local');
    var wantName = personalEventListName(ev || (sourceList && sourceList.name) || 'List');
    // Stable id so we don't create duplicates / lose the list
    var stableId = eid
      ? ('personal_ev_' + eid + '_' + me.replace(/[^a-zA-Z0-9_-]/g, ''))
      : ('personal_src_' + String((sourceList && sourceList.id) || 'x') + '_' + me.replace(/[^a-zA-Z0-9_-]/g, ''));

    // Prefer raw store so we never miss a list due to heal/filter
    var store = loadFreeListsStoreRaw();
    if (!Array.isArray(store.named)) store.named = [];
    var existing = store.named.find(function (n) {
      if (!n) return false;
      if (String(n.id) === String(stableId)) return true;
      if (n.isPersonalEventList || n.personalForEventId) {
        if (eid && String(n.personalForEventId || n.eventId) === eid) return true;
        if (!eid && sourceList && String(n.sourcePackListId) === String(sourceList.id)) return true;
      }
      return false;
    });
    if (existing) {
      existing.isPersonalEventList = true;
      if (eid) existing.personalForEventId = eid;
      // Never re-link as shared pack
      if (existing.eventId && isPersonalEventShadowList(existing)) existing.eventId = null;
      if (existing.name !== wantName) existing.name = wantName;
      if (sourceList && sourceList.id) existing.sourcePackListId = sourceList.id;
      try { clearTombstone('list', existing.id); } catch (eC) {}
      sanitizeNamedList(existing);
      existing.isPersonalEventList = true;
      if (eid) existing.personalForEventId = eid;
      existing.eventId = null;
      var okEx = saveNamedList(existing);
      if (!okEx) {
        // Force write via raw store
        var ix = store.named.findIndex(function (n) { return n && String(n.id) === String(existing.id); });
        if (ix >= 0) store.named[ix] = existing;
        saveJson(LOCAL_FREE_LISTS_KEY, store);
      }
      return findNamedListById(existing.id) || existing;
    }

    var nl = {
      id: stableId,
      name: wantName,
      kind: 'todo',
      items: [],
      buckets: { todo: [], buy: [], bring: [] },
      columnOrder: ['todo', 'buy', 'bring'],
      eventId: null,
      personalForEventId: eid,
      isPersonalEventList: true,
      sourcePackListId: sourceList && sourceList.id ? sourceList.id : null,
      owner_id: me,
      creators: [],
      members: [{
        user_id: me,
        display_name: myName() || 'You',
        role: 'owner'
      }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    sanitizeNamedList(nl);
    nl.isPersonalEventList = true;
    nl.personalForEventId = eid;
    nl.eventId = null;
    nl.name = wantName;
    try { clearTombstone('list', nl.id); } catch (eC2) {}
    store.named.push(nl);
    saveJson(LOCAL_FREE_LISTS_KEY, store);
    // Also through saveNamedList for consistency
    try { saveNamedList(nl); } catch (eS) {}
    return findNamedListById(nl.id) || nl;
  }
  /**
   * Copy a claimed item from a packing list → Personal {Event/List} under Personal lists.
   * claimQty 0 removes the mirrored row.
   */
  function syncClaimToPersonalEventList(sourceList, sourceItem, claimQty, sourceColId) {
    if (!sourceList || !sourceItem) return null;
    // Don't recurse if we're already on a personal shadow list
    if (isPersonalEventShadowList(sourceList)) return null;
    // Skip private checklist column itself
    if (sourceColId && String(sourceColId) === 'personal') return null;

    var ev = resolveEventForList(sourceList);
    var plist = ensurePersonalEventList(ev, sourceList);
    if (!plist) {
      console.warn('[PlanSlayer] ensurePersonalEventList failed', sourceList && sourceList.id);
      return null;
    }
    // Re-load live copy from store so we don't mutate a stale object
    plist = findNamedListById(plist.id) || plist;
    sanitizeNamedList(plist);
    plist.isPersonalEventList = true;
    if (ev && ev.id) plist.personalForEventId = String(ev.id);
    plist.eventId = null;

    claimQty = Math.max(0, Number(claimQty) || 0);
    var me = String(myId() || 'local');
    var srcId = String(sourceItem.id);
    // Prefer same column (todo/buy/bring); fall back to todo
    var colId = 'todo';
    if (sourceColId && ['todo', 'buy', 'bring'].indexOf(String(sourceColId)) >= 0) {
      colId = String(sourceColId);
    }
    var col = getListColumn(plist, colId);
    if (!col) {
      col = getListColumn(plist, 'todo');
      colId = 'todo';
    }
    if (!col) {
      // Force classic columns
      sanitizeNamedList(plist);
      col = getListColumn(plist, 'todo');
      colId = 'todo';
    }
    if (!col) return null;
    if (!Array.isArray(col.items)) col.items = [];
    var idx = col.items.findIndex(function (it) {
      return it && String(it.source_item_id) === srcId;
    });
    if (claimQty <= 0) {
      if (idx >= 0) col.items.splice(idx, 1);
      if (!plist.buckets) plist.buckets = {};
      plist.buckets[colId] = col.items;
      saveNamedList(plist);
      return plist;
    }
    var row = idx >= 0 ? col.items[idx] : null;
    var hadHomeClaimPe = !!(row && row.claims && row.claims[me]);
    if (!row) {
      // #117: qty = claimed amount; unclaimed until packing Got it!
      row = {
        id: uid(),
        source_item_id: srcId,
        source_list_id: sourceList.id,
        source_col: sourceColId || colId,
        title: sourceItem.title || 'Item',
        qty: Math.max(1, claimQty),
        qualifier: sourceItem.qualifier || 'other',
        priority: sourceItem.priority || 0,
        notes: sourceItem.notes || '',
        notesList: Array.isArray(sourceItem.notesList) ? sourceItem.notesList.slice() : [],
        claims: {},
        from_event_claim: true,
        private_to: me,
        created_by: me,
        created_at: new Date().toISOString()
      };
      col.items.push(row);
    }
    row.title = sourceItem.title || row.title;
    row.qty = Math.max(1, claimQty);
    row.source_item_id = srcId;
    row.source_list_id = sourceList.id;
    row.source_col = sourceColId || row.source_col || colId;
    row.from_event_claim = true;
    row.private_to = me;
    if (!row.claims || typeof row.claims !== 'object') row.claims = {};
    // Keep packing progress if already claimed at home; else start unclaimed
    if (!hadHomeClaimPe) row.claims = {};
    row.claimed_qty = claimQty;
    row.updated_at = new Date().toISOString();
    if (!plist.buckets) plist.buckets = {};
    plist.buckets[colId] = col.items;
    // Keep flags through save
    plist.isPersonalEventList = true;
    if (ev && ev.id) plist.personalForEventId = String(ev.id);
    plist.eventId = null;
    var ok = saveNamedList(plist);
    if (!ok) console.warn('[PlanSlayer] save personal claim list failed', plist.id);
    return plist;
  }
  function findNamedListById(id) {
    if (id == null || id === '') return null;
    return (loadFreeListsStore().named || []).find(function (n) { return String(n.id) === String(id); }) || null;
  }
  /** Resolve which named list the RIGHT panel column UI is editing */
  function resolveOpenNamedList(fromEl) {
    var listId = null;
    if (fromEl && fromEl.closest) {
      var host = fromEl.closest('[data-list-id]');
      if (host) listId = host.getAttribute('data-list-id');
    }
    if (!listId) listId = state.activeNamedListId;
    var list = findNamedListById(listId);
    if (list) return list;
    // Event packing triad may render a linked list without activeNamedListId set
    var ev = activeEvent();
    if (ev && ev.id) {
      var linked = listsForEvent(ev.id);
      if (linked.length) return linked[0];
    }
    return null;
  }
  /** Find an item inside a named list column (by column id / kind) */
  function findInNamedListColumn(list, colId, itemId) {
    if (!list) return null;
    normalizeNamedList(list);
    var col = getListColumn(list, colId);
    if (col) {
      var idx = (col.items || []).findIndex(function (x) { return String(x.id) === String(itemId); });
      if (idx >= 0) return { list: list, col: col, bucket: col.items, item: col.items[idx], index: idx, colId: col.id };
    }
    // Fallback: scan every column (item may have moved or kind attr stale)
    var found = null;
    (list.columns || []).some(function (c) {
      var i = (c.items || []).findIndex(function (x) { return String(x.id) === String(itemId); });
      if (i >= 0) {
        found = { list: list, col: c, bucket: c.items, item: c.items[i], index: i, colId: c.id };
        return true;
      }
      return false;
    });
    return found;
  }
  function eventNameById(eventId) {
    if (!eventId) return null;
    var e = allEventsCombined().find(function (x) { return String(x.id) === String(eventId); });
    return e ? (e.name || 'Event') : null;
  }
  function findEventById(eventId) {
    if (eventId == null || eventId === '') return null;
    return allEventsCombined().find(function (x) { return String(x.id) === String(eventId); }) || null;
  }
  function listMemberCount(list) {
    if (!list) return 1;
    var members = list.members || [];
    var ids = {};
    members.forEach(function (m) {
      var id = String(m.user_id || m.id || '');
      if (id) ids[id] = true;
    });
    if (list.owner_id) ids[String(list.owner_id)] = true;
    return Math.max(1, Object.keys(ids).length);
  }
  function listIsShared(list) {
    return listMemberCount(list) > 1;
  }
  function makeListInviteCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  function getActiveFreeBucket(preferKind) {
    var store = loadFreeListsStore();
    var named = null;
    if (state.activeNamedListId) {
      named = (store.named || []).find(function (n) { return String(n.id) === String(state.activeNamedListId); }) || null;
    }
    if (!named) {
      var ev0 = activeEvent();
      if (ev0 && ev0.id) {
        var linked0 = listsForEvent(ev0.id);
        if (linked0.length) {
          // Re-fetch from this store so mutations persist on saveFreeListsStore(store)
          named = (store.named || []).find(function (n) { return String(n.id) === String(linked0[0].id); }) || linked0[0];
        }
      }
    }
    if (named) {
      normalizeNamedList(named);
      var k = preferKind || state.listTab || named.kind || (named.columns[0] && named.columns[0].id) || 'todo';
      var col = getListColumn(named, k);
      if (!col && named.columns[0]) {
        col = named.columns[0];
        k = col.id;
      }
      if (!col) return { store: store, scope: 'mine', bucket: [], named: named, kind: k };
      named.buckets[k] = col.items;
      named.items = col.items;
      return { store: store, scope: 'mine', bucket: col.items, named: named, kind: k };
    }
    return { store: store, scope: 'mine', bucket: [], named: null, kind: preferKind || state.listTab || 'todo' };
  }
  function peopleIconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>' +
      '</svg>';
  }

  function emptyLists() {
    return {
      todo: { group: [], personal: {} },
      buy: { group: [], personal: {} },
      bring: { group: [], personal: {} }
    };
  }

  function normalizeEvent(ev) {
    if (!ev) return null;
    ev.state = ev.state || {};
    if (!ev.state.lists) ev.state.lists = emptyLists();
    ['todo', 'buy', 'bring'].forEach(function (k) {
      if (!ev.state.lists[k]) ev.state.lists[k] = { group: [], personal: {} };
      if (!Array.isArray(ev.state.lists[k].group)) ev.state.lists[k].group = [];
      if (!ev.state.lists[k].personal || typeof ev.state.lists[k].personal !== 'object') {
        ev.state.lists[k].personal = {};
      }
      // migrate notes on items
      (ev.state.lists[k].group || []).forEach(function (it) { normalizeNotes(it); });
      Object.keys(ev.state.lists[k].personal || {}).forEach(function (pid) {
        (ev.state.lists[k].personal[pid] || []).forEach(function (it) { normalizeNotes(it); });
      });
    });
    if (!Array.isArray(ev.state.expenses)) ev.state.expenses = [];
    if (!Array.isArray(ev.state.mapPins)) ev.state.mapPins = [];
    // Linked Hunt/Reg map (party or private)
    if (ev.shared_map_id && !ev.sharedMapId) ev.sharedMapId = ev.shared_map_id;
    if (ev.private_map_id && !ev.privateMapId) ev.privateMapId = ev.private_map_id;
    if (ev.map_scope && !ev.mapScope) ev.mapScope = ev.map_scope;
    if (!ev.mapScope) {
      if (ev.sharedMapId) ev.mapScope = 'shared';
      else if (ev.privateMapId) ev.mapScope = 'private';
      else ev.mapScope = 'personal';
    }
    ensureQualifiers(ev);
    return ev;
  }

  /** Populate Create Event “Select map” from Hunt/Reg Supabase membership. */
  function populateCreateMapSelect(selected) {
    var sel = $('create-select-map');
    if (!sel) return;
    var cur = selected || sel.value || 'personal';
    sel.innerHTML =
      '<option value="personal">My personal map (this device / Plan pins)</option>' +
      '<option value="all">No linked map</option>' +
      '<option value="" disabled>—— Loading your maps… ——</option>';
    var client = sb();
    if (!client) {
      sel.innerHTML =
        '<option value="personal">My personal map</option>' +
        '<option value="all">No linked map</option>' +
        '<option value="" disabled>Sign in to load Hunt/Reg maps</option>';
      return;
    }
    var pending = 2;
    function finish() {
      pending--;
      if (pending > 0) return;
      // remove loading row
      for (var i = sel.options.length - 1; i >= 0; i--) {
        if (sel.options[i].disabled && /Loading/i.test(sel.options[i].text)) {
          sel.remove(i);
        }
      }
      var found = false;
      for (var j = 0; j < sel.options.length; j++) {
        if (sel.options[j].value === cur) { sel.selectedIndex = j; found = true; break; }
      }
      if (!found) sel.value = 'personal';
    }
    client.rpc('list_my_private_maps').then(function (res) {
      var rows = (res && res.data) || [];
      if (Array.isArray(rows) && rows.length) {
        var g = document.createElement('option');
        g.disabled = true;
        g.textContent = '—— My private maps (Hunt/Reg) ——';
        sel.appendChild(g);
        rows.forEach(function (m) {
          if (!m || !m.id) return;
          var o = document.createElement('option');
          o.value = 'private:' + m.id;
          o.textContent = 'Private: ' + (m.name || 'Map');
          if (m.name) o.setAttribute('data-map-name', m.name);
          sel.appendChild(o);
        });
      }
      finish();
    }).catch(function () { finish(); });
    client.rpc('list_my_shared_maps').then(function (res) {
      var rows = (res && res.data) || [];
      if (Array.isArray(rows) && rows.length) {
        var g = document.createElement('option');
        g.disabled = true;
        g.textContent = '—— Shared maps you are on ——';
        sel.appendChild(g);
        rows.forEach(function (m) {
          if (!m || !m.id) return;
          var o = document.createElement('option');
          o.value = 'shared:' + m.id;
          o.textContent = 'Shared: ' + (m.name || 'Map') + (m.code ? (' · ' + m.code) : '');
          if (m.name) o.setAttribute('data-map-name', m.name);
          sel.appendChild(o);
        });
      }
      finish();
    }).catch(function () { finish(); });
  }

  function parseCreateMapSelectValue(v) {
    v = String(v || 'personal');
    if (v.indexOf('shared:') === 0) {
      return { mapScope: 'shared', sharedMapId: v.slice(7), privateMapId: null };
    }
    if (v.indexOf('private:') === 0) {
      return { mapScope: 'private', sharedMapId: null, privateMapId: v.slice(8) };
    }
    return { mapScope: v === 'all' ? 'all' : 'personal', sharedMapId: null, privateMapId: null };
  }

  function applyMapLinkToEvent(ev, link) {
    if (!ev || !link) return;
    ev.mapScope = link.mapScope || 'personal';
    ev.sharedMapId = link.sharedMapId || null;
    ev.privateMapId = link.privateMapId || null;
    ev.shared_map_id = ev.sharedMapId;
    ev.private_map_id = ev.privateMapId;
    ev.map_scope = ev.mapScope;
    var sel = $('create-select-map');
    if (sel && sel.selectedOptions && sel.selectedOptions[0]) {
      var nm = sel.selectedOptions[0].getAttribute('data-map-name') ||
        String(sel.selectedOptions[0].textContent || '').replace(/^(Shared|Private):\s*/, '').split(' · ')[0];
      if (ev.sharedMapId || ev.privateMapId) ev.linkedMapName = nm;
      else ev.linkedMapName = null;
    }
  }

  /**
   * When opening a Plan event, open the linked Hunt/Reg map (pull pins into Plan map overlay).
   */
  function openLinkedMapForEvent(ev) {
    if (!ev) return Promise.resolve(false);
    var client = sb();
    var mapId = ev.sharedMapId || ev.privateMapId;
    var kind = ev.sharedMapId ? 'shared' : (ev.privateMapId ? 'private' : null);
    if (!client || !mapId || !kind) {
      // Still open Plan map for event pins
      if (ev.lat != null || (ev.state && ev.state.mapPins && ev.state.mapPins.length)) {
        setMapMode(state.mapMode === 'button' ? 'mini' : state.mapMode);
      }
      return Promise.resolve(false);
    }
    var table = kind === 'shared' ? 'shared_maps' : 'private_maps';
    return client.from(table).select('id, name, map_state').eq('id', mapId).maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) {
          appToast('Linked map not found (join it on Hunt/Reg first)');
          return false;
        }
        var st = res.data.map_state || {};
        var pins = Array.isArray(st.pins) ? st.pins : [];
        state._linkedMapOverlay = {
          mapId: String(mapId),
          kind: kind,
          name: res.data.name || ev.linkedMapName || 'Map',
          pins: pins,
          eventId: String(ev.id)
        };
        state.mapContext = 'event:' + ev.id;
        state.showAllPins = false;
        // Align on-map switcher chip with linked Hunt/Reg map
        applyViewingMapState(kind, mapId, res.data.name || ev.linkedMapName || 'Map', {
          pins: pins,
          customAreas: (st.customAreas || [])
        });
        setMapMode(state.mapMode === 'button' ? 'mini' : (state.mapMode || 'mini'));
        try { configurePlanMap(); if (window.PlanMap) { window.PlanMap.ensure(); window.PlanMap.redraw(); } } catch (eM) {}
        if (ev.lat != null && ev.lng != null && window.PlanMap && window.PlanMap.getMap) {
          try {
            var map = window.PlanMap.getMap();
            if (map) map.setView([Number(ev.lat), Number(ev.lng)], 13);
          } catch (eV) {}
        }
        appToast('Opened map: ' + (state._linkedMapOverlay.name || 'linked'));
        return true;
      }).catch(function (e) {
        console.warn('openLinkedMapForEvent', e);
        return false;
      });
  }

  function activeEvent() {
    var found = state.events.find(function (e) { return String(e.id) === String(state.activeEventId); });
    if (found) return found;
    if (!state.activeEventId) return null;
    var pe = (loadPersonalBoard().events || []).find(function (e) {
      return String(e.id) === String(state.activeEventId);
    });
    return pe ? normalizeEvent(Object.assign({}, pe, { _personalOnly: true })) : null;
  }

  function settleBalances(members, expenses) {
    var ids = members.map(function (m) { return m.id; });
    var paid = {}, owed = {};
    ids.forEach(function (id) { paid[id] = 0; owed[id] = 0; });
    expenses.forEach(function (ex) {
      var amt = Number(ex.amount) || 0;
      if (amt <= 0 || !ex.payerId) return;
      if (paid[ex.payerId] == null) paid[ex.payerId] = 0;
      paid[ex.payerId] += amt;
      var share = (ex.shareWith && ex.shareWith.length) ? ex.shareWith.slice() : ids.slice();
      share = share.filter(function (id) { return ids.indexOf(id) >= 0; });
      if (!share.length) share = ids.slice();
      var each = amt / share.length;
      share.forEach(function (id) {
        if (owed[id] == null) owed[id] = 0;
        owed[id] += each;
      });
    });
    var debtors = [], creditors = [];
    ids.forEach(function (id) {
      var n = Math.round(((paid[id] || 0) - (owed[id] || 0)) * 100) / 100;
      if (n < -0.009) debtors.push({ id: id, amt: -n });
      else if (n > 0.009) creditors.push({ id: id, amt: n });
    });
    debtors.sort(function (a, b) { return b.amt - a.amt; });
    creditors.sort(function (a, b) { return b.amt - a.amt; });
    var transfers = [];
    var i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      var pay = Math.min(debtors[i].amt, creditors[j].amt);
      pay = Math.round(pay * 100) / 100;
      if (pay > 0) {
        transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
        debtors[i].amt = Math.round((debtors[i].amt - pay) * 100) / 100;
        creditors[j].amt = Math.round((creditors[j].amt - pay) * 100) / 100;
      }
      if (debtors[i].amt < 0.01) i++;
      if (creditors[j].amt < 0.01) j++;
    }
    return transfers;
  }

  function memberLabel(id) {
    var m = state.members.find(function (x) { return String(x.user_id || x.id) === String(id); });
    if (m) return m.display_name || m.username || 'Member';
    if (String(id) === String(myId())) return myName();
    return String(id).slice(0, 8);
  }
  function memberColor(id) {
    var m = state.members.find(function (x) { return String(x.user_id || x.id) === String(id); });
    if (m && m.arrow_color) return softenColor(m.arrow_color);
    if (String(id) === String(myId())) return myColor();
    var idx = Math.abs(String(id).split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0)) % COLORS.length;
    return COLORS[idx];
  }

  /** owner or co-creator (role owner|creator) can change event location & grant privileges */
  function isEventCreator(ev, userId) {
    if (!ev) return false;
    userId = userId != null ? userId : myId();
    if (!userId) return false;
    if (String(ev.owner_user_id) === String(userId)) return true;
    var creators = (ev.state && Array.isArray(ev.state.creators)) ? ev.state.creators : [];
    if (creators.some(function (c) { return String(c) === String(userId); })) return true;
    if (String(ev.id) === String(state.activeEventId)) {
      var m = (state.members || []).find(function (x) {
        return String(x.user_id || x.id) === String(userId);
      });
      if (m && (m.role === 'owner' || m.role === 'creator')) return true;
    }
    return false;
  }

  function isListCreator(namedList, userId) {
    if (!namedList) return false;
    userId = userId != null ? userId : myId();
    if (!userId) return false;
    if (String(namedList.owner_id || namedList.created_by) === String(userId)) return true;
    var creators = Array.isArray(namedList.creators) ? namedList.creators : [];
    return creators.some(function (c) { return String(c) === String(userId); });
  }

  async function grantEventCreatorRole(memberId) {
    var ev = activeEvent();
    if (!ev || ev._personalOnly) { appToast('Open a shared event first'); return; }
    if (!isEventCreator(ev)) {
      appAlert('Only creators can grant creator privileges.', 'Creators');
      return;
    }
    if (String(memberId) === String(myId())) { appToast('You already have creator access'); return; }
    var m = (state.members || []).find(function (x) { return String(x.user_id) === String(memberId); });
    if (!m) { appToast('Member not found'); return; }
    if (m.role === 'owner' || m.role === 'creator') {
      appToast((m.display_name || 'Member') + ' already has creator privileges');
      return;
    }
    var ok = await appConfirm(
      'Grant creator privileges to ' + (m.display_name || m.username || 'this member') +
      '? They will be able to set the event location and manage creator settings.',
      'Grant creator'
    );
    if (!ok) return;
    m.role = 'creator';
    if (!ev.state) ev.state = {};
    if (!Array.isArray(ev.state.creators)) ev.state.creators = [];
    if (!ev.state.creators.some(function (c) { return String(c) === String(memberId); })) {
      ev.state.creators.push(memberId);
    }
    saveActiveEvent();
    // Persist role to Supabase when available
    try {
      var client = sb();
      if (client && !ev._localOnly) {
        await client.from('plan_event_members')
          .update({ role: 'creator' })
          .eq('event_id', ev.id)
          .eq('user_id', memberId);
      }
    } catch (e) { console.warn('grant creator cloud', e); }
    appToast('Creator privileges granted');
    render();
  }

  async function revokeEventCreatorRole(memberId) {
    var ev = activeEvent();
    if (!ev || !isEventCreator(ev)) return;
    if (String(memberId) === String(ev.owner_user_id)) {
      appAlert('Cannot remove the original host’s creator role.', 'Creators');
      return;
    }
    var m = (state.members || []).find(function (x) { return String(x.user_id) === String(memberId); });
    if (!m) return;
    var ok = await appConfirm('Remove creator privileges from ' + (m.display_name || 'member') + '?', 'Remove creator');
    if (!ok) return;
    m.role = 'member';
    if (ev.state && Array.isArray(ev.state.creators)) {
      ev.state.creators = ev.state.creators.filter(function (c) { return String(c) !== String(memberId); });
    }
    saveActiveEvent();
    try {
      var client = sb();
      if (client && !ev._localOnly) {
        await client.from('plan_event_members')
          .update({ role: 'member' })
          .eq('event_id', ev.id)
          .eq('user_id', memberId);
      }
    } catch (e) {}
    appToast('Creator privileges removed');
    render();
  }

  function grantListCreatorRole(memberId) {
    var free = getActiveFreeBucket();
    if (!free || !free.named) { appToast('Open a named list first'); return; }
    if (!isListCreator(free.named)) {
      appAlert('Only list creators can grant privileges.', 'Creators');
      return;
    }
    if (!Array.isArray(free.named.creators)) free.named.creators = [];
    if (free.named.creators.some(function (c) { return String(c) === String(memberId); })) {
      appToast('Already a list creator');
      return;
    }
    free.named.creators.push(memberId);
    if (!Array.isArray(free.named.members)) free.named.members = [];
    saveFreeListsStore(free.store);
    appToast('List creator privileges granted');
    render();
  }

  function persistLocal(opts) {
    opts = opts || {};
    // Drop tombstoned events so they cannot reappear from stale state
    try {
      var dead = loadTombstones().events;
      state.events = (state.events || []).filter(function (e) { return e && !dead[String(e.id)]; });
    } catch (e) {}
    saveJson(LOCAL_EVENTS_KEY, state.events);
    if (!opts.quiet) broadcastSync({ type: 'events-save' });
  }

  async function cloudListEvents() {
    var client = sb();
    var user = me();
    if (!client || !user) return null;
    try {
      var res = await client.rpc('list_my_plan_events');
      if (res.error) return null;
      return (res.data || []).map(normalizeEvent);
    } catch (e) { return null; }
  }

  async function cloudSaveEvent(ev) {
    var client = sb();
    var user = me();
    if (!client || !user || !ev || ev._localOnly) return;
    try {
      await client.from('plan_events').update({
        name: ev.name,
        event_type: ev.event_type,
        start_at: ev.start_at,
        end_at: ev.end_at || null,
        location_label: ev.location_label || null,
        lat: ev.lat != null ? ev.lat : null,
        lng: ev.lng != null ? ev.lng : null,
        state: ev.state,
        updated_at: new Date().toISOString()
      }).eq('id', ev.id);
    } catch (e) { console.warn('cloudSaveEvent', e); }
  }

  function saveActiveEvent() {
    var ev = activeEvent();
    if (!ev) return;
    ev.updated_at = new Date().toISOString();
    persistLocal();
    cloudSaveEvent(ev);
    // Keep Hunt/Reg calendar + View list packs in sync when the event changes
    try {
      var pack = null;
      try {
        var linked = listsForEvent(ev.id);
        pack = linked && linked[0] ? linked[0] : null;
      } catch (eL) {}
      if (!pack) {
        try { pack = ensureAssociatedListForEvent(ev); } catch (eA) {}
      }
      dualWriteHuntCalendarEvent(ev, pack);
    } catch (eDw) {}
  }

  async function loadEvents() {
    var deadEv = loadTombstones().events;
    var local = loadJson(LOCAL_EVENTS_KEY, []);
    if (!Array.isArray(local)) local = [];
    state.events = local.filter(function (e) { return e && !deadEv[String(e.id)]; }).map(normalizeEvent);
    var cloud = await cloudListEvents();
    if (cloud && cloud.length) {
      var byId = {};
      state.events.forEach(function (e) { byId[e.id] = e; });
      cloud.forEach(function (e) {
        if (!e || deadEv[String(e.id)]) return; // respect local delete tombstones
        var prev = byId[e.id];
        if (!prev || new Date(e.updated_at || 0) >= new Date(prev.updated_at || 0)) {
          byId[e.id] = normalizeEvent(e);
        }
      });
      // Remove tombstoned ids that may have been in byId from earlier
      Object.keys(deadEv).forEach(function (id) { delete byId[id]; });
      state.events = Object.keys(byId).map(function (k) { return byId[k]; });
      persistLocal({ quiet: true });
    }
    // Cross-origin re-sync from Hunt/Reg Supabase calendar (same login)
    try {
      var sync = await pullHuntCalendarFromCloud();
      if (sync && sync.added > 0) {
        appToast('Synced ' + sync.added + ' event' + (sync.added === 1 ? '' : 's') + ' from Hunt/Reg');
      }
    } catch (ePull) {
      console.warn('pullHuntCalendarFromCloud', ePull);
      // Same-origin fallback (only works if user used Plan in same browser as Hunt)
      try {
        var nImp = importHuntCalendarEvents();
        if (nImp) appToast('Imported ' + nImp + ' event' + (nImp === 1 ? '' : 's') + ' from Hunt/Reg');
      } catch (eImp) {}
    }
    // Ensure every plan event has a linked list pack + personal claim list
    state.events.forEach(function (e) {
      try { applyCloudListPackToLocal(e); } catch (eA) {
        try { ensureAssociatedListForEvent(e); } catch (e2) {}
      }
    });
    // Phone/desktop parity: rebuild My checklist + Personal {Event} from shared claims
    try { rebuildAllMyChecklistsFromClaims(); } catch (eRbAll) {}
    fillTypeDatalist();
    render();
    // Refresh party location dots from cloud event.state.shareLocations
    try {
      if (window.PlanMap && typeof window.PlanMap.redraw === 'function') window.PlanMap.redraw();
    } catch (eMap) {}
  }

  /** Manual / visibility re-sync for mobile when Hunt has events Plan doesn't */
  async function resyncHuntEventsNow(opts) {
    opts = opts || {};
    try {
      var sync = await pullHuntCalendarFromCloud();
      fillTypeDatalist();
      // Quiet background sync must not wipe list add inputs mid-type
      if (opts.quiet) renderUnlessTypingInListAdd();
      else render();
      if (opts.quiet) return sync;
      var n = (sync && sync.added) || 0;
      var p = (sync && sync.pulled) || 0;
      if (n > 0) appToast('Synced ' + n + ' new event' + (n === 1 ? '' : 's') + ' from Hunt');
      else if (p > 0) appToast('Re-synced Hunt calendar (' + p + ' rows)');
      else appToast('Hunt calendar up to date — open Hunt while logged in if missing');
      return sync;
    } catch (e) {
      console.warn('resyncHuntEventsNow', e);
      if (!opts.quiet) appToast('Could not sync from Hunt — check login');
      return { added: 0, pulled: 0 };
    }
  }

  function fillTypeDatalist() {
    var dl = $('event-type-list');
    if (!dl) return;
    var types = {};
    state.events.forEach(function (e) {
      if (e.event_type) types[String(e.event_type).toLowerCase()] = e.event_type;
    });
    loadJson(LOCAL_SAVED_KEY, []).forEach(function (s) {
      if (s.event_type) types[String(s.event_type).toLowerCase()] = s.event_type;
    });
    dl.innerHTML = Object.keys(types).map(function (k) {
      return '<option value="' + esc(types[k]) + '">';
    }).join('');
  }

  function applyTemplateToEvent(ev, eventType) {
    var saved = loadJson(LOCAL_SAVED_KEY, []);
    var type = String(eventType || '').toLowerCase();
    ['todo', 'buy', 'bring'].forEach(function (kind) {
      var pack = saved.filter(function (s) {
        return s.list_kind === kind && String(s.event_type || '').toLowerCase() === type;
      }).sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); })[0];
      if (pack && Array.isArray(pack.items) && pack.items.length) {
        ev.state.lists[kind].group = pack.items.map(function (it) {
          return Object.assign({}, newItem(it.title || 'Item', {
            qty: it.qty || 1,
            notes: it.notes || '',
            priority: it.priority || 0
          }));
        });
      }
    });
  }

  /** Every event gets a linked To do / To buy / To bring list pack — unless user deleted that pack */
  function ensureAssociatedListForEvent(ev) {
    if (!ev || !ev.id) return null;
    var eid = String(ev.id);
    // User deleted the event or its list pack — do not resurrect
    if (isTombstoned('event', eid) || isTombstoned('eventList', eid)) {
      return null;
    }
    var existing = listsForEvent(eid).filter(function (n) {
      return n && !isTombstoned('list', n.id);
    });
    var pack = null;
    if (existing.length) {
      pack = existing[0];
    } else {
      var store = loadFreeListsStore();
      // Double-check store after tombstone filter
      var still = (store.named || []).filter(function (n) {
        return n && n.eventId && String(n.eventId) === eid && !isTombstoned('list', n.id) &&
          !isPersonalEventShadowList(n);
      });
      if (still.length) {
        pack = still[0];
      } else {
        var nl = normalizeNamedList({
          id: uid(),
          name: (ev.name || 'Event') + ' · lists',
          kind: 'todo',
          items: [],
          buckets: { todo: [], buy: [], bring: [] },
          columnOrder: ['todo', 'buy', 'bring'],
          eventId: eid,
          owner_id: myId() || 'local',
          creators: [],
          members: [{
            user_id: myId() || 'local',
            display_name: myName(),
            role: 'owner'
          }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        // Seed from event packing lists into column items (not just buckets — columns win on reload)
        try {
          if (ev.state && ev.state.lists) {
            ['todo', 'buy', 'bring'].forEach(function (k) {
              var group = (ev.state.lists[k] && ev.state.lists[k].group) || [];
              if (Array.isArray(group) && group.length) {
                var seeded = group.map(function (it) {
                  return Object.assign({}, it, { id: it.id || uid() });
                });
                var col = getListColumn(nl, k);
                if (col) col.items = seeded;
                nl.buckets[k] = seeded;
              }
            });
            normalizeNamedList(nl);
          }
        } catch (eS) {}
        store.named = store.named || [];
        store.named.push(nl);
        saveFreeListsStore(store);
        try { publishEventListBridge(nl); } catch (eP) {}
        pack = findNamedListById(nl.id) || nl;
      }
    }
    // Always ensure a non-shared Personal {Event} list exists for claims
    try { ensurePersonalEventList(ev, pack); } catch (ePers) {
      console.warn('ensurePersonalEventList on pack', ePers);
    }
    return pack;
  }

  /** Link a personal list to an event (combine) */
  function combineListWithEvent(listId, eventId) {
    var list = findNamedListById(listId);
    var ev = (state.events || []).find(function (e) { return String(e.id) === String(eventId); });
    if (!list || !ev) return false;
    normalizeNamedList(list);
    // User is explicitly linking — allow a pack for this event again
    clearTombstone('eventList', ev.id);
    clearTombstone('list', list.id);
    list.eventId = String(ev.id);
    if (!list.name || list.name === 'Untitled list') list.name = (ev.name || 'Event') + ' · lists';
    saveNamedList(list);
    return true;
  }

  async function createEvent(name, eventType, startAt, useTemplate) {
    var user = me();
    if (!user) return;
    var client = sb();
    var ev = null;
    if (client) {
      try {
        var res = await client.rpc('create_plan_event', {
          p_name: name,
          p_event_type: eventType || 'general',
          p_start_at: startAt || null
        });
        if (!res.error && res.data) {
          ev = normalizeEvent(Array.isArray(res.data) ? res.data[0] : res.data);
        }
      } catch (e) { console.warn(e); }
    }
    if (!ev) {
      ev = normalizeEvent({
        id: uid(),
        owner_user_id: user.id,
        name: name || 'Untitled event',
        event_type: eventType || 'general',
        start_at: startAt || null,
        invite_code: String(Math.floor(100000 + Math.random() * 900000)),
        state: { lists: emptyLists(), expenses: [], mapPins: [] },
        updated_at: new Date().toISOString(),
        _localOnly: true
      });
    }
    if (useTemplate) applyTemplateToEvent(ev, eventType);
    state.events.unshift(ev);
    persistLocal();
    await cloudSaveEvent(ev);
    var pack = ensureAssociatedListForEvent(ev);
    try { if (pack) publishEventListBridge(pack); } catch (eB) {}
    try { dualWriteHuntCalendarEvent(ev, pack); } catch (eH) {}
    openEvent(ev.id);
    return ev;
  }

  /** Mirror Plan events into Hunt/Reg calendar storage so View list works there. */
  function dualWriteHuntCalendarEvent(ev, list) {
    if (!ev || !ev.id) return;
    var start = null;
    var end = null;
    try {
      if (ev.start_at) {
        var d = new Date(ev.start_at);
        if (!isNaN(d.getTime())) start = localYmd(d);
      }
      if (ev.end_at) {
        var d2 = new Date(ev.end_at);
        if (!isNaN(d2.getTime())) end = localYmd(d2);
      }
    } catch (eD) {}
    if (!start) start = localYmd(new Date());
    if (!end) end = start;
    var raw = [];
    try { raw = JSON.parse(localStorage.getItem(HUNT_CAL_EVENTS_KEY) || '[]'); } catch (e) { raw = []; }
    if (!Array.isArray(raw)) raw = [];
    var huntId = ev.hunt_event_id || ('plan_' + ev.id);
    ev.hunt_event_id = huntId;
    var packSnapshot = null;
    if (list) {
      try {
        list.eventId = String(ev.id);
        publishEventListBridge(Object.assign({}, list, { eventId: ev.id }));
        var bag = loadJson(SLAYER_EVENT_LISTS_KEY, null) || {};
        if (bag[String(ev.id)]) {
          bag['hunt:' + huntId] = bag[String(ev.id)];
          bag[String(ev.id)].huntEventId = huntId;
          saveJson(SLAYER_EVENT_LISTS_KEY, bag);
          packSnapshot = bag[String(ev.id)];
        }
      } catch (eP) {}
    }
    var row = {
      id: huntId,
      text: ev.name || 'Event',
      color: (ev.state && ev.state.color) || '#e59a18',
      startDate: start,
      endDate: end,
      mapScope: ev.mapScope || 'personal',
      sharedMapId: ev.sharedMapId || null,
      privateMapId: ev.privateMapId || null,
      lat: ev.lat != null ? ev.lat : null,
      lng: ev.lng != null ? ev.lng : null,
      locationLabel: ev.location_label || null,
      planEventId: String(ev.id),
      planListId: list && list.id ? String(list.id) : (ev.planListId || null),
      inviteCode: ev.invite_code || null,
      members: (ev.state && ev.state.localMembers) || [],
      listPack: packSnapshot,
      updatedAt: new Date().toISOString(),
      _fromPlanSlayer: true
    };
    var idx = raw.findIndex(function (x) { return x && String(x.id) === String(huntId); });
    if (idx >= 0) raw[idx] = Object.assign({}, raw[idx], row);
    else raw.push(row);
    try { localStorage.setItem(HUNT_CAL_EVENTS_KEY, JSON.stringify(raw)); } catch (eW) {}
    // Best-effort cloud mirror so Hunt/Reg (other origins) can pull list packs
    try { dualWriteHuntCalendarCloud(row, packSnapshot); } catch (eC) {}
  }

  function dualWriteHuntCalendarCloud(row, pack) {
    var client = sb();
    var user = me();
    if (!client || !user || !row) return;
    var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(row.id));
    var payload = {
      creator_user_id: user.id,
      name: row.text || 'Event',
      color: row.color || '#e59a18',
      start_date: row.startDate,
      end_date: row.endDate || row.startDate,
      map_scope: row.mapScope || 'personal',
      shared_map_id: row.sharedMapId || null,
      lat: row.lat,
      lng: row.lng,
      location_label: row.locationLabel || null,
      hunt_link: {
        planEventId: row.planEventId || null,
        planListId: row.planListId || null,
        inviteCode: row.inviteCode || null,
        members: row.members || [],
        listPack: pack || row.listPack || null,
        fromPlanSlayer: true,
        privateMapId: row.privateMapId || null
      },
      updated_at: new Date().toISOString()
    };
    if (isUuid) {
      payload.id = row.id;
      client.from('map_calendar_events').upsert(payload).then(function () {}).catch(function () {});
    } else {
      // Local plan_* ids aren't UUIDs — insert once, remember returned id
      var insertRow = Object.assign({}, payload);
      client.from('map_calendar_events').insert(insertRow).select('id').maybeSingle()
        .then(function (res) {
          if (res && res.data && res.data.id) {
            var ev = findEventById(row.planEventId);
            if (ev) {
              ev.hunt_event_id = res.data.id;
              try { persistLocal(); } catch (eP) {}
            }
            // rewrite local dual-write id for next time
            try {
              var raw = JSON.parse(localStorage.getItem(HUNT_CAL_EVENTS_KEY) || '[]') || [];
              var i = raw.findIndex(function (x) { return x && String(x.id) === String(row.id); });
              if (i >= 0) {
                raw[i].id = res.data.id;
                localStorage.setItem(HUNT_CAL_EVENTS_KEY, JSON.stringify(raw));
              }
            } catch (eR) {}
          }
        }).catch(function () {});
    }
  }

  function huntEventStartEnd(he) {
    var start = he.startDate || he.start_date || he.date || null;
    var end = he.endDate || he.end_date || start;
    var startAt = start ? (String(start).length === 10 ? start + 'T12:00:00' : String(start)) : null;
    var endAt = end ? (String(end).length === 10 ? end + 'T12:00:00' : String(end)) : null;
    return { startAt: startAt, endAt: endAt };
  }
  /** Apply Hunt listPack (or bridge pack) onto a Plan event + free list store */
  function applyHuntListPackToPlanEvent(ev, he) {
    if (!ev || !ev.id) return null;
    var pack = null;
    if (he) {
      pack = he.listPack || he.list_pack || null;
      if (!pack && he.hunt_link) pack = he.hunt_link.listPack || null;
    }
    // Bridge bag (same-origin only, but also filled by cloud pull below)
    if (!pack || !pack.columns) {
      try {
        var bag = loadJson(SLAYER_EVENT_LISTS_KEY, null) || {};
        var huntId = he && he.id ? String(he.id) : (ev.hunt_event_id || '');
        pack = bag[String(ev.id)] ||
          (huntId ? bag['hunt:' + huntId] : null) ||
          (ev.planListId ? bag['list:' + String(ev.planListId)] : null) ||
          pack;
      } catch (eB) {}
    }
    if (pack && pack.columns && pack.columns.length) {
      if (!ev.state) ev.state = {};
      ev.state.namedListPack = {
        listId: pack.listId || null,
        name: pack.name || ((ev.name || 'Event') + ' · lists'),
        members: pack.members || [],
        columns: pack.columns,
        invite_code: pack.invite_code || null,
        updated_at: pack.updated_at || he.updatedAt || he.updated_at || new Date().toISOString()
      };
      // Also seed classic buckets from columns so empty-items heal works
      if (!ev.state.lists) ev.state.lists = emptyLists();
      (pack.columns || []).forEach(function (c) {
        if (!c || !c.id) return;
        if (['todo', 'buy', 'bring'].indexOf(String(c.id)) < 0) return;
        if (!ev.state.lists[c.id]) ev.state.lists[c.id] = { group: [], personal: {} };
        if (Array.isArray(c.items) && c.items.length) {
          ev.state.lists[c.id].group = c.items.map(function (it) {
            return Object.assign({}, it, { id: it.id || uid() });
          });
        }
      });
      try { applyCloudListPackToLocal(ev); } catch (eA) {}
    }
    var list = null;
    try { list = ensureAssociatedListForEvent(ev); } catch (eE) {}
    return list;
  }
  /**
   * Pull Hunt/Reg calendar events from localStorage (same browser origin only)
   * into PlanSlayer. Also re-syncs names/dates/list packs for already-imported events.
   */
  function importHuntCalendarEvents() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(HUNT_CAL_EVENTS_KEY) || '[]'); } catch (e) { raw = []; }
    if (!Array.isArray(raw) || !raw.length) return 0;
    var map = {};
    try { map = JSON.parse(localStorage.getItem(HUNT_IMPORT_MAP_KEY) || '{}') || {}; } catch (e2) { map = {}; }
    var added = 0;
    var updated = 0;
    raw.forEach(function (he) {
      if (!he || !he.id) return;
      var huntId = String(he.id);
      var existingEv = null;
      if (map[huntId]) {
        existingEv = state.events.find(function (e) { return String(e.id) === String(map[huntId]); }) || null;
      }
      if (!existingEv) {
        existingEv = state.events.find(function (e) {
          return e.hunt_event_id && String(e.hunt_event_id) === huntId;
        }) || null;
      }
      // Match by planEventId stamped on Hunt row
      if (!existingEv && (he.planEventId || he.plan_event_id)) {
        var pid = he.planEventId || he.plan_event_id;
        existingEv = state.events.find(function (e) { return String(e.id) === String(pid); }) || null;
      }
      // Match by name (e.g. Gator Hunt)
      if (!existingEv) {
        var hn = String(he.text || he.name || he.title || '').trim().toLowerCase();
        if (hn) {
          existingEv = state.events.find(function (e) {
            return e && String(e.name || '').trim().toLowerCase() === hn;
          }) || null;
        }
      }

      var se = huntEventStartEnd(he);
      if (existingEv) {
        map[huntId] = existingEv.id;
        existingEv.hunt_event_id = huntId;
        var nameIn = he.text || he.name || he.title;
        if (nameIn) existingEv.name = nameIn;
        if (se.startAt) existingEv.start_at = se.startAt;
        if (se.endAt) existingEv.end_at = se.endAt;
        if (he.lat != null) existingEv.lat = Number(he.lat);
        if (he.lng != null) existingEv.lng = Number(he.lng);
        if (he.locationLabel || he.location_label) {
          existingEv.location_label = he.locationLabel || he.location_label;
        }
        if (he.color) {
          if (!existingEv.state) existingEv.state = {};
          existingEv.state.color = he.color;
        }
        existingEv.updated_at = he.updatedAt || he.updated_at || existingEv.updated_at || new Date().toISOString();
        applyHuntListPackToPlanEvent(existingEv, he);
        updated++;
        return;
      }

      var ev = normalizeEvent({
        id: (he.planEventId || he.plan_event_id) || uid(),
        owner_user_id: myId() || 'local',
        name: he.text || he.name || he.title || 'Hunt event',
        event_type: he.weapon ? String(he.weapon).toLowerCase() : 'hunt',
        start_at: se.startAt,
        end_at: se.endAt,
        lat: he.lat != null ? Number(he.lat) : null,
        lng: he.lng != null ? Number(he.lng) : null,
        location_label: he.locationLabel || he.location_label || null,
        invite_code: he.inviteCode || he.invite_code || null,
        state: { lists: emptyLists(), expenses: [], mapPins: [], color: he.color || '#e59a18' },
        hunt_event_id: huntId,
        source: 'hunt',
        updated_at: he.updatedAt || he.updated_at || new Date().toISOString(),
        _localOnly: true
      });
      state.events.push(ev);
      map[huntId] = ev.id;
      applyHuntListPackToPlanEvent(ev, he);
      added++;
    });
    if (added || updated) {
      persistLocal({ quiet: true });
      try { localStorage.setItem(HUNT_IMPORT_MAP_KEY, JSON.stringify(map)); } catch (e3) {}
    }
    return added;
  }
  /**
   * Cross-origin re-sync: pull Hunt/Reg map_calendar_events from Supabase into
   * local Hunt key + Plan events/lists. Required because huntslayer.com and
   * planslayer.com do NOT share localStorage.
   */
  async function pullHuntCalendarFromCloud() {
    var client = sb();
    var user = me();
    if (!client || !user) return { added: 0, pulled: 0 };
    var res;
    try {
      res = await client.from('map_calendar_events').select('*');
    } catch (e) {
      console.warn('pullHuntCalendarFromCloud', e);
      return { added: 0, pulled: 0 };
    }
    if (!res || res.error || !Array.isArray(res.data)) {
      if (res && res.error) console.warn('pullHuntCalendarFromCloud error', res.error);
      return { added: 0, pulled: 0 };
    }
    var raw = [];
    try { raw = JSON.parse(localStorage.getItem(HUNT_CAL_EVENTS_KEY) || '[]') || []; } catch (eR) { raw = []; }
    if (!Array.isArray(raw)) raw = [];
    var pulled = 0;
    res.data.forEach(function (row) {
      if (!row || !row.id) return;
      var hl = row.hunt_link || {};
      var he = {
        id: row.id,
        text: row.name || row.text || 'Event',
        name: row.name || row.text || 'Event',
        color: row.color || '#e59a18',
        startDate: row.start_date,
        endDate: row.end_date || row.start_date,
        mapScope: row.map_scope || 'personal',
        sharedMapId: row.shared_map_id || null,
        privateMapId: row.private_map_id || hl.privateMapId || null,
        lat: row.lat,
        lng: row.lng,
        locationLabel: row.location_label || null,
        planEventId: hl.planEventId || null,
        planListId: hl.planListId || null,
        inviteCode: hl.inviteCode || null,
        members: Array.isArray(hl.members) ? hl.members : [],
        listPack: hl.listPack || null,
        updatedAt: row.updated_at || new Date().toISOString(),
        _fromPlanSlayer: !!hl.fromPlanSlayer,
        hunt_link: hl
      };
      var idx = raw.findIndex(function (x) { return x && String(x.id) === String(he.id); });
      if (idx >= 0) {
        var locU = raw[idx].updatedAt || raw[idx].updated_at || 0;
        var cloudU = he.updatedAt || 0;
        if (new Date(cloudU) >= new Date(locU)) {
          raw[idx] = Object.assign({}, raw[idx], he);
          pulled++;
        }
      } else {
        raw.push(he);
        pulled++;
      }
      // Mirror list pack into bridge for this origin
      if (he.listPack && he.listPack.columns) {
        try {
          var bag = loadJson(SLAYER_EVENT_LISTS_KEY, null) || {};
          if (he.planEventId) bag[String(he.planEventId)] = he.listPack;
          bag['hunt:' + String(he.id)] = he.listPack;
          if (he.planListId) bag['list:' + String(he.planListId)] = he.listPack;
          bag[String(he.id)] = he.listPack;
          saveJson(SLAYER_EVENT_LISTS_KEY, bag);
        } catch (eBag) {}
      }
    });
    try { localStorage.setItem(HUNT_CAL_EVENTS_KEY, JSON.stringify(raw)); } catch (eW) {}
    var added = 0;
    try { added = importHuntCalendarEvents() || 0; } catch (eI) {}
    // Ensure packs for all plan events after import
    (state.events || []).forEach(function (e) {
      try {
        applyCloudListPackToLocal(e);
        ensureAssociatedListForEvent(e);
      } catch (eA) {}
    });
    try { persistLocal({ quiet: true }); } catch (eP) {}
    return { added: added, pulled: pulled };
  }

  async function joinEvent(code) {
    var client = sb();
    var user = me();
    if (!user) return;
    code = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) throw new Error('Enter a 6-digit code');
    if (client) {
      var res = await client.rpc('join_plan_event', { p_code: code });
      if (res.error) throw res.error;
      var ev = normalizeEvent(Array.isArray(res.data) ? res.data[0] : res.data);
      if (!state.events.some(function (e) { return e.id === ev.id; })) {
        state.events.unshift(ev);
        persistLocal();
      }
      openEvent(ev.id);
      return ev;
    }
    var found = state.events.find(function (e) { return String(e.invite_code) === code; });
    if (!found) throw new Error('Event not found (cloud required to join remote codes)');
    openEvent(found.id);
    return found;
  }

  async function openEvent(id) {
    state.activeEventId = id;
    state.view = 'event';
    state.leftTab = 'lists';
    state.expandedItemId = null;
    state.moveItemId = null;
    state.noteItemId = null;
    state.filterQualifier = 'all';
    state.membersDrawerKey = 'event:' + String(id);
    state.membersAddOpenKey = null;
    state._skipMembersCollapseOnce = true;
    state._mapFollowedEvent = null;
    state._linkedMapOverlay = null;
    var pe = (loadPersonalBoard().events || []).find(function (e) { return String(e.id) === String(id); });
    var se = state.events.find(function (e) { return String(e.id) === String(id); });
    var ev = se || pe || activeEvent();
    // Associate + open list on the RIGHT before any network await (so UI never stays blank)
    if (ev) {
      try {
        var alist = ensureAssociatedListForEvent(ev);
        if (alist) {
          state.activeNamedListId = alist.id;
          state.listTab = (alist.columns && alist.columns[0] && alist.columns[0].id) || 'todo';
        }
      } catch (eA) {
        console.warn('ensureAssociatedListForEvent', eA);
      }
    }
    // Paint right panel immediately
    try { render(); } catch (eR0) { console.warn('openEvent render', eR0); }

    try {
      if (pe && !se) {
        state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
        state.mode = 'personal';
      } else {
        if (state.mode === 'friends') state.mode = 'shared';
        await loadMembers(id);
        collectFriendsFromMembers();
      }
      if (ev) {
        try { ev._cachedMembers = (state.members || []).slice(); } catch (eM) {}
      }
    } catch (eLoad) {
      console.warn('openEvent members', eLoad);
      if (!state.members || !state.members.length) {
        state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
      }
    }
    // Open linked Hunt/Reg map (pins + data) when event has Select map set
    try {
      if (ev && (ev.sharedMapId || ev.privateMapId)) {
        await openLinkedMapForEvent(ev);
      } else if (ev && (ev.lat != null || (ev.state && ev.state.mapPins && ev.state.mapPins.length))) {
        if (state.mapMode === 'button') setMapMode('mini');
      }
    } catch (eMap) {
      console.warn('open linked map', eMap);
    }
    try { render(); } catch (eR1) { console.warn('openEvent re-render', eR1); }
    if (state.mapMode === 'mini' || state.mapMode === 'max') snapMapToActiveEvent(true);
    if (isMobileLayout()) openMobileListSheet();
  }

  function openMobileListSheet() {
    if (!isMobileLayout()) return;
    state.mobileSheetOpen = true;
    var sheet = $('mobile-list-sheet');
    if (sheet) {
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
    }
    try { document.body.classList.add('mls-open'); } catch (e) {}
    renderMobileListSheet();
  }
  function closeMobileListSheet(keepSelection) {
    state.mobileSheetOpen = false;
    var sheet = $('mobile-list-sheet');
    if (sheet) {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
    }
    try { document.body.classList.remove('mls-open'); } catch (e) {}
    if (!keepSelection) {
      // keep selection on left; just close sheet
    }
  }
  function renderMobileListSheet() {
    var sheet = $('mobile-list-sheet');
    if (!sheet || !state.mobileSheetOpen) return;
    var list = null;
    try {
      list = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null;
    } catch (e) { list = null; }
    var ev = activeEvent();
    if (!list && ev) {
      try {
        list = ensureAssociatedListForEvent(ev);
        if (list) state.activeNamedListId = list.id;
      } catch (e2) {}
    }
    // Heal from raw store if named lookup lost items
    if (list && list.id) {
      try {
        var rawStore = loadFreeListsStoreRaw();
        var rawList = (rawStore.named || []).find(function (n) { return n && String(n.id) === String(list.id); });
        if (rawList) list = sanitizeNamedList(rawList);
      } catch (eRaw) {
        try { list = sanitizeNamedList(list); } catch (eS) {}
      }
    }
    if (!list) {
      if ($('mls-title')) $('mls-title').textContent = 'Lists';
      if ($('mls-tabs')) $('mls-tabs').innerHTML = '';
      if ($('mls-body')) $('mls-body').innerHTML = '<p class="empty">No list open.</p>';
      return;
    }
    sanitizeNamedList(list);
    // Same as desktop: My checklist column + Personal {Event} list for packing packs
    try {
      if (listWantsPersonalChecklist(list) || list.eventId || (ev && ev.id)) {
        ensurePersonalColumn(list);
      }
    } catch (ePcM) {}
    try {
      if (list.eventId || (ev && ev.id) || listWantsPersonalChecklist(list)) {
        var evForP = resolveEventForList(list) || ev;
        if (evForP) ensurePersonalEventList(evForP, list);
        else ensurePersonalEventList(null, list);
      }
    } catch (ePe) {}
    // Once per open: rebuild My checklist / Personal list from live claims (cloud has shared pack)
    try {
      if (!state._healedChecklist) state._healedChecklist = {};
      var healKey = String(list.id || '');
      if (healKey && !state._healedChecklist[healKey]) {
        state._healedChecklist[healKey] = true;
        rebuildMyChecklistFromClaims(list);
      }
    } catch (eRb) {}
    if ($('mls-title')) {
      $('mls-title').textContent = list.name || (ev && ev.name) || 'List';
    }
    // Section jump tabs — include My checklist (was hidden on mobile)
    var tabs = $('mls-tabs');
    if (tabs) {
      var activeTab = state.listTab || (list.columns[0] && list.columns[0].id) || 'todo';
      if (!(list.columns || []).some(function (c) { return String(c.id) === String(activeTab); })) {
        activeTab = list.columns[0] && list.columns[0].id;
        state.listTab = activeTab;
      }
      tabs.innerHTML = (list.columns || []).map(function (c) {
        if (!c) return '';
        var on = String(c.id) === String(activeTab);
        var count = 0;
        try {
          if (String(c.id) === 'personal') {
            count = collectMyClaimedItems(list).length;
          } else {
            var ci = Array.isArray(c.items) ? c.items : [];
            count = ci.filter(function (it) { return it && typeof it === 'object'; }).length;
          }
        } catch (eC) {}
        return '<button type="button" class="mls-tab' + (on ? ' is-active' : '') +
          (String(c.id) === 'personal' ? ' mls-tab-personal' : '') +
          '" data-mls-tab="' + esc(c.id) + '">' + esc(c.name || listKindLabel(c.id)) +
          (count ? (' · ' + count) : '') + '</button>';
      }).join('');
    }
    // Same triad as desktop (CSS stacks columns on narrow screens)
    var body = $('mls-body');
    if (body) {
      var qEv = { state: { qualifiers: DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); }) } };
      try {
        var aevQ = list.eventId ? findEventById(list.eventId) : (ev || null);
        if (aevQ && aevQ.state && aevQ.state.qualifiers) qEv.state.qualifiers = aevQ.state.qualifiers;
      } catch (eQ) {}
      try {
        body.innerHTML = renderListTriad(list, qEv);
        // If triad rendered empty but store has items, force-heal columns from buckets
        if (!body.querySelector('.list-item')) {
          var healed = false;
          (list.columns || []).forEach(function (c) {
            if (!c || !c.id) return;
            if ((!c.items || !c.items.length) && list.buckets && Array.isArray(list.buckets[c.id]) && list.buckets[c.id].length) {
              c.items = list.buckets[c.id].slice();
              healed = true;
            }
          });
          if (healed) {
            try { saveNamedList(list); } catch (eH) {}
            body.innerHTML = renderListTriad(list, qEv);
          }
        }
        if (!body.innerHTML || !body.innerHTML.trim()) {
          body.innerHTML = '<p class="empty">Nothing here yet.</p>';
        }
      } catch (eR) {
        console.warn('renderMobileListSheet triad', eR);
        body.innerHTML = '<p class="empty">Could not render list. Try reopening.</p>';
      }
      try { wireListColumnUi(list); } catch (eW) {}
      // Scroll to active section only when user explicitly changed tab (#76 — no auto jump on refresh)
      try {
        var want = state.listTab;
        if (want && state._scrollListTabOnce) {
          state._scrollListTabOnce = false;
          var colEl = body.querySelector('.list-col[data-col-kind="' + String(want).replace(/"/g, '') + '"]');
          if (colEl && colEl.scrollIntoView) colEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      } catch (eSc) {}
    }
  }

  function openNamedListById(listId, opts) {
    opts = opts || {};
    if (listId == null || listId === '') return false;
    var idStr = String(listId);
    var nl = null;
    try { nl = findNamedListById(idStr); } catch (eF0) { console.warn(eF0); }
    if (!nl) {
      // Scan store raw in case normalize crashed for another list
      try {
        var store = loadJson(LOCAL_FREE_LISTS_KEY, null) || {};
        var raw = (store.named || []).find(function (n) { return n && String(n.id) === idStr; });
        if (raw) {
          try { nl = normalizeNamedList(raw); } catch (eN) { nl = raw; }
        }
      } catch (eF1) {}
    }
    if (!nl) {
      appToast('List not found');
      return false;
    }
    try { normalizeNamedList(nl); } catch (eNorm) { console.warn(eNorm); }
    state.activeNamedListId = String(nl.id);
    state.listTab = (nl.columns && nl.columns[0] && nl.columns[0].id) || 'todo';
    state.expandedItemId = null;
    state.filterQualifier = 'all';
    state.membersDrawerKey = nl.eventId
      ? ('event:' + String(nl.eventId))
      : ('list:' + String(nl.id));
    state.membersAddOpenKey = null;
    state._skipMembersCollapseOnce = true;
    // Keep whichever left tab the user is on (My lists OR My events both open the pack)
    if (opts.leftTab) state.leftTab = opts.leftTab;
    // Do NOT force switch to My events when opening an event-linked pack from My lists
    if (nl.eventId) {
      state.activeEventId = String(nl.eventId);
      state.view = 'event';
    } else {
      // Stay on home / lists when opening a personal pack
      if (state.leftTab !== 'events') {
        state.activeEventId = null;
        state.view = 'home';
      }
    }
    // Seed members from list so left card + right panel have people immediately
    if (Array.isArray(nl.members) && nl.members.length) {
      state.members = nl.members.map(function (m) {
        return {
          user_id: m.user_id,
          display_name: m.display_name || m.username || 'Member',
          username: m.username || '',
          role: m.role || 'member',
          provisional: !!m.provisional,
          arrow_color: m.arrow_color || COLORS[0]
        };
      });
    }
    // Paint list triad first so the right column always fills even if full render fails
    try {
      setRightPanelMode('list');
      if ($('lists-placeholder')) {
        $('lists-placeholder').style.display = 'none';
        $('lists-placeholder').hidden = true;
      }
      if ($('list-detail-bar')) $('list-detail-bar').style.display = '';
      if ($('lists-title')) $('lists-title').textContent = nl.name || 'List';
      if ($('lists-head-actions')) $('lists-head-actions').style.display = '';
    } catch (ePre) {}
    try {
      render();
    } catch (eR) {
      console.warn('openNamedListById render', eR);
      // Force right panel open even if something in the rich UI fails
      try {
        setRightPanelMode('list');
        if ($('ev-list')) {
          $('ev-list').innerHTML = renderListTriad(nl, {
            state: { qualifiers: DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); }) }
          });
          wireListColumnUi(nl);
        }
        if ($('lists-placeholder')) $('lists-placeholder').style.display = 'none';
      } catch (eR2) {
        appToast('Could not open list panel');
        return false;
      }
    }
    if (isMobileLayout()) openMobileListSheet();
    return true;
  }

  function openEditListModal(list) {
    if (!list) return;
    try { normalizeNamedList(list); } catch (eN) {}
    state.activeNamedListId = String(list.id);
    state._editRmConfirm = null;
    if ($('edit-list-name')) $('edit-list-name').value = list.name || '';
    if ($('edit-list-link-event')) {
      $('edit-list-link-event').innerHTML = buildEventLinkOptionsHtml(list.eventId || null);
    }
    if ($('edit-list-show-expense')) {
      // Default off when unset (#59)
      $('edit-list-show-expense').checked = list.showExpense === true;
    }
    if ($('edit-list-chore-color')) {
      $('edit-list-chore-color').value = list.choreColor || DEFAULT_CHORE_COLOR;
    }
    if ($('edit-list-chore-colors')) {
      $('edit-list-chore-colors').innerHTML = choreColorSwatchesHtml(
        list.choreColor || DEFAULT_CHORE_COLOR,
        'data-list-chore-color'
      );
    }
    try { fillEditListMembersPanel(list); } catch (eM) {}
    if ($('edit-list-modal')) {
      $('edit-list-modal').classList.add('is-open');
      $('edit-list-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function closeEditListModal() {
    if ($('edit-list-modal')) {
      $('edit-list-modal').classList.remove('is-open');
      $('edit-list-modal').setAttribute('aria-hidden', 'true');
    }
  }

  function openEditEventModal(ev) {
    if (!ev) return;
    state.activeEventId = ev.id;
    if ($('edit-ev-name')) $('edit-ev-name').value = ev.name || '';
    if ($('edit-ev-type')) $('edit-ev-type').value = ev.event_type || '';
    updateEventDateDisplay(ev);
    if ($('edit-ev-start-btn')) {
      $('edit-ev-start-btn').textContent = ev.start_at
        ? new Date(ev.start_at).toLocaleString() : 'TBD';
    }
    if ($('edit-ev-end-btn')) {
      $('edit-ev-end-btn').textContent = ev.end_at
        ? new Date(ev.end_at).toLocaleString() : 'TBD';
    }
    state._editRmConfirm = null;
    if ($('edit-ev-show-expense')) {
      // Default off when unset (#59)
      $('edit-ev-show-expense').checked = !!(ev.state && ev.state.showExpense === true);
    }
    try { fillEditEventMembersPanel(); } catch (eM) {}
    if ($('edit-event-modal')) {
      $('edit-event-modal').classList.add('is-open');
      $('edit-event-modal').setAttribute('aria-hidden', 'false');
    }
  }

  async function deleteActiveEvent() {
    var ev = activeEvent();
    if (!ev) return;
    var ok = await appConfirm('Delete event “' + (ev.name || 'Event') + '”? Lists linked to it stay as personal packs.', 'Delete event');
    if (!ok) return;
    var eid = String(ev.id);
    markTombstone('event', eid);
    // Cloud delete first so other members drop it on next poll / visibility
    try {
      var client = sb();
      if (client && !ev._personalOnly && !ev._localOnly) {
        await client.from('plan_events').delete().eq('id', ev.id);
      }
    } catch (eCloud) {
      console.warn('cloud delete event', eCloud);
    }
    if (ev._personalOnly) {
      var board = loadPersonalBoard();
      board.events = (board.events || []).filter(function (e) { return String(e.id) !== eid; });
      savePersonalBoard(board);
    } else {
      state.events = (state.events || []).filter(function (e) { return String(e.id) !== eid; });
      persistLocal();
    }
    // Unlink lists from this event (keep the lists)
    try {
      listsForEvent(ev.id).forEach(function (n) {
        n.eventId = null;
        saveNamedList(n);
      });
    } catch (eU) {}
    state.activeEventId = null;
    state.activeNamedListId = null;
    state.view = 'home';
    state.mobileSheetOpen = false;
    if ($('edit-event-modal')) {
      $('edit-event-modal').classList.remove('is-open');
      $('edit-event-modal').setAttribute('aria-hidden', 'true');
    }
    broadcastSync({ type: 'delete-event', id: eid });
    appToast('Event deleted');
    render();
    closeMobileListSheet(true);
  }

  function snapMapToActiveEvent(force) {
    var ev = activeEvent();
    if (!ev || ev.lat == null || ev.lng == null) return;
    if (state.mapMode !== 'mini' && state.mapMode !== 'max') return;
    if (!force && state._mapFollowedEvent === String(ev.id)) return;
    state._mapFollowedEvent = String(ev.id);
    if (window.PlanMap && typeof window.PlanMap.followEventLocation === 'function') {
      window.PlanMap.ensure();
      window.PlanMap.followEventLocation(true);
    } else if (window.PlanMap && window.PlanMap.getMap && window.PlanMap.getMap()) {
      try {
        window.PlanMap.getMap().setView([Number(ev.lat), Number(ev.lng)], 13, { animate: true });
        window.PlanMap.redraw();
      } catch (e) {}
    }
  }

  function eventRemovedMemberIds(ev) {
    if (!ev || !ev.state) return {};
    var bag = {};
    (Array.isArray(ev.state.removedMemberIds) ? ev.state.removedMemberIds : []).forEach(function (id) {
      if (id != null && id !== '') bag[String(id)] = true;
    });
    return bag;
  }
  function markMemberRemoved(ev, memberId) {
    if (!ev) return;
    if (!ev.state) ev.state = {};
    if (!Array.isArray(ev.state.removedMemberIds)) ev.state.removedMemberIds = [];
    var sid = String(memberId);
    if (ev.state.removedMemberIds.indexOf(sid) < 0) ev.state.removedMemberIds.push(sid);
  }
  function unmarkMemberRemoved(ev, memberId) {
    if (!ev || !ev.state || !Array.isArray(ev.state.removedMemberIds)) return;
    var sid = String(memberId);
    ev.state.removedMemberIds = ev.state.removedMemberIds.filter(function (id) { return String(id) !== sid; });
  }
  function isMemberRemoved(ev, memberId) {
    return !!eventRemovedMemberIds(ev)[String(memberId)];
  }
  function syncLocalMembersFromState(ev) {
    if (!ev) return;
    if (!ev.state) ev.state = {};
    ev.state.localMembers = (state.members || []).map(function (m) {
      return {
        user_id: m.user_id,
        display_name: m.display_name,
        username: m.username || '',
        role: m.role || 'member',
        provisional: !!m.provisional,
        arrow_color: m.arrow_color
      };
    });
    try { ev._cachedMembers = (state.members || []).slice(); } catch (e) {}
  }

  async function loadMembers(eventId) {
    state.members = [];
    var evM = state.events.find(function (e) { return String(e.id) === String(eventId); }) ||
      (activeEvent() && String(activeEvent().id) === String(eventId) ? activeEvent() : null);
    var removed = eventRemovedMemberIds(evM);
    var client = sb();
    if (!client || !eventId) {
      state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
      // Prefer localMembers when offline
      try {
        var local0 = (evM && evM.state && Array.isArray(evM.state.localMembers)) ? evM.state.localMembers : [];
        if (local0.length) {
          state.members = local0.filter(function (m) {
            return m && !removed[String(m.user_id)];
          }).map(function (m) { return Object.assign({}, m); });
        }
      } catch (e0) {}
      collectFriendsFromMembers();
      return;
    }
    try {
      var res = await client.from('plan_event_members')
        .select('user_id, role, arrow_color, joined_at')
        .eq('event_id', eventId);
      var rows = res.data || [];
      var ids = rows.map(function (r) { return r.user_id; });
      var profs = {};
      if (ids.length) {
        var pr = await client.from('profiles').select('id, username, display_name, arrow_color').in('id', ids);
        (pr.data || []).forEach(function (p) { profs[p.id] = p; });
      }
      var creatorIds = (evM && evM.state && Array.isArray(evM.state.creators))
        ? evM.state.creators.map(String) : [];
      state.members = rows.filter(function (r) {
        return r && !removed[String(r.user_id)];
      }).map(function (r) {
        var p = profs[r.user_id] || {};
        var role = r.role || 'member';
        if (role === 'member' && creatorIds.indexOf(String(r.user_id)) >= 0) role = 'creator';
        return {
          user_id: r.user_id,
          role: role,
          arrow_color: softenColor(r.arrow_color || p.arrow_color || DEFAULT_ME_COLOR),
          username: p.username,
          display_name: p.display_name || p.username || 'Member'
        };
      });
      if (!state.members.length) {
        state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
      }
      // Merge name-only local members (respect removed denylist)
      try {
        var local = (evM && evM.state && Array.isArray(evM.state.localMembers)) ? evM.state.localMembers : [];
        local.forEach(function (lm) {
          if (!lm) return;
          if (removed[String(lm.user_id)]) return;
          if (state.members.some(function (m) {
            return String(m.user_id) === String(lm.user_id) ||
              String(m.display_name || '').toLowerCase() === String(lm.display_name || '').toLowerCase();
          })) return;
          state.members.push(Object.assign({}, lm));
        });
      } catch (eLoc) {}
      collectFriendsFromMembers();
    } catch (e) {
      state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
    }
  }

  function softenColor(c) {
    c = String(c || DEFAULT_ME_COLOR);
    var low = c.toLowerCase();
    if (low === '#e11d1d' || low === '#ff0000' || low === '#dc2626') return DEFAULT_ME_COLOR;
    if (low === '#2563eb') return '#4a6d9a';
    if (low === '#16a34a') return '#4d7a55';
    return c;
  }

  function getListBucket(ev, kind, scope) {
    var lists = ev.state.lists[kind];
    if (scope === 'group') return lists.group;
    var pid = myId() || 'local';
    if (!lists.personal[pid]) lists.personal[pid] = [];
    return lists.personal[pid];
  }

  function allTitlesForSuggest(ev) {
    var out = [];
    ['todo', 'buy', 'bring'].forEach(function (k) {
      (ev.state.lists[k].group || []).forEach(function (it) {
        if (it.title) out.push({ title: it.title, kind: k, scope: 'group' });
      });
      var pid = myId();
      var pers = (ev.state.lists[k].personal && ev.state.lists[k].personal[pid]) || [];
      pers.forEach(function (it) {
        if (it.title) out.push({ title: it.title, kind: k, scope: 'personal' });
      });
    });
    return out;
  }

  function newItem(title, extras) {
    extras = extras || {};
    return Object.assign({
      id: uid(),
      title: autoCap(title),
      notes: '',
      notesList: [],
      qty: 1,
      priority: 0,
      highlight: false,
      /** Pulse color when highlighted: red | yellow | green (default red) */
      highlight_color: 'red',
      qualifier: 'other',
      shared_expense: false,
      expense_amount: 0,
      expense_share_with: [],
      claims: {},
      due_mode: 'anytime_before',
      due_days: 0,
      created_by: myId(),
      created_at: new Date().toISOString(),
      /** Only list creator can change settings (except notes / got it / $) */
      creator_only_edit: false,
      /** Every list/event member must mark Got it before item is complete */
      require_all: false
    }, extras);
  }

  function membersForCompletion(item) {
    // Prefer open named list members, else event members, else just me
    var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
    var mems = [];
    if (list && Array.isArray(list.members) && list.members.length) {
      mems = list.members.filter(function (m) { return m && (m.user_id || m.display_name); });
    } else if (state.members && state.members.length) {
      mems = state.members.slice();
    }
    if (!mems.length) {
      mems = [{ user_id: myId() || 'local', display_name: myName() || 'Me' }];
    }
    return mems;
  }

  function claimsFilled(item) {
    var need = Math.max(1, Number(item.qty) || 1);
    var total = 0;
    var parts = [];
    Object.keys(item.claims || {}).forEach(function (uid) {
      var q = Number(item.claims[uid]) || 0;
      if (q > 0) {
        total += q;
        parts.push({ uid: uid, qty: q, color: memberColor(uid) });
      }
    });
    return { need: need, total: total, parts: parts, pct: Math.min(100, (total / need) * 100) };
  }

  /** How many units the current user has claimed on this item */
  function myClaimQty(item) {
    if (!item || !item.claims) return 0;
    var me = myId();
    var q = Number(item.claims[me] || 0);
    if (q > 0) return q;
    if (me != null) q = Number(item.claims[String(me)] || 0);
    return q > 0 ? q : 0;
  }

  /** Clear only the current user’s claim entries on an item */
  function clearMyClaimsOnItem(item) {
    if (!item) return;
    if (!item.claims || typeof item.claims !== 'object') item.claims = {};
    var me = myId();
    delete item.claims[me];
    if (me != null) delete item.claims[String(me)];
  }

  /**
   * Full-tile background: multi-stop linear gradient by claim share.
   * Member colors stay visible even when fully grabbed — glow is CSS (is-claimed / is-full).
   */
  function claimFaceStyle(item) {
    var c = claimsFilled(item);
    if (!c.parts.length) {
      return 'background:linear-gradient(180deg,#2a3224 0%,#1a2018 45%,#12160f 100%);';
    }
    var stops = [];
    var at = 0;
    c.parts.forEach(function (p) {
      var w = (p.qty / Math.max(1, c.need)) * 100;
      // If over-claimed, still show proportional member bands
      if (c.total > c.need && c.total > 0) w = (p.qty / c.total) * 100;
      var a = at;
      var b = Math.min(100, at + w);
      stops.push(p.color + ' ' + a.toFixed(1) + '%');
      stops.push(p.color + ' ' + b.toFixed(1) + '%');
      at = b;
    });
    if (at < 99.5) {
      stops.push('#1a2018 ' + at.toFixed(1) + '%');
      stops.push('#12160f 100%');
    }
    return 'background:linear-gradient(90deg,' + stops.join(',') + ');';
  }

  function isItemAccounted(item) {
    if (!item) return false;
    if (item.require_all) {
      var mems = membersForCompletion(item);
      if (!mems.length) {
        var c0 = claimsFilled(item);
        return c0.total >= c0.need;
      }
      return mems.every(function (m) {
        var id = m.user_id || m.id;
        return Number((item.claims || {})[id] || 0) > 0;
      });
    }
    var c = claimsFilled(item);
    return c.total >= c.need;
  }

  function canEditItemSettings(item) {
    if (!item || !item.creator_only_edit) return true;
    var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
    if (list && isNamedListOwner(list)) return true;
    var me = myId();
    if (me && String(item.created_by) === String(me)) return true;
    // Event host can always edit event packing items
    var ev = activeEvent();
    if (ev && isEventCreator(ev)) return true;
    return !me; // offline local-only
  }

  function loadItemTemplates() {
    return loadJson(LOCAL_ITEM_TEMPLATES_KEY, []) || [];
  }
  function saveItemTemplate(item) {
    if (!item || !item.title) return;
    var list = loadItemTemplates();
    var key = String(item.title).toLowerCase().trim();
    list = list.filter(function (t) { return String(t.title || '').toLowerCase().trim() !== key; });
    list.unshift({
      id: uid(),
      title: item.title,
      qty: item.qty || 1,
      priority: item.priority || 0,
      qualifier: item.qualifier || 'other',
      highlight: !!item.highlight,
      highlight_color: item.highlight_color || 'red',
      due_mode: item.due_mode || 'anytime_before',
      due_days: item.due_days || 0,
      creator_only_edit: !!item.creator_only_edit,
      require_all: !!item.require_all,
      shared_expense: !!item.shared_expense,
      notes: '',
      at: new Date().toISOString()
    });
    if (list.length > 80) list = list.slice(0, 80);
    saveJson(LOCAL_ITEM_TEMPLATES_KEY, list);
  }
  function matchItemTemplates(q) {
    q = String(q || '').toLowerCase().trim();
    if (q.length < 2) return [];
    return loadItemTemplates().filter(function (t) {
      return String(t.title || '').toLowerCase().indexOf(q) >= 0;
    }).slice(0, 8);
  }
  function applyItemTemplate(item, tpl) {
    if (!item || !tpl) return;
    item.title = tpl.title || item.title;
    item.qty = tpl.qty || 1;
    item.priority = tpl.priority || 0;
    item.qualifier = tpl.qualifier || 'other';
    item.highlight = !!tpl.highlight;
    item.due_mode = tpl.due_mode || 'anytime_before';
    item.due_days = tpl.due_days || 0;
    item.creator_only_edit = !!tpl.creator_only_edit;
    item.require_all = !!tpl.require_all;
  }
  function saveSectionAsTemplate(list, colId) {
    normalizeNamedList(list);
    var col = getListColumn(list, colId);
    if (!col || !(col.items || []).length) {
      appToast('Nothing to save in this section');
      return;
    }
    var pack = loadJson(LOCAL_SECTION_TEMPLATES_KEY, []) || [];
    pack.unshift({
      id: uid(),
      name: (list.name || 'List') + ' · ' + (col.name || colId),
      list_kind: col.id,
      items: (col.items || []).map(function (it) {
        return {
          title: it.title,
          qty: it.qty,
          priority: it.priority,
          qualifier: it.qualifier || 'other',
          highlight: !!it.highlight,
          due_mode: it.due_mode,
          due_days: it.due_days,
          creator_only_edit: !!it.creator_only_edit,
          require_all: !!it.require_all
        };
      }),
      created_at: new Date().toISOString()
    });
    if (pack.length > 40) pack = pack.slice(0, 40);
    saveJson(LOCAL_SECTION_TEMPLATES_KEY, pack);
    // Also mirror into saved lists for older “templates” UI
    var saved = loadJson(LOCAL_SAVED_KEY, []) || [];
    saved.push({
      id: uid(),
      name: (list.name || 'List') + ' · ' + (col.name || colId),
      event_type: 'plan',
      list_kind: col.id,
      items: pack[0].items,
      created_at: new Date().toISOString()
    });
    saveJson(LOCAL_SAVED_KEY, saved);
    appToast('List section template saved');
  }

  function claimersHtml(item) {
    var c = claimsFilled(item);
    if (!c.parts.length) return '';
    // span (not button) so it can live inside the item face button without nested-button bugs
    return '<div class="li-claimers">' + c.parts.map(function (p) {
      var name = memberLabel(p.uid);
      var q = p.qty > 1 ? (' ×' + p.qty) : '';
      return '<span class="li-claimer" role="button" tabindex="0" data-act="member" data-member-id="' + esc(p.uid) + '" style="color:' +
        p.color + '">' + esc(name) + q + '</span>';
    }).join('') + '</div>';
  }

  function itemsClaimedByMember(uid) {
    var out = [];
    var seen = {};
    var sid = String(uid);
    function pushIt(it, kindLabel) {
      if (!it || !it.id || seen[String(it.id)]) return;
      var q = Number((it.claims || {})[uid] || (it.claims || {})[sid] || 0);
      if (q <= 0) return;
      seen[String(it.id)] = true;
      out.push({ kind: kindLabel || 'bring', title: it.title, qty: q });
    }
    // Named packing list (event or personal)
    try {
      var nlist = findNamedListById(state.activeNamedListId);
      if (!nlist && activeEvent()) {
        var linked = listsForEvent(activeEvent().id);
        nlist = linked[0] || null;
      }
      if (nlist) {
        sanitizeNamedList(nlist);
        (nlist.columns || []).forEach(function (c) {
          if (!c || String(c.id) === 'personal') return;
          (c.items || []).forEach(function (it) {
            pushIt(it, c.name || c.id);
          });
        });
      }
    } catch (eN) {}
    // Legacy event.state.lists buckets
    var ev = activeEvent();
    if (ev && ev.state && ev.state.lists) {
      ['todo', 'buy', 'bring'].forEach(function (kind) {
        try {
          ((ev.state.lists[kind] && ev.state.lists[kind].group) || []).forEach(function (it) {
            pushIt(it, listKindLabel(kind));
          });
        } catch (eG) {}
      });
    }
    return out;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** Live shuttle-style countdown: Dd-HHh-MMm · urgent <24h · happening now during event */
  function countdownParts(startAt, endAt) {
    if (!startAt) return null;
    var start = new Date(startAt).getTime();
    if (isNaN(start)) return null;
    var end = endAt ? new Date(endAt).getTime() : NaN;
    if (isNaN(end)) end = start + (12 * 60 * 60 * 1000); // default 12h window if no end
    var now = Date.now();
    if (now >= start && now <= end) return { mode: 'now' };
    if (now > end) return { mode: 'past' };
    var t = start - now;
    if (t <= 0) return { mode: 'now' };
    var mins = Math.floor(t / 60000);
    var days = Math.floor(mins / (60 * 24));
    var hours = Math.floor((mins % (60 * 24)) / 60);
    var m = mins % 60;
    return {
      mode: 'soon',
      days: days,
      hours: hours,
      mins: m,
      urgent: t <= 24 * 60 * 60 * 1000,
      text: days + 'd-' + pad2(hours) + 'h-' + pad2(m) + 'm'
    };
  }

  function countdownHtml(startAt, endAt) {
    var p = countdownParts(startAt, endAt);
    if (!p) return '';
    if (p.mode === 'now') {
      return '<span class="cd cd-now" title="Happening now">Happening now!</span>';
    }
    if (p.mode === 'past') return '';
    return '<span class="cd cd-live' + (p.urgent ? ' is-urgent' : '') +
      '" data-cd-start="' + esc(startAt) +
      '" data-cd-end="' + esc(endAt || '') +
      '" title="Countdown to start"><span class="cd-tminus">T minus</span> ' + esc(p.text) + '</span>';
  }

  var _countdownTimer = null;
  function tickLiveCountdowns() {
    document.querySelectorAll('.cd-live[data-cd-start]').forEach(function (el) {
      var p = countdownParts(el.getAttribute('data-cd-start'), el.getAttribute('data-cd-end') || '');
      if (!p) { el.style.display = 'none'; return; }
      if (p.mode === 'now') {
        el.className = 'cd cd-now';
        el.removeAttribute('data-cd-start');
        el.textContent = 'Happening now!';
        return;
      }
      if (p.mode === 'past') {
        el.style.display = 'none';
        return;
      }
      el.innerHTML = '<span class="cd-tminus">T minus</span> ' + esc(p.text);
      el.classList.toggle('is-urgent', !!p.urgent);
    });
  }
  function ensureCountdownTicker() {
    if (_countdownTimer) return;
    tickLiveCountdowns();
    _countdownTimer = setInterval(tickLiveCountdowns, 15000);
  }

  /** Date for a named list = linked event (shared pack or personal-for-event list) */
  function listAssociatedDates(list) {
    if (!list) return { start: null, end: null };
    var eid = list.eventId || list.personalForEventId || null;
    if (!eid) return { start: null, end: null };
    var ev = findEventById(eid);
    if (!ev) {
      try {
        var board = loadPersonalBoard();
        ev = (board.events || []).find(function (e) { return String(e.id) === String(eid); }) || null;
      } catch (eB) { ev = null; }
    }
    if (!ev) return { start: null, end: null };
    return { start: ev.start_at || null, end: ev.end_at || null };
  }

  function allEventsCombined() {
    var list = state.events.slice();
    // Personal undated / private events
    var board = loadPersonalBoard();
    (board.events || []).forEach(function (e) {
      if (!list.some(function (x) { return String(x.id) === String(e.id); })) {
        list.push(normalizeEvent(Object.assign({}, e, { _personalOnly: true })));
      }
    });
    return list;
  }

  function sortedEvents() {
    var list = allEventsCombined();
    // Show all events (Shared/Personal modes removed — My lists is separate)
    // Month vs all (unless a specific day is selected)
    if (state.sideCal.selectedDay) {
      list = list.filter(function (e) {
        return eventSpansYmd(e, state.sideCal.selectedDay);
      });
    } else if (state.eventsScope === 'month') {
      var y = state.sideCal.y, m = state.sideCal.m;
      var monthPrefix = y + '-' + String(m + 1).padStart(2, '0');
      list = list.filter(function (e) {
        if (!e.start_at) return true; // undated still show in month view
        var start = ymdFromIso(e.start_at);
        var end = ymdFromIso(e.end_at) || start;
        if (!start) return true;
        // Any overlap with this calendar month
        var monthStart = monthPrefix + '-01';
        var lastDay = new Date(y, m + 1, 0).getDate();
        var monthEnd = monthPrefix + '-' + String(lastDay).padStart(2, '0');
        return start <= monthEnd && end >= monthStart;
      });
    }
    var q = String(state.search || '').toLowerCase().trim();
    if (q) {
      list = list.filter(function (e) {
        return String(e.name || '').toLowerCase().indexOf(q) >= 0 ||
          String(e.event_type || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (state.sort === 'alpha') {
      list.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    } else if (state.sort === 'furthest') {
      list.sort(function (a, b) {
        return (b.start_at ? new Date(b.start_at).getTime() : 0) - (a.start_at ? new Date(a.start_at).getTime() : 0);
      });
    } else {
      list.sort(function (a, b) {
        var ta = a.start_at ? new Date(a.start_at).getTime() : Number.MAX_SAFE_INTEGER;
        var tb = b.start_at ? new Date(b.start_at).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    }
    return list;
  }

  function categorySelectOptions(ev, selectedId) {
    var freeOpen = null;
    try { freeOpen = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null; } catch (e) {}
    var ordered = orderedQualifiersForSelect(ev, freeOpen);
    var sel = selectedId || 'other';
    var html = ordered.map(function (qq) {
      return '<option value="' + esc(qq.id) + '"' + (sel === qq.id ? ' selected' : '') + '>' +
        esc(qq.name) + '</option>';
    }).join('');
    html += '<option value="__add_category__">+ Add category…</option>';
    return html;
  }

  function renderItemRow(item, kind, scope, ev) {
    try {
      return renderItemRowInner(item, kind, scope, ev);
    } catch (eRow) {
      console.warn('renderItemRow', kind, eRow);
      // Still emit a full button with right-side actions (never a hollow box)
      try {
        var safeId = (item && item.id) ? item.id : uid();
        var safeTitle = (item && item.title) ? item.title : 'Item';
        var safeKind = kind || 'todo';
        var safeScope = scope || 'free-list';
        return (
          '<div class="list-item" data-item-id="' + esc(safeId) + '" data-kind="' + esc(safeKind) +
            '" data-scope="' + esc(safeScope) + '" role="listitem">' +
            '<div class="li-row">' +
              '<button type="button" class="li-face li-main" data-act="expand" title="Open item options">' +
                '<div class="li-title-row"><span class="li-title">' + esc(safeTitle) + '</span></div>' +
              '</button>' +
              '<div class="li-actions">' +
                '<button type="button" class="btn btn-got" data-act="got" title="Claim this item">Got it!</button>' +
                (showExpenseEnabled(findNamedListById(state.activeNamedListId), activeEvent())
                  ? '<button type="button" class="btn btn-expense" data-act="expense" title="Shared expense">$</button>'
                  : '') +
              '</div>' +
            '</div>' +
            '<div class="li-detail"></div>' +
          '</div>'
        );
      } catch (e2) {
        return '<p class="empty">Item</p>';
      }
    }
  }

  function renderItemRowInner(item, kind, scope, ev) {
    if (!item || typeof item !== 'object') {
      return '<div class="list-item"><div class="li-row"><span class="li-title muted">Bad item</span></div></div>';
    }
    if (!item.id) item.id = uid();
    if (!item.claims || typeof item.claims !== 'object' || Array.isArray(item.claims)) item.claims = {};
    var mine = myClaimQty(item);
    var hasAnyClaim = false;
    try { hasAnyClaim = claimsFilled(item).parts.length > 0; } catch (eCl) { hasAnyClaim = mine > 0; }
    var pri = item.priority > 0 ? (' pri-' + item.priority) : '';
    var hlColor = String(item.highlight_color || 'red').toLowerCase();
    if (hlColor !== 'green' && hlColor !== 'yellow' && hlColor !== 'red') hlColor = 'red';
    var hi = item.highlight ? (' is-highlight hl-' + hlColor) : '';
    var exp = String(state.expandedItemId || '') === String(item.id) ? ' is-expanded' : '';
    var done = false;
    try { done = isItemAccounted(item); } catch (eDone) { done = false; }
    // is-claimed = someone grabbed it (keep member colors + brighter glow)
    // is-full / is-complete = fully gotten
    var full = (done ? ' is-full is-complete' : '') + (hasAnyClaim ? ' is-claimed' : '');
    // #70 — no per-item minimize; rows stay slim (Got it height)
    var faceStyle = '';
    try { faceStyle = claimFaceStyle(item); } catch (eFs) {
      faceStyle = 'background:linear-gradient(180deg,#2a3224 0%,#1a2018 45%,#12160f 100%);';
    }
    // Fully gotten + I claimed → Drop (releases my grab back to the list)
    var showDrop = done && mine > 0;
    var canEditSettings = true;
    try { canEditSettings = canEditItemSettings(item); } catch (eCe) { canEditSettings = true; }
    var lockAttr = canEditSettings ? '' : ' disabled';
    // Free lists pass a lightweight qEv (qualifiers only) — never require event packing lists
    var qHost = (ev && ev.state && Array.isArray(ev.state.qualifiers))
      ? ev
      : { state: { qualifiers: freeListQualifiers() } };
    var q = null;
    try { q = qualifierFor(qHost, item.qualifier || 'other'); } catch (eQ) { q = null; }
    if (!q && item.qualifier) {
      try {
        q = freeListQualifiers().find(function (x) { return x.id === item.qualifier; }) ||
          DEFAULT_QUALIFIERS.find(function (x) { return x.id === item.qualifier; }) || null;
      } catch (eQ2) { q = null; }
    }
    if (!q) q = { id: 'other', name: 'Other', color: '#8a9488' };
    var titleColor = done ? '#4ade80' : (q && q.color ? q.color : '#f0f4ee');
    var notes = [];
    try { notes = normalizeNotes(item); } catch (eN) { notes = []; }
    var note = null;
    try { note = latestNote(item); } catch (eLn) { note = null; }
    var showNote = state.noteItemId === item.id && notes.length;
    var buyNote = '';
    try {
      buyNote = needsBuyFlag(ev, item, kind)
        ? '<div class="needs-buy">Needs to be bought</div>' : '';
    } catch (eBn) { buyNote = ''; }
    var completeBadge = done
      ? '<span class="item-complete-check" title="Complete" aria-label="Complete">✓</span>'
      : '';

    // Due chips shown for every column when expanded (same UX for todo / buy / bring / custom)
    var due = '';
    if (exp) {
      if (item.due_mode === 'days_before') due = '<span class="chip">Due ' + (item.due_days || 0) + 'd before</span>';
      else if (item.due_mode === 'anytime_during') due = '<span class="chip">During event</span>';
      else if (item.due_mode === 'anytime_before') due = '<span class="chip">Anytime before</span>';
    }
    var qOpts = categorySelectOptions(ev, item.qualifier || 'other');

    var noteBlock = '';
    if (showNote) {
      noteBlock = notes.slice().sort(function (a, b) {
        return new Date(b.at || 0) - new Date(a.at || 0);
      }).map(function (n) {
        return '<div class="note-preview"><div class="note-meta">' + esc(n.byName || 'Member') + ' · ' +
          esc(n.at ? new Date(n.at).toLocaleString() : '') + '</div>' + esc(n.text) + '</div>';
      }).join('');
    } else if (note && state.noteItemId !== item.id) {
      noteBlock = '<div class="li-notes muted">Has note · tap to view</div>';
    }

    var fromChip = item.shared_from
      ? '<span class="chip">From ' + esc(item.shared_from) + '</span>' : '';
    var reqChip = item.require_all
      ? '<span class="chip" style="color:#86efac;border-color:#86efac">Everyone</span>' : '';
    var delChip = item.delegated_to
      ? '<span class="chip" style="color:#93c5fd;border-color:#3b82f6">→ ' +
        esc(item.delegated_to.display_name || 'member') + '</span>'
      : '';
    var openListForMgr = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
    var showDelegate = canManageList(openListForMgr) || (activeEvent() && isEventCreator(activeEvent()));

    // Every column (todo / buy / bring / custom) uses the same full-tile button face
    return (
      '<div class="list-item' + pri + hi + exp + full + '" style="' + faceStyle + '" data-item-id="' +
        esc(item.id) + '" data-kind="' + esc(kind) + '" data-scope="' + esc(scope) + '" draggable="false" role="listitem">' +
        '<div class="li-row">' +
          '<button type="button" class="li-face li-main" data-act="expand" title="Open item options">' +
            '<div class="li-title-row">' +
              completeBadge +
              '<span class="li-title" style="color:' + titleColor + '">' + esc(item.title) + '</span>' +
              ((item.qty || 1) > 1 ? '<span class="li-qty">×' + (item.qty || 1) + '</span>' : '') +
              (item.shared_expense ? '<span class="chip exp">$' + (Number(item.expense_amount) || 0).toFixed(2) + '</span>' : '') +
              '<span class="chip chip-cat" data-act="category" title="Change category" ' +
                'style="color:' + esc(q.color) + ';border-color:' + esc(q.color) + '">' + esc(q.name) + '</span>' +
              reqChip +
              delChip +
              fromChip +
            '</div>' +
            '<div class="li-body-extra">' +
              buyNote +
              noteBlock +
              due +
              (item.chore_at
                ? ('<span class="chip" style="color:#9bb8d8;border-color:#6a8ab8">Chore ' +
                  esc((function () {
                    try {
                      return new Date(item.chore_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      });
                    } catch (e) { return ''; }
                  })()) + '</span>')
                : '') +
              claimersHtml(item) +
            '</div>' +
          '</button>' +
          '<div class="li-actions">' +
            (showDrop
              ? '<button type="button" class="btn btn-got btn-drop is-on" data-act="drop" title="Drop what you claimed — put it back on the list">Drop</button>'
              : ('<button type="button" class="btn btn-got' + (mine > 0 ? ' is-on' : '') +
                '" data-act="got" title="Claim this item">Got it!</button>')) +
            (showExpenseEnabled(findNamedListById(state.activeNamedListId), ev || activeEvent())
              ? ('<button type="button" class="btn btn-expense' + (item.shared_expense ? ' is-on' : '') +
                '" data-act="expense" title="Shared expense">$</button>')
              : '') +
          '</div>' +
        '</div>' +
        '<div class="li-detail">' +
          (!canEditSettings ? '<p class="muted" style="font-size:11px;margin:0 0 8px">Only the list creator can change settings. You can still add notes and Got it.</p>' : '') +
          '<div class="field-row">' +
            '<div class="field field-grow"><label>Item name</label><input data-f="title" value="' + esc(item.title) + '" style="text-transform:capitalize" autocomplete="off"' + lockAttr + ' /></div>' +
            '<div class="field field-sm"><label>Qty</label>' +
              '<input data-f="qty" type="number" min="1" step="1" inputmode="numeric" pattern="[0-9]*" ' +
                'value="' + (item.qty != null && item.qty !== '' ? item.qty : 1) + '" title="How many" style="width:100%;text-align:center;font-weight:800;"' +
                lockAttr + ' /></div>' +
            '<div class="field field-md"><label>Category</label><select data-f="qualifier" data-cat-select' + lockAttr + '>' + qOpts + '</select></div>' +
            '<div class="field field-sm"><label>Priority</label>' +
              '<select data-f="priority"' + lockAttr + '>' +
                '<option value="0"' + (!(item.priority) ? ' selected' : '') + '>Normal</option>' +
                '<option value="1"' + (item.priority == 1 ? ' selected' : '') + '>High</option>' +
                '<option value="2"' + (item.priority == 2 ? ' selected' : '') + '>Urgent</option>' +
              '</select></div>' +
          '</div>' +
          '<div class="field" style="margin-top:8px"><label>' + (note ? 'Edit note' : 'Add note') + '</label>' +
            '<div class="note-ocr-row">' +
              '<textarea data-f="note_text" placeholder="Add a note…">' + esc(note ? note.text : '') + '</textarea>' +
              '<button type="button" class="btn btn-icon list-ocr-cam" data-ocr-note="1" title="Photo of handwriting → note text">' +
                '<img src="icons/pins/camera.png" alt="" width="18" height="18" /></button>' +
            '</div>' +
            (note ? '<div class="note-meta" style="margin-top:4px">Last: ' + esc(note.byName || 'Member') + ' · ' +
              esc(note.at ? new Date(note.at).toLocaleString() : '') + '</div>' : '') +
          '</div>' +
          '<div class="highlight-row" style="margin-top:8px">' +
            '<label class="check-row" style="margin-top:0">' +
              '<input type="checkbox" data-f="highlight" class="hl-check" ' + (item.highlight ? 'checked' : '') + lockAttr + ' />' +
              '<span class="check-row-text">Highlight</span>' +
            '</label>' +
            '<div class="hl-color-pick' + (item.highlight ? ' is-open' : '') + '" data-hl-color-pick>' +
              '<span class="muted" style="font-size:10px;margin-right:6px">Pulse</span>' +
              '<button type="button" class="hl-swatch hl-red' + (hlColor === 'red' ? ' is-on' : '') +
                '" data-f-hl-color="red" title="Red"' + lockAttr + '></button>' +
              '<button type="button" class="hl-swatch hl-yellow' + (hlColor === 'yellow' ? ' is-on' : '') +
                '" data-f-hl-color="yellow" title="Yellow"' + lockAttr + '></button>' +
              '<button type="button" class="hl-swatch hl-green' + (hlColor === 'green' ? ' is-on' : '') +
                '" data-f-hl-color="green" title="Green"' + lockAttr + '></button>' +
            '</div>' +
          '</div>' +
          '<label class="check-row"><input type="checkbox" data-f="creator_only_edit" ' + (item.creator_only_edit ? 'checked' : '') + lockAttr +
            ' /> Only list creator can edit</label>' +
          '<label class="check-row"><input type="checkbox" data-f="require_all" ' + (item.require_all ? 'checked' : '') + lockAttr +
            ' /> Everyone must complete this item</label>' +
          '<div class="field-row field-row-due">' +
            '<div class="field field-due"><label>Due</label>' +
              '<select data-f="due_mode"' + lockAttr + '>' +
                '<option value="anytime_before"' + ((item.due_mode || 'anytime_before') === 'anytime_before' ? ' selected' : '') + '>Anytime before</option>' +
                '<option value="anytime_during"' + (item.due_mode === 'anytime_during' ? ' selected' : '') + '>Anytime during</option>' +
                '<option value="days_before"' + (item.due_mode === 'days_before' ? ' selected' : '') + '>Days before</option>' +
              '</select></div>' +
            '<div class="field field-days"><label>Days</label><input data-f="due_days" type="number" min="0" value="' + (item.due_days || 0) + '"' + lockAttr + ' /></div>' +
          '</div>' +
          '<div class="make-chore-wrap" style="margin-top:10px">' +
            '<div class="make-chore-btn-row">' +
              '<button type="button" class="btn btn-accent" data-act="choose-when"' +
                (canEditSettings ? '' : ' disabled') + '>' +
                (item.chore_at ? 'Chore options' : 'Make Chore') +
              '</button>' +
              (item.chore_at
                ? ('<span class="muted make-chore-when-hint">' + esc((function () {
                  try {
                    return new Date(item.chore_at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    });
                  } catch (e) { return 'scheduled'; }
                })()) + '</span>')
                : '') +
            '</div>' +
            '<label class="check-row make-chore-show-cal"' +
              (item.chore_at ? '' : ' style="opacity:0.85"') + '>' +
              '<input type="checkbox" data-f="chore_show_on_calendar" ' +
                (item.chore_show_on_calendar === false ? '' : 'checked') +
                (canEditSettings ? '' : ' disabled') + ' />' +
              '<span class="check-row-text">Show on calendar</span>' +
            '</label>' +
            // Hidden fields keep schedule values for detail save
            '<input type="hidden" data-f="chore_date" value="' + esc(choreDateVal(item)) + '" />' +
            '<input type="hidden" data-f="chore_time" value="' + esc(choreTimeVal(item)) + '" />' +
            '<input type="hidden" data-f="chore_end_time" value="' + esc(choreEndTimeVal(item)) + '" />' +
            '<input type="hidden" data-f="chore_color" value="' + esc(item.chore_color || DEFAULT_CHORE_COLOR) + '" />' +
          '</div>' +
          '<div class="li-detail-actions">' +
            '<div class="li-detail-actions-left">' +
              '<button type="button" class="btn btn-item-del" data-act="del" title="Delete item"' +
                (canEditSettings ? '' : ' disabled') + '>Delete</button>' +
              '<button type="button" class="btn" data-act="cancel-detail" title="Discard option changes">Cancel</button>' +
              (showDelegate
                ? '<button type="button" class="btn" data-act="delegate" title="Delegate to a member’s To bring">Delegate</button>'
                : '') +
              '<button type="button" class="btn" data-act="share-item" title="Copy item to clipboard">Share</button>' +
              '<button type="button" class="btn" data-act="save-item-template" title="Save this item’s settings as a template">Save template</button>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-save-detail" data-act="save-detail" title="Save and close">Save</button>' +
          '</div>' +
          '<p class="muted" style="font-size:10px;margin:8px 0 0">Save closes options. Cancel discards. Share copies the item for pasting into another list.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function sortBucketDisplay(bucket, ev) {
    var list = bucket.slice();
    if (state.sortByType && ev) {
      var qs = ensureQualifiers(ev);
      var order = {};
      qs.forEach(function (q, i) { order[q.id] = i; });
      list.sort(function (a, b) {
        var qa = order[a.qualifier || 'other'];
        var qb = order[b.qualifier || 'other'];
        if (qa == null) qa = 999;
        if (qb == null) qb = 999;
        if (qa !== qb) return qa - qb;
        return bucket.indexOf(a) - bucket.indexOf(b);
      });
      return list;
    }
    // Preserve manual drag order (array order)
    return list;
  }

  function filterByQualifier(items) {
    if (state.filterQualifier === 'all') return items;
    return items.filter(function (it) {
      return (it.qualifier || 'other') === state.filterQualifier;
    });
  }

  function renderSplitLists(bucket, kind, scope, ev) {
    var filtered = [];
    try {
      filtered = filterByQualifier(sortBucketDisplay(bucket || [], ev));
    } catch (eF) {
      filtered = Array.isArray(bucket) ? bucket.filter(Boolean) : [];
    }
    var open = [];
    var grabbed = [];
    filtered.forEach(function (it) {
      if (!it) return;
      try {
        if (isItemAccounted(it)) grabbed.push(it);
        else open.push(it);
      } catch (eA) {
        open.push(it);
      }
    });
    function rowsHtml(arr) {
      return arr.map(function (it) {
        try { return renderItemRow(it, kind, scope, ev); }
        catch (eR) { return renderItemRow(it, kind, scope, ev); } // outer renderItemRow already safe
      }).join('');
    }
    var html = '';
    if (open.length) {
      html += '<div class="section-label open">Still needed</div>';
      html += rowsHtml(open);
    }
    if (grabbed.length) {
      html += '<div class="section-label grabbed">Already grabbed</div>';
      html += rowsHtml(grabbed);
    }
    if (!open.length && !grabbed.length) {
      html = '<p class="empty">Nothing here yet.</p>';
    }
    return html;
  }

  function isNamedListOwner(list) {
    if (!list) return false;
    var me = myId();
    if (!me) return true;
    return String(list.owner_id) === String(me) || isListCreator(list, me);
  }

  /** Flexible columns for the RIGHT panel: add-per-column, drag, minimize, options — never throws */
  function renderListTriad(list, qEv) {
    try {
      list = sanitizeNamedList(list || {});
    } catch (eS) {
      list = { id: 'tmp', name: 'List', columns: ['todo', 'buy', 'bring'].map(function (k) { return defaultColumn(k, listKindLabel(k)); }) };
    }
    var canEdit = false;
    try { canEdit = isNamedListOwner(list); } catch (eO) { canEdit = true; }
    var html = '<div class="list-triad" id="list-triad" data-list-id="' + esc(list.id) + '">';
    (list.columns || []).forEach(function (col) {
      try {
        if (!col) return;
        var cid = col.id || 'todo';
        var colors = col.colors || DEFAULT_COL_COLORS;
        var mini = !!col.minimized;
        var colItems = Array.isArray(col.items) ? col.items.filter(function (it) { return it && typeof it === 'object'; }) : [];
        // My checklist = private live view of everything I’ve claimed (Got it!)
        if (String(cid) === 'personal') {
          colItems = collectMyClaimedItems(list);
        }
        var sectionDone = false;
        try {
          sectionDone = colItems.length > 0 && colItems.every(function (it) { return isItemAccounted(it); });
        } catch (eD) {}
        var body = '';
        try {
          body = renderSplitLists(colItems, cid, 'free-list', qEv);
        } catch (eB) {
          console.warn('renderSplitLists', eB);
          // Full item buttons for every column — never hollow title-only boxes
          body = colItems.map(function (it) {
            return renderItemRow(it, cid, 'free-list', qEv);
          }).join('') || '<p class="empty">Nothing here yet.</p>';
        }
        var isClassic = cid === 'todo' || cid === 'buy' || cid === 'bring';
        var titleColor = sectionDone ? '#4ade80' : (isClassic ? 'var(--accent)' : colors.font);
        if (mini) {
          html +=
            '<div class="list-col is-minimized' + (isClassic ? ' list-col-classic' : '') + '" data-col-kind="' + esc(cid) + '" draggable="false" ' +
              'style="--col-font:' + esc(colors.font) + ';--col-tab:' + esc(colors.tab) + ';--col-bg:' + esc(colors.bg) + ';">' +
              '<button type="button" class="list-col-mini-label" data-col-restore="' + esc(cid) + '" title="Expand ' + esc(col.name || cid) + '">' +
                '<span class="list-col-mini-text' + (isClassic ? ' list-col-title-classic' : '') + '">' + esc(col.name || listKindLabel(cid)) + '</span>' +
              '</button>' +
            '</div>';
          return;
        }
        var isActiveCol = String(cid) === String(state.listTab || '');
        if (!state.listTab && (list.columns[0] && String(list.columns[0].id) === String(cid))) isActiveCol = true;
        html +=
          '<div class="list-col' + (isClassic ? ' list-col-classic' : '') + (String(cid) === 'personal' ? ' list-col-personal' : '') +
            (isActiveCol ? ' is-active-col' : '') +
            '" data-col-kind="' + esc(cid) + '" draggable="false" ' +
            'style="--col-font:' + esc(colors.font) + ';--col-tab:' + esc(colors.tab) + ';--col-bg:' + esc(colors.bg) + ';">' +
            '<div class="list-col-head' + (isClassic ? ' list-col-head-classic' : '') + '" style="background:' + esc(isClassic ? 'linear-gradient(180deg,#3a3420,#2a2418)' : colors.tab) + ';">' +
              '<button type="button" class="list-col-drag" data-col-drag draggable="' + (canEdit ? 'true' : 'false') + '" title="Drag to reorder" ' +
                (canEdit ? '' : 'disabled') + '>⋮⋮</button>' +
              '<button type="button" class="list-col-title' + (isClassic ? ' list-col-title-classic' : '') + '" data-col-rename="' + esc(cid) + '" ' +
                (isClassic ? '' : ('style="color:' + esc(titleColor) + ';" ')) +
                'title="' + (canEdit && !isClassic ? 'Click to rename' : esc(col.name || listKindLabel(cid))) + '">' +
                (sectionDone ? '<span class="section-complete-check" title="Section complete">✓</span> ' : '') +
                esc(isClassic ? listKindLabel(cid) : (col.name || listKindLabel(cid))) +
              '</button>' +
              '<div class="list-col-head-actions">' +
                /* Same ⚙ / share / − for checklist + custom as classic columns (#66) */
                (canEdit
                  ? '<button type="button" class="btn-icon list-col-opt" data-col-options="' + esc(cid) + '" title="Options">⚙</button>'
                  : '') +
                '<button type="button" class="btn-icon list-share-ico" data-col-share="' + esc(cid) + '" title="Share this section">' +
                  shareIconSvg() + '</button>' +
                '<button type="button" class="btn-icon" data-col-minimize="' + esc(cid) + '" title="Minimize">−</button>' +
              '</div>' +
            '</div>' +
            '<div class="list-col-body" data-col-body="' + esc(cid) + '" data-col-focus-add="' + esc(cid) + '" ' +
              'style="background:' + esc(colors.bg) + ';color:' + esc(colors.font) + ';" title="' +
              (String(cid) === 'personal' ? 'Private checklist — add items or Got it! from other sections' : 'Click here to type an item') + '">' +
              body +
            '</div>' +
            /* My checklist: same add bar as other sections (#66) */
            ('<div class="list-col-add">' +
                (String(cid) === 'personal'
                  ? '<span class="muted" style="font-size:10px;padding:0 4px 0 0;white-space:nowrap">Private · you only</span>'
                  : '') +
                '<input type="text" class="list-col-add-input" data-col-add-input="' + esc(cid) + '" placeholder="' +
                  (String(cid) === 'personal' ? 'Add private item…' : 'Type item, press Enter…') +
                  '" autocomplete="off" style="text-transform:capitalize" />' +
                /* #116: camera/OCR on My checklist (private) same as other columns */
                ('<button type="button" class="btn btn-icon list-ocr-cam" data-ocr-list="' + esc(cid) +
                  '" title="Photo of handwritten list → items"><img src="icons/pins/camera.png" alt="" width="18" height="18" /></button>') +
                '<button type="button" class="btn btn-primary list-col-add-btn" data-col-add="' + esc(cid) + '">Add</button>' +
              '</div>') +
          '</div>';
      } catch (eCol) {
        console.warn('render column', eCol);
      }
    });
    html += '</div>';
    return html;
  }

  /** Event packing lists — thin wrapper that uses the event-associated named list when present */
  function renderEventTriad(ev) {
    if (!ev) return '';
    var linked = listsForEvent(ev.id);
    if (linked.length) return renderListTriad(linked[0], { state: { qualifiers: DEFAULT_QUALIFIERS.slice() } });
    // Fallback: three fixed packing buckets on the event itself
    var order = ['todo', 'buy', 'bring'];
    var html = '<div class="list-triad" id="list-triad">';
    order.forEach(function (kind) {
      var bucket = getListBucket(ev, kind, 'group');
      var body = renderSplitLists(bucket || [], kind, 'group', ev);
      html +=
        '<div class="list-col" data-col-kind="' + esc(kind) + '">' +
          '<div class="list-col-head">' +
            '<span class="list-col-title">' + esc(listKindLabel(kind)) + '</span>' +
          '</div>' +
          '<div class="list-col-body" data-col-body="' + esc(kind) + '">' + body + '</div>' +
          '<div class="list-col-add">' +
            '<input type="text" class="list-col-add-input" data-event-col-add-input="' + esc(kind) + '" placeholder="Add item…" autocomplete="off" style="text-transform:capitalize" />' +
            '<button type="button" class="btn btn-icon list-ocr-cam" data-ocr-list="' + esc(kind) +
              '" data-ocr-event="1" title="Photo of handwritten list → items"><img src="icons/pins/camera.png" alt="" width="18" height="18" /></button>' +
            '<button type="button" class="btn btn-primary" data-event-col-add="' + esc(kind) + '">Add</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  /** Collect item arrays to scan for used qualifier ids */
  function itemsForQualifierScan(ev, freeList) {
    var items = [];
    if (freeList) {
      normalizeNamedList(freeList);
      (freeList.columns || []).forEach(function (c) {
        (c.items || []).forEach(function (it) { items.push(it); });
      });
    } else if (ev) {
      try {
        ['todo', 'buy', 'bring'].forEach(function (k) {
          var b = getListBucket(ev, k, 'group');
          (b || []).forEach(function (it) { items.push(it); });
        });
      } catch (e) {}
    }
    return items;
  }

  function renderQualifierFilters(ev, freeList) {
    var box = $('qualifier-filters');
    if (!box) return;
    if (!ev && !freeList) { box.innerHTML = ''; return; }
    // Show every permanent category at the top (recent/frequency order), not only used ones
    var qs = orderedQualifiersForSelect(ev, freeList);
    var showQs = qs.filter(function (q) { return q && q.id; });
    // No + Add section on personal or event packing lists (classic To do / To buy / To bring)
    var html = '';
    html += '<button type="button" class="btn filter-chip' + (state.filterQualifier === 'all' ? ' is-active' : '') +
      '" data-filter-q="all">Show all</button>';
    showQs.forEach(function (q) {
      html += '<button type="button" class="btn filter-chip' + (state.filterQualifier === q.id ? ' is-active' : '') +
        '" data-filter-q="' + esc(q.id) + '" style="color:' + (q.color || 'var(--ink)') + ';border-color:' + (q.color || 'var(--border)') + '66">' +
        esc(q.name) + '</button>';
    });
    html += '<button type="button" class="btn filter-chip' + (state.sortByType ? ' is-active' : '') +
      '" data-filter-q="__sort">Sort by type</button>';
    box.innerHTML = html;
  }

  function renderSideCalendar() {
    if (!state.sideCal.y) {
      var n = new Date();
      state.sideCal.y = n.getFullYear();
      state.sideCal.m = n.getMonth();
    }
    var y = state.sideCal.y, m = state.sideCal.m;
    if ($('side-cal-label')) {
      $('side-cal-label').textContent = new Date(y, m, 1).toLocaleString(undefined, {
        month: 'long', year: 'numeric'
      });
    }
    var grid = $('side-cal-grid');
    if (!grid) return;
    var first = new Date(y, m, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) {
      return '<div class="cal-day-name">' + d + '</div>';
    }).join('');
    var today = new Date();
    var dayMarks = {}; // dayNum -> [{color}] — always show events AND chores
    function markRange(startIso, endIso, color) {
      if (!startIso) return;
      var start = startIso;
      var end = endIso || start;
      if (end < start) end = start;
      var cursor = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
      var endD = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
      var guard = 0;
      while (cursor <= endD && guard++ < 400) {
        if (cursor.getFullYear() === y && cursor.getMonth() === m) {
          var dayNum = cursor.getDate();
          if (!dayMarks[dayNum]) dayMarks[dayNum] = [];
          dayMarks[dayNum].push({ color: color });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    allEventsCombined().forEach(function (e) {
      if (!e.start_at) return;
      markRange(ymdFromIso(e.start_at), ymdFromIso(e.end_at) || ymdFromIso(e.start_at), eventColor(e));
    });
    // Only chores with “Show on calendar” checked (default true)
    collectAllChores().forEach(function (ch) {
      var y0 = choreYmd(ch);
      if (!y0 && !ch.chore_at) return;
      var y1 = y0 || ymdFromIso(ch.chore_at);
      var y2 = ymdFromIso(ch.chore_end_at) || y1;
      if (!y1) return;
      markRange(y1, y2, choreColor(ch));
    });
    for (var i = 0; i < startPad; i++) html += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isSel = state.sideCal.selectedDay === iso;
      var isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
      var marks = dayMarks[d] || [];
      var dots = '';
      if (marks.length) {
        dots = '<div class="cal-dots-container">' +
          marks.slice(0, 4).map(function (mk) {
            return '<span class="cal-event-dot" style="background:' + esc(mk.color || 'var(--accent)') + '"></span>';
          }).join('') + '</div>';
      }
      // Same cell chrome as every other day — only dots mark events/chores
      html += '<button type="button" class="cal-cell' +
        (isSel ? ' selected' : '') +
        (isToday ? ' is-today' : '') +
        '" data-side-day="' + iso + '"><span>' + d + '</span>' + dots + '</button>';
    }
    grid.innerHTML = html;
    // Clear pin filter when selected day leaves filtered event range (Hunt calendar kit)
    if (state.eventPinsFilter && state.sideCal.selectedDay) {
      var fev = allEventsCombined().find(function (e) {
        return String(e.id) === String(state.eventPinsFilter.eventId);
      });
      if (fev && !eventSpansYmd(fev, state.sideCal.selectedDay)) {
        clearEventPinsFilter({ silent: true });
      }
    }
    renderMapContextBar();
    renderEventPinsBanner();
  }

  function clearEventPinsFilter(opts) {
    opts = opts || {};
    state.eventPinsFilter = null;
    state.showAllPins = true;
    if (!opts.silent) appToast('Showing all pins for this map');
    renderEventPinsBanner();
    updateMapPinFilterBtn();
    if (window.PlanMap) {
      configurePlanMap();
      window.PlanMap.redraw();
    }
  }

  function setEventPinsFilter(ev) {
    if (!ev) return;
    state.eventPinsFilter = { eventId: String(ev.id), name: ev.name || 'Event' };
    state.showAllPins = false;
    renderEventPinsBanner();
    updateMapPinFilterBtn();
    if (window.PlanMap) {
      configurePlanMap();
      window.PlanMap.redraw();
    }
    appToast('Showing pins for “' + (ev.name || 'Event') + '”');
  }

  function clearEventPinsFilterAndShowAll() {
    state.eventPinsFilter = null;
    state.showAllPins = true;
    renderEventPinsBanner();
    updateMapPinFilterBtn();
    if (window.PlanMap) {
      configurePlanMap();
      window.PlanMap.redraw();
    }
    appToast('Showing all pins');
  }

  function updateMapPinFilterBtn() {
    var bar = $('map-pin-filter-bar');
    var btn = $('btn-map-pin-filter');
    if (!bar || !btn) return;
    var mapOpen = state.mapMode === 'mini' || state.mapMode === 'max';
    var hasEv = !!(state.activeEventId || (state.eventPinsFilter && state.eventPinsFilter.eventId));
    bar.style.display = mapOpen && hasEv ? '' : 'none';
    if (state.eventPinsFilter) {
      btn.textContent = 'Show all pins';
      btn.classList.add('is-active');
    } else {
      btn.textContent = 'Event pins only';
      btn.classList.remove('is-active');
    }
  }

  function toggleEventPinsOnly() {
    if (state.eventPinsFilter) {
      clearEventPinsFilterAndShowAll();
      return;
    }
    var ev = activeEvent();
    if (!ev && state.activeEventId) {
      ev = (state.events || []).find(function (e) { return String(e.id) === String(state.activeEventId); });
    }
    if (!ev) {
      appToast('Open an event first');
      return;
    }
    setEventPinsFilter(ev);
  }

  function renderEventPinsBanner() {
    var el = $('event-pins-banner');
    if (!el) return;
    if (!state.eventPinsFilter) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML =
      '<span>Pins: <strong>' + esc(state.eventPinsFilter.name) + '</strong></span>' +
      '<button type="button" class="btn btn-ghost" id="event-pins-clear" style="padding:4px 8px;font-size:11px">Show all</button>';
    var b = $('event-pins-clear');
    if (b) b.onclick = function () { clearEventPinsFilterAndShowAll(); };
  }

  function renderMapContextBar() {
    var el = $('map-context-bar');
    if (!el) return;
    // Left stack context chips stay as quick filters; main switcher is on-map chip
    var parts = [
      { id: 'auto', label: 'Auto' },
      { id: 'personal', label: 'Personal map' }
    ];
    (state.events || []).slice(0, 8).forEach(function (e) {
      if (e && e.id) parts.push({ id: 'event:' + e.id, label: (e.name || 'Event').slice(0, 18) });
    });
    var cur = state.mapContext || 'auto';
    el.innerHTML = parts.map(function (p) {
      var on = cur === p.id ? ' is-active' : '';
      return '<button type="button" class="map-ctx-btn' + on + '" data-map-ctx="' + esc(p.id) + '">' +
        esc(p.label) + '</button>';
    }).join('');
    updateMapViewingChip();
  }

  function currentMapViewingLabel() {
    var v = state.mapViewing || {};
    if (v.name && String(v.name).trim()) return String(v.name).trim();
    if (v.mode === 'shared') return 'Shared map';
    if (v.mode === 'private') return 'Private map';
    if (v.mode === 'event') return 'Event map';
    return 'Plan personal map';
  }
  function updateMapViewingChip() {
    var btn = $('map-viewing-chip');
    if (!btn) return;
    var label = currentMapViewingLabel();
    btn.textContent = label;
    btn.title = 'Viewing: ' + label + ' — tap to switch maps';
    btn.setAttribute('aria-label', 'Map: ' + label + '. Click to switch.');
    var sub = $('map-viewing-chip-sub');
    if (sub) {
      var v = state.mapViewing || {};
      if (v.mode === 'shared') sub.textContent = 'Shared · Hunt/Reg';
      else if (v.mode === 'private') sub.textContent = 'Private · Hunt/Reg';
      else if (v.mode === 'event') sub.textContent = 'Event pins';
      else sub.textContent = 'Plan pins';
    }
  }
  function closeMapViewingSwitcher() {
    var dd = $('map-viewing-dropdown');
    if (dd) {
      dd.classList.remove('open');
      dd.setAttribute('aria-hidden', 'true');
    }
    var chip = $('map-viewing-chip');
    if (chip) chip.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', _mapViewingOutside, true);
  }
  function _mapViewingOutside(ev) {
    var dd = $('map-viewing-dropdown');
    if (!dd || !dd.classList.contains('open')) return;
    if (dd.contains(ev.target)) return;
    if (ev.target && ev.target.closest && ev.target.closest('#map-viewing-chip-wrap')) return;
    closeMapViewingSwitcher();
  }
  async function fetchHuntRegMapLists() {
    var client = sb();
    var out = { pmaps: [], smaps: [] };
    if (!client) return out;
    try {
      var pr = await client.rpc('list_my_private_maps');
      out.pmaps = (pr && pr.data) || [];
    } catch (eP) { out.pmaps = []; }
    try {
      var sr = await client.rpc('list_my_shared_maps');
      out.smaps = (sr && sr.data) || [];
    } catch (eS) { out.smaps = []; }
    state._mapSwitcherCache = { pmaps: out.pmaps, smaps: out.smaps, at: Date.now() };
    return out;
  }
  function buildMapViewingDropdownHtml(pmaps, smaps) {
    var v = state.mapViewing || {};
    function item(mode, id, name, meta) {
      var on = v.mode === mode && (
        (mode === 'plan' && !v.id) ||
        (id != null && String(v.id) === String(id))
      );
      return '<button type="button" class="mvd-item' + (on ? ' is-on' : '') +
        '" data-view-mode="' + esc(mode) + '" data-view-id="' + esc(id || '') +
        '" data-view-name="' + esc(name || '') + '">' +
        '<span class="mvd-name">' + esc(name) + '</span>' +
        (meta ? '<span class="mvd-meta">' + esc(meta) + '</span>' : '') +
        '</button>';
    }
    var html = '';
    html += '<div class="mvd-group">Plan Slayer</div>';
    html += item('plan', '', 'Plan personal map', 'This app’s pins');
    (state.events || []).slice(0, 12).forEach(function (e) {
      if (!e || !e.id) return;
      html += item('event', e.id, e.name || 'Event', 'Event pins');
    });
    html += '<div class="mvd-group">Private maps (Hunt/Reg)</div>';
    if (!pmaps || !pmaps.length) {
      html += '<div class="mvd-empty">No private maps · create one in Hunt or Reg</div>';
    } else {
      pmaps.forEach(function (m) {
        if (!m || !m.id) return;
        html += item('private', m.id, m.name || 'Private map', 'Pins & areas');
      });
    }
    html += '<div class="mvd-group">Shared maps (Hunt/Reg)</div>';
    if (!smaps || !smaps.length) {
      html += '<div class="mvd-empty">No shared maps · join one in Hunt or Reg</div>';
    } else {
      smaps.forEach(function (m) {
        if (!m || !m.id) return;
        html += item('shared', m.id, m.name || 'Shared map', m.code ? ('Code ' + m.code) : 'Party map');
      });
    }
    return html;
  }
  async function openMapViewingSwitcher() {
    var dd = $('map-viewing-dropdown');
    var chip = $('map-viewing-chip');
    if (!dd) return;
    if (dd.classList.contains('open')) {
      closeMapViewingSwitcher();
      return;
    }
    // Open map if minimized
    if (state.mapMode === 'button') setMapMode('mini');
    var cache = state._mapSwitcherCache || {};
    var fresh = cache.at && (Date.now() - cache.at) < 45000;
    dd.innerHTML = fresh
      ? buildMapViewingDropdownHtml(cache.pmaps, cache.smaps)
      : '<div class="mvd-empty">Loading maps…</div>';
    dd.classList.add('open');
    dd.setAttribute('aria-hidden', 'false');
    if (chip) chip.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', _mapViewingOutside, true);
    }, 0);
    try {
      var lists = await fetchHuntRegMapLists();
      if (!dd.classList.contains('open')) return;
      dd.innerHTML = buildMapViewingDropdownHtml(lists.pmaps, lists.smaps);
    } catch (e) {
      if (!dd.querySelector('.mvd-item')) {
        dd.innerHTML = '<div class="mvd-empty">Could not load maps — sign in?</div>';
      }
    }
  }
  /**
   * Load Hunt/Reg map_state (pins + customAreas only — no deer/WMA overlays).
   */
  function applyViewingMapState(kind, id, name, mapState) {
    mapState = mapState || {};
    // Pins only — strip hunt-only junk fields that Plan pin renderer ignores
    var pins = Array.isArray(mapState.pins) ? mapState.pins.filter(function (p) {
      return p && p.lat != null && p.lng != null;
    }).map(function (p) {
      // Normalize Hunt pin shape → Plan pin shape
      return {
        id: p.id || uid(),
        lat: Number(p.lat),
        lng: Number(p.lng),
        name: p.name || p.title || 'Pin',
        notes: p.notes || '',
        iconId: p.iconId || p.icon || p.pinIcon || null,
        color: p.color || p.outerColor || p.pinColor || '#e59a18',
        innerColor: p.innerColor || '#ffffff',
        glyphColor: p.glyphColor || p.iconColor || 'natural',
        photos: p.photos || [],
        hidden: !!p.hidden,
        fromHuntMap: true
      };
    }) : [];
    var areas = Array.isArray(mapState.customAreas) ? mapState.customAreas : [];
    state.mapViewing = {
      mode: kind === 'shared' ? 'shared' : (kind === 'private' ? 'private' : kind),
      id: id ? String(id) : null,
      name: name || (kind === 'shared' ? 'Shared map' : 'Private map'),
      pins: pins,
      customAreas: areas,
      kind: kind,
      rawState: mapState
    };
    state.showAllPins = false;
    if (kind === 'event') {
      state.mapContext = 'event:' + String(id);
    } else if (kind === 'plan') {
      state.mapContext = 'personal';
    }
    updateMapViewingChip();
    configurePlanMap();
    if (window.PlanMap) {
      window.PlanMap.ensure();
      window.PlanMap.redraw();
    }
  }
  /** Write pin list back to Hunt/Reg map_state (preserve customAreas / other keys). */
  function pushPinsToHuntRegMap(mode, mapId, pins, rawState) {
    var client = sb();
    if (!client || !mapId) return;
    var table = mode === 'shared' ? 'shared_maps' : 'private_maps';
    var next = Object.assign({}, rawState || {});
    next.pins = pins || [];
    if (!next.meta) next.meta = {};
    next.meta.savedAt = new Date().toISOString();
    next.meta.from = 'planslayer';
    client.from(table).update({ map_state: next, updated_at: new Date().toISOString() })
      .eq('id', mapId)
      .then(function (res) {
        if (res && res.error) {
          console.warn('pushPinsToHuntRegMap', res.error);
          appToast('Could not save pins to Hunt/Reg map');
        } else {
          if (state.mapViewing) state.mapViewing.rawState = next;
        }
      }).catch(function (e) {
        console.warn('pushPinsToHuntRegMap', e);
      });
  }

  async function selectMapViewing(mode, id, name) {
    mode = String(mode || 'plan');
    closeMapViewingSwitcher();
    if (state.mapMode === 'button') setMapMode('mini');
    if (mode === 'plan') {
      state.mapViewing = {
        mode: 'plan', id: null, name: 'Plan personal map',
        pins: null, customAreas: null, kind: 'plan'
      };
      state.mapContext = 'personal';
      state.showAllPins = false;
      updateMapViewingChip();
      configurePlanMap();
      if (window.PlanMap) { window.PlanMap.ensure(); window.PlanMap.redraw(); }
      appToast('Viewing Plan personal map');
      return;
    }
    if (mode === 'event') {
      var ev = (state.events || []).find(function (e) { return String(e.id) === String(id); });
      var pins = (ev && ev.state && ev.state.mapPins) || [];
      applyViewingMapState('event', id, name || (ev && ev.name) || 'Event', { pins: pins, customAreas: [] });
      if (ev && ev.lat != null && window.PlanMap && window.PlanMap.getMap) {
        try { window.PlanMap.getMap().setView([Number(ev.lat), Number(ev.lng)], 13); } catch (e) {}
      }
      appToast('Viewing event map: ' + (name || 'Event'));
      return;
    }
    var client = sb();
    if (!client) {
      appToast('Sign in to open Hunt/Reg maps');
      return;
    }
    var table = mode === 'shared' ? 'shared_maps' : 'private_maps';
    appToast('Loading map…');
    try {
      var res = await client.from(table).select('id, name, map_state, code').eq('id', id).maybeSingle();
      if (res.error || !res.data) {
        appToast('Map not found — open it once in Hunt/Reg');
        return;
      }
      var st = res.data.map_state || {};
      // Never load deer/WMA-only layers — only pins + custom areas
      applyViewingMapState(mode, res.data.id, res.data.name || name, {
        pins: st.pins || [],
        customAreas: st.customAreas || []
      });
      // Fit pins/areas if possible
      try {
        var map = window.PlanMap && window.PlanMap.getMap && window.PlanMap.getMap();
        if (map) {
          var bounds = [];
          (state.mapViewing.pins || []).forEach(function (p) {
            if (p && p.lat != null) bounds.push([p.lat, p.lng]);
          });
          (state.mapViewing.customAreas || []).forEach(function (a) {
            var ring = a && (a.ring || a.latlngs);
            if (!ring) return;
            ring.forEach(function (pt) {
              if (Array.isArray(pt) && pt.length >= 2) bounds.push([pt[0], pt[1]]);
              else if (pt && pt.lat != null) bounds.push([pt.lat, pt.lng]);
            });
          });
          if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
      } catch (eFit) {}
      appToast('Viewing: ' + (res.data.name || name || 'map') + ' (pins & areas · no deer layers)');
    } catch (eLoad) {
      console.warn('selectMapViewing', eLoad);
      appToast('Could not load map');
    }
  }

  function closeQuickLoadModal() {
    var modal = $('quick-load-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    state._quickLoadEventId = null;
  }

  function openQuickLoadMenu(eventId) {
    var ev = allEventsCombined().find(function (e) { return String(e.id) === String(eventId); });
    if (!ev) return;
    state._quickLoadEventId = String(eventId);
    var pinCount = 0;
    try {
      var pins = (ev.state && ev.state.mapPins) || [];
      pinCount = pins.length;
    } catch (e) {}
    var hasLoc = ev.lat != null && ev.lng != null;
    if ($('quick-load-meta')) {
      $('quick-load-meta').textContent = '“' + (ev.name || 'Event') + '” — choose how to open it.';
    }
    if ($('ql-pins-sub')) {
      $('ql-pins-sub').textContent = pinCount
        ? (pinCount + ' pin' + (pinCount === 1 ? '' : 's') + ' on this event map')
        : 'No pins yet — you can still open the map';
    }
    if ($('ql-btn-load')) {
      if (hasLoc) $('ql-btn-load').removeAttribute('hidden');
      else $('ql-btn-load').setAttribute('hidden', 'hidden');
    }
    if ($('ql-btn-both')) {
      if (hasLoc) $('ql-btn-both').removeAttribute('hidden');
      else $('ql-btn-both').setAttribute('hidden', 'hidden');
    }
    var modal = $('quick-load-modal');
    if (!modal) {
      openEvent(ev.id);
      return;
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function runQuickLoadChoice(choice) {
    var id = state._quickLoadEventId;
    var ev = id && allEventsCombined().find(function (e) { return String(e.id) === String(id); });
    closeQuickLoadModal();
    if (!ev) return;
    if (choice === 'pins') {
      openEvent(ev.id);
      setEventPinsFilter(ev);
      setMapMode('max');
      if (window.PlanMap) {
        window.PlanMap.ensure();
        window.PlanMap.redraw();
        if (ev.lat != null) window.PlanMap.followEventLocation && window.PlanMap.followEventLocation(true);
      }
      return;
    }
    if (choice === 'load') {
      openEvent(ev.id);
      clearEventPinsFilter({ silent: true });
      setMapMode('max');
      if (window.PlanMap) {
        window.PlanMap.ensure();
        if (ev.lat != null && window.PlanMap.followEventLocation) window.PlanMap.followEventLocation(true);
        window.PlanMap.redraw();
      }
      return;
    }
    if (choice === 'both') {
      openEvent(ev.id);
      setEventPinsFilter(ev);
      setMapMode('max');
      if (window.PlanMap) {
        window.PlanMap.ensure();
        if (ev.lat != null && window.PlanMap.followEventLocation) window.PlanMap.followEventLocation(true);
        window.PlanMap.redraw();
      }
      return;
    }
    if (choice === 'open') {
      openEvent(ev.id);
    }
  }

  /* ---------- map ---------- */
  var MAP_MAX_ZOOM = 22;
  /* Match Hunt Slayer default map exactly: USGS Topo, AL center, same tile opts.
     No hunt-zone / public-lands / lidar overlays unless user enables plan tools later. */
  var HUNT_MAP_CENTER = [32.7794, -86.8287];
  var HUNT_MAP_ZOOM = 8;
  var HUNT_MAP_MIN_ZOOM = 8;
  var HUNT_MAX_BOUNDS = [[28.2, -91.8], [36.9, -82.2]];
  var TILE_PERF = {
    updateWhenIdle: false,
    updateWhenZooming: false,
    keepBuffer: 6,
    detectRetina: false,
    crossOrigin: true
  };
  var BASEMAPS = {
    topo: {
      url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
      opts: Object.assign({
        maxZoom: MAP_MAX_ZOOM,
        maxNativeZoom: 16,
        attribution: 'USGS'
      }, TILE_PERF)
    },
    satellite: {
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: Object.assign({
        maxZoom: MAP_MAX_ZOOM,
        maxNativeZoom: 19,
        attribution: 'Esri World Imagery · Maxar, Earthstar Geographics & GIS User Community',
        className: 'basemap-sat-tiles'
      }, TILE_PERF, {
        // Hunt sat tiles: no mid-zoom blanking
        updateWhenZooming: false,
        keepBuffer: 8,
        crossOrigin: false
      })
    },
    streets: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      opts: Object.assign({
        maxZoom: MAP_MAX_ZOOM,
        maxNativeZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap & CARTO'
      }, TILE_PERF)
    }
  };
  var LABELS_URL = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

  function loadMapSettings() {
    var s = loadJson(LOCAL_MAP_SETTINGS_KEY, null) || {};
    // #73 / V1.3.45 — use showCoordHud only (ignore old coordHud:true from prior defaults)
    var hudOn = s.showCoordHud === true;
    return {
      defaultBasemap: s.defaultBasemap || 'topo',
      labelsDefault: !!s.labelsDefault,
      coordHud: hudOn,
      showCoordHud: hudOn,
      softBounds: s.softBounds !== false
    };
  }
  function saveMapSettings(s) {
    saveJson(LOCAL_MAP_SETTINGS_KEY, s || loadMapSettings());
  }
  /** Coordinate HUD is opt-in only — never flash at launch */
  function applyCoordHudVisibility(forceOn) {
    var on = forceOn != null ? !!forceOn : !!loadMapSettings().coordHud;
    var hud = $('map-coord-hud');
    if (!hud) return on;
    hud.style.display = on ? '' : 'none';
    hud.classList.toggle('is-visible', on);
    hud.setAttribute('aria-hidden', on ? 'false' : 'true');
    try {
      if (window.PlanMap && typeof window.PlanMap.setCoordHudEnabled === 'function') {
        window.PlanMap.setCoordHudEnabled(on);
      }
    } catch (ePm) {}
    return on;
  }

  function setMapMode(mode) {
    if (mode !== 'mini' && mode !== 'max' && mode !== 'button') mode = 'mini';
    state.mapMode = mode;
    document.documentElement.classList.toggle('map-mode-max', mode === 'max');
    document.documentElement.classList.toggle('map-mode-mini', mode === 'mini');
    document.documentElement.classList.toggle('map-mode-button', mode === 'button');
    var dock = $('map-dock');
    var fab = $('map-fab-wrap');
    if (dock) {
      dock.classList.toggle('is-visible', mode === 'mini' || mode === 'max');
      dock.classList.toggle('fullscreen', mode === 'max');
    }
    if (fab) fab.classList.toggle('is-visible', mode === 'button');
    // Top-right controls: Max when square; Min when fullscreen (returns to square)
    if ($('map-maximize-btn')) $('map-maximize-btn').style.display = mode === 'mini' ? '' : 'none';
    if ($('map-minimize-btn')) $('map-minimize-btn').style.display = mode === 'max' ? '' : 'none';
    if ($('map-min-hide')) $('map-min-hide').style.display = (mode === 'mini' || mode === 'max') ? '' : 'none';
    if (mode === 'mini' || mode === 'max') {
      if (window.PlanMap) {
        window.PlanMap.ensure();
        setTimeout(function () { window.PlanMap.invalidate(); }, 120);
        setTimeout(function () { window.PlanMap.invalidate(); }, 320);
      } else if (typeof ensureMap === 'function') {
        ensureMap();
      }
      updateMapPinFilterBtn();
      try { updateMapViewingChip(); } catch (eC) {}
    } else {
      updateMapPinFilterBtn();
    }
  }
  /** Legacy helper used by older call sites */
  function setMapOpen(open) {
    setMapMode(open ? 'mini' : 'button');
  }

  function pinsForMapContext() {
    var ctx = state.mapContext || 'auto';
    if (ctx === 'personal') {
      return (loadPersonalBoard().mapPins) || [];
    }
    if (String(ctx).indexOf('event:') === 0) {
      var eid = String(ctx).slice(6);
      var e = (state.events || []).find(function (x) { return String(x.id) === eid; });
      if (e) return (e.state && e.state.mapPins) || [];
      return [];
    }
    // auto: active event map if open, else personal
    var ev = activeEvent();
    if (ev && !ev._personalOnly && state.view === 'event') {
      return (ev.state && ev.state.mapPins) || [];
    }
    return (loadPersonalBoard().mapPins) || [];
  }

  function configurePlanMap() {
    if (!window.PlanMap) return;
    window.PlanMap.configure({
      toast: function (m) { appToast(m); },
      alert: function (m, t) { return appAlert(m, t); },
      confirm: function (m, t) { return appConfirm(m, t); },
      getMyId: myId,
      getMyName: myName,
      getMyColor: myColor,
      getMembers: function () { return state.members || []; },
      getBasemapKey: function () {
        return (window.PlanMap && window.PlanMap.getMap) ? (state.basemapKey || 'topo') : 'topo';
      },
      ensureMapOpen: function () {
        if (state.mapMode === 'button') setMapMode('mini');
        else if (state.mapMode !== 'mini' && state.mapMode !== 'max') setMapMode('mini');
      },
      getCustomAreas: function () {
        var v = state.mapViewing;
        if (v && (v.mode === 'private' || v.mode === 'shared') && Array.isArray(v.customAreas)) {
          return v.customAreas;
        }
        return [];
      },
      getPins: function () {
        var v = state.mapViewing;
        // Explicit Hunt/Reg / event viewing from map switcher
        if (v && (v.mode === 'private' || v.mode === 'shared') && Array.isArray(v.pins)) {
          return v.pins;
        }
        if (v && v.mode === 'event' && Array.isArray(v.pins)) return v.pins;
        // Linked Hunt/Reg map overlay for the open event
        if (state._linkedMapOverlay && state._linkedMapOverlay.pins &&
            state.activeEventId && String(state._linkedMapOverlay.eventId) === String(state.activeEventId)) {
          var baseEv = activeEvent();
          var merged = (state._linkedMapOverlay.pins || []).slice();
          if (baseEv && baseEv.state && Array.isArray(baseEv.state.mapPins)) {
            baseEv.state.mapPins.forEach(function (p) {
              if (p) merged.push(p);
            });
          }
          return merged;
        }
        // Event pins only mode: pins for the active/filtered event
        if (state.eventPinsFilter && state.eventPinsFilter.eventId) {
          var fid = String(state.eventPinsFilter.eventId);
          var eOnly = (state.events || []).find(function (x) { return String(x.id) === fid; });
          if (eOnly && eOnly.state && Array.isArray(eOnly.state.mapPins)) {
            return eOnly.state.mapPins;
          }
          return [];
        }
        // Show all: personal + every event's pins (tag eventId for filtering later)
        if (state.showAllPins) {
          var all = (loadPersonalBoard().mapPins || []).slice();
          (state.events || []).forEach(function (e) {
            ((e.state && e.state.mapPins) || []).forEach(function (p) {
              if (!p) return;
              var copy = Object.assign({}, p);
              if (copy.eventId == null) copy.eventId = e.id;
              all.push(copy);
            });
          });
          return all;
        }
        return pinsForMapContext();
      },
      savePins: function (pins) {
        var v = state.mapViewing;
        // Saving while viewing Hunt/Reg map → push pins into that map_state (keep areas)
        if (v && (v.mode === 'private' || v.mode === 'shared') && v.id) {
          v.pins = pins || [];
          pushPinsToHuntRegMap(v.mode, v.id, pins || [], v.rawState || {});
          return;
        }
        if (v && v.mode === 'event' && v.id) {
          var eEv = (state.events || []).find(function (x) { return String(x.id) === String(v.id); });
          if (eEv) {
            if (!eEv.state) eEv.state = {};
            eEv.state.mapPins = pins || [];
            v.pins = pins || [];
            persistLocal();
            cloudSaveEvent(eEv);
          }
          return;
        }
        // Stamp eventId when saving under an event
        var stampId = null;
        if (state.eventPinsFilter && state.eventPinsFilter.eventId) stampId = state.eventPinsFilter.eventId;
        else if (state.activeEventId) stampId = state.activeEventId;
        if (stampId) {
          pins = (pins || []).map(function (p) {
            if (!p) return p;
            if (p.eventId == null && p.calendarEventId == null) p.eventId = stampId;
            return p;
          });
        }
        var ctx = state.mapContext || 'auto';
        if (ctx === 'personal' && !stampId) {
          var boardP = loadPersonalBoard();
          boardP.mapPins = pins || [];
          savePersonalBoard(boardP);
          return;
        }
        if (String(ctx).indexOf('event:') === 0) {
          var eid = String(ctx).slice(6);
          var e = (state.events || []).find(function (x) { return String(x.id) === eid; });
          if (e) {
            if (!e.state) e.state = {};
            e.state.mapPins = pins || [];
            persistLocal();
            cloudSaveEvent(e);
          }
          return;
        }
        var ev = activeEvent();
        if (ev && !ev._personalOnly && (state.view === 'event' || stampId)) {
          if (!ev.state) ev.state = {};
          // If event pins only, replace that event's pins; else keep current store
          if (state.eventPinsFilter && String(state.eventPinsFilter.eventId) === String(ev.id)) {
            ev.state.mapPins = pins || [];
          } else {
            ev.state.mapPins = pins || [];
          }
          saveActiveEvent();
        } else {
          var board = loadPersonalBoard();
          board.mapPins = pins || [];
          savePersonalBoard(board);
        }
      },
      getEventLocation: function () {
        var ev = activeEvent();
        if (ev && ev.lat != null) return { lat: ev.lat, lng: ev.lng, label: ev.location_label || ev.name || 'Event location' };
        return null;
      },
      setEventLocation: function (lat, lng) {
        var ev = activeEvent();
        if (!ev || ev._personalOnly) return false;
        if (!isEventCreator(ev)) {
          appToast('Only event creators can set the location');
          return false;
        }
        ev.lat = lat; ev.lng = lng;
        if (!ev.location_label) ev.location_label = 'Event location';
        saveActiveEvent();
        state._mapFollowedEvent = null;
        return true;
      },
      listEventsForLocation: function () {
        var uid = myId();
        var out = [];
        function canSet(ev) {
          if (!ev) return false;
          if (String(ev.owner_user_id) === String(uid)) return true;
          var creators = (ev.state && Array.isArray(ev.state.creators)) ? ev.state.creators : [];
          if (creators.some(function (c) { return String(c) === String(uid); })) return true;
          if (String(ev.id) === String(state.activeEventId)) {
            var m = (state.members || []).find(function (x) { return String(x.user_id) === String(uid); });
            if (m && (m.role === 'owner' || m.role === 'creator')) return true;
          }
          return false;
        }
        (state.events || []).forEach(function (ev) {
          if (canSet(ev)) out.push({ id: ev.id, name: ev.name || 'Event', lat: ev.lat, lng: ev.lng });
        });
        // Personal-only events (board)
        try {
          var board = loadPersonalBoard();
          (board.events || []).forEach(function (ev) {
            if (!canSet(ev) && String(ev.owner_user_id) !== String(uid)) return;
            if (out.some(function (x) { return String(x.id) === String(ev.id); })) return;
            out.push({ id: ev.id, name: (ev.name || 'Personal event') + ' · personal', lat: ev.lat, lng: ev.lng, personal: true });
          });
        } catch (e) {}
        return out;
      },
      setEventLocationById: function (eventId, lat, lng) {
        var ev = (state.events || []).find(function (e) { return String(e.id) === String(eventId); });
        var personal = false;
        var board = null;
        if (!ev) {
          board = loadPersonalBoard();
          ev = (board.events || []).find(function (e) { return String(e.id) === String(eventId); });
          personal = !!ev;
        }
        if (!ev) {
          appToast('Event not found');
          return false;
        }
        if (!personal) {
          var creators = (ev.state && Array.isArray(ev.state.creators)) ? ev.state.creators : [];
          var allowed = String(ev.owner_user_id) === String(myId()) ||
            creators.some(function (c) { return String(c) === String(myId()); }) ||
            isEventCreator(ev);
          if (!allowed) {
            appToast('Only event creators can set the location');
            return false;
          }
        }
        ev.lat = lat;
        ev.lng = lng;
        if (!ev.location_label) ev.location_label = 'Event location';
        ev.updated_at = new Date().toISOString();
        if (personal) {
          savePersonalBoard(board);
        } else {
          persistLocal();
          cloudSaveEvent(ev);
        }
        if (String(state.activeEventId) === String(ev.id)) {
          state._mapFollowedEvent = null;
          snapMapToActiveEvent(true);
        }
        return true;
      },
      openCreateEvent: function () {
        openCreateModal();
      },
      onShareLocation: function (loc) {
        var ev = activeEvent();
        var uid = myId() || 'local';
        if (ev && !ev._personalOnly) {
          if (!ev.state) ev.state = {};
          if (!ev.state.shareLocations) ev.state.shareLocations = {};
          if (!loc) {
            // Keep last known so others still see you after stop/close
            var prev0 = ev.state.shareLocations[uid];
            if (prev0 && prev0.lat != null) {
              prev0.active = false;
              prev0.at = prev0.at || new Date().toISOString();
            }
          } else if (loc.lat == null && loc.active === false) {
            var prev1 = ev.state.shareLocations[uid];
            if (prev1) prev1.active = false;
          } else {
            var prev = ev.state.shareLocations[uid] || {};
            ev.state.shareLocations[uid] = {
              lat: loc.lat != null ? loc.lat : prev.lat,
              lng: loc.lng != null ? loc.lng : prev.lng,
              at: loc.at || new Date().toISOString(),
              name: myName(),
              color: loc.color || myColor(),
              iconId: loc.iconId != null ? loc.iconId : (prev.iconId || null),
              heading: loc.heading != null ? loc.heading : (prev.heading != null ? prev.heading : null),
              scale: loc.scale != null ? loc.scale : (prev.scale != null ? prev.scale : 1),
              active: loc.active !== false
            };
          }
          saveActiveEvent();
          try {
            if (window.PlanMap && typeof window.PlanMap.redraw === 'function') window.PlanMap.redraw();
          } catch (eR) {}
        } else {
          var key = 'plan_slayer_share_loc_v1';
          if (!loc) {
            try {
              var raw = localStorage.getItem(key);
              if (raw) {
                var o = JSON.parse(raw);
                o.active = false;
                localStorage.setItem(key, JSON.stringify(o));
              }
            } catch (eK) { localStorage.removeItem(key); }
          } else localStorage.setItem(key, JSON.stringify(loc));
        }
      },
      getShareLocations: function () {
        var ev = activeEvent();
        if (ev && ev.state && ev.state.shareLocations) return ev.state.shareLocations;
        return {};
      }
    });
  }

  function ensureMap() {
    if (typeof L === 'undefined') return;
    var el = $('plan-map');
    if (!el) return;
    var ms = loadMapSettings();
    if (!state.map) {
      // Mirror Hunt Slayer initMap defaults (topo + AL statewide framing)
      var mapOpts = {
        center: HUNT_MAP_CENTER,
        zoom: HUNT_MAP_ZOOM,
        minZoom: HUNT_MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        preferCanvas: true,
        zoomControl: false,
        doubleClickZoom: false,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true
      };
      if (ms.softBounds) {
        mapOpts.maxBounds = HUNT_MAX_BOUNDS;
        mapOpts.maxBoundsViscosity = 0.2;
      }
      state.map = L.map('plan-map', mapOpts);
      state.basemapKey = ms.defaultBasemap || 'topo';
      if (!BASEMAPS[state.basemapKey]) state.basemapKey = 'topo';
      state.labelsOn = !!ms.labelsDefault;
      state.toolMode = null; // measure | draw | track | pin
      state.measurePts = [];
      state.drawPts = [];
      state.toolLayer = L.layerGroup().addTo(state.map);
      setBasemap(state.basemapKey);
      if (state.labelsOn) setLabelsOverlay(true);
      state.pinsLayer = L.layerGroup().addTo(state.map);
      state.map.on('click', function (e) {
        updateCoordHud(e.latlng.lat, e.latlng.lng);
        if (state.toolMode === 'measure') {
          onMeasureClick(e.latlng);
          return;
        }
        if (state.toolMode === 'draw') {
          onDrawClick(e.latlng);
          return;
        }
        if (state.toolMode === 'pin' || state.pinMode) {
          dropPlanPin(e.latlng);
          return;
        }
        // Event location is set only via map-dot → Add event location (not free click)
      });
      state.map.on('mousemove', function (e) {
        updateCoordHud(e.latlng.lat, e.latlng.lng);
      });
      state._mapViewSet = true;
      updateCoordHud(HUNT_MAP_CENTER[0], HUNT_MAP_CENTER[1]);
      updateMapChromeLabels();
    }
    applyCoordHudVisibility(!!ms.coordHud);
    var ev = activeEvent();
    if (ev && ev.lat != null && ev.lng != null && !state._mapFollowedEvent) {
      try {
        state.map.setView([Number(ev.lat), Number(ev.lng)], Math.max(12, state.map.getZoom() || 12), { animate: false });
        state._mapFollowedEvent = String(ev.id);
      } catch (e) {}
    }
    redrawPins(ev);
    setTimeout(function () {
      try { if (state.map) state.map.invalidateSize(); } catch (e) {}
    }, 50);
  }

  function updateMapChromeLabels() {
    var names = { topo: 'USGS Topo', satellite: 'Satellite', streets: 'Roads' };
    if ($('mbb-sub')) $('mbb-sub').textContent = names[state.basemapKey] || state.basemapKey || 'USGS Topo';
    var ev = activeEvent();
    if ($('mbb-date')) $('mbb-date').textContent = (ev && ev.name) ? String(ev.name).slice(0, 14) : 'Plan map';
    var radio = document.querySelector('input[name="map-basemap"][value="' + (state.basemapKey === 'streets' ? 'streets' : state.basemapKey) + '"]');
    // street radio value is streets in our HTML
    document.querySelectorAll('input[name="map-basemap"]').forEach(function (r) {
      r.checked = r.value === state.basemapKey;
    });
    if ($('map-labels-toggle')) $('map-labels-toggle').checked = !!state.labelsOn;
  }

  function setToolMode(mode) {
    // toggle off if same
    if (state.toolMode === mode) mode = null;
    state.toolMode = mode;
    state.pinMode = mode === 'pin';
    ['mdt-measure', 'mdt-draw', 'mdt-track', 'mdt-pin'].forEach(function (id) {
      var b = $(id);
      if (b) b.classList.toggle('is-on', state.toolMode && id === 'mdt-' + state.toolMode);
    });
    var hint = $('map-draw-hint');
    if (!mode) {
      if (hint) { hint.classList.remove('is-on'); hint.textContent = ''; }
      state.measurePts = [];
      state.drawPts = [];
      if (state.toolLayer) state.toolLayer.clearLayers();
      return;
    }
    if (hint) {
      hint.classList.add('is-on');
      if (mode === 'measure') hint.textContent = 'Measure: click points · click Measure again to stop';
      else if (mode === 'draw') hint.textContent = 'Draw: click points · click Draw again to finish';
      else if (mode === 'pin') hint.textContent = 'Pin: click the map to drop a pin';
      else if (mode === 'track') hint.textContent = 'Track: following GPS…';
    }
    if (mode === 'track') startSimpleTrack();
    else stopSimpleTrack();
  }

  function onMeasureClick(ll) {
    if (!state.toolLayer) return;
    state.measurePts.push(ll);
    L.circleMarker(ll, { radius: 5, color: '#fff', weight: 1, fillColor: '#e59a18', fillOpacity: 1 })
      .addTo(state.toolLayer);
    if (state.measurePts.length >= 2) {
      var a = state.measurePts[state.measurePts.length - 2];
      var b = state.measurePts[state.measurePts.length - 1];
      L.polyline([a, b], { color: '#e59a18', weight: 3 }).addTo(state.toolLayer);
      var miles = haversineMiles(a.lat, a.lng, b.lat, b.lng);
      L.marker(b, {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:rgba(0,0,0,0.75);color:#e59a18;padding:2px 6px;border-radius:4px;font:700 11px sans-serif;white-space:nowrap">' +
            miles.toFixed(2) + ' mi</div>'
        })
      }).addTo(state.toolLayer);
    }
  }

  function onDrawClick(ll) {
    if (!state.toolLayer) return;
    state.drawPts.push(ll);
    L.circleMarker(ll, { radius: 4, color: '#fff', weight: 1, fillColor: '#60a5fa', fillOpacity: 1 })
      .addTo(state.toolLayer);
    if (state.drawPts.length >= 2) {
      if (state._drawLine) try { state.toolLayer.removeLayer(state._drawLine); } catch (e) {}
      state._drawLine = L.polyline(state.drawPts, { color: '#60a5fa', weight: 2 }).addTo(state.toolLayer);
    }
  }

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var toR = Math.PI / 180;
    var dLat = (lat2 - lat1) * toR;
    var dLon = (lon2 - lon1) * toR;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function dropPlanPin(ll) {
    var ev = activeEvent();
    if (ev && !ev._personalOnly) {
      if (!ev.state.mapPins) ev.state.mapPins = [];
      ev.state.mapPins.push({
        id: uid(), lat: ll.lat, lng: ll.lng,
        name: 'Pin ' + (ev.state.mapPins.length + 1)
      });
      saveActiveEvent();
      redrawPins(ev);
    } else {
      var board = loadPersonalBoard();
      if (!board.mapPins) board.mapPins = [];
      board.mapPins.push({
        id: uid(), lat: ll.lat, lng: ll.lng,
        name: 'Pin ' + (board.mapPins.length + 1)
      });
      savePersonalBoard(board);
      redrawPins(null);
    }
  }

  function startSimpleTrack() {
    stopSimpleTrack();
    if (!navigator.geolocation || !state.map) return;
    state.trackPts = [];
    state.gpsWatch = navigator.geolocation.watchPosition(function (pos) {
      var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      state.trackPts.push(ll);
      if (state.gpsMarker) {
        try { state.map.removeLayer(state.gpsMarker); } catch (e) {}
      }
      state.gpsMarker = L.circleMarker(ll, {
        radius: 7, color: '#fff', weight: 2, fillColor: DEFAULT_ME_COLOR, fillOpacity: 1
      }).addTo(state.map);
      if (state.trackPts.length >= 2 && state.toolLayer) {
        if (state._trackLine) try { state.toolLayer.removeLayer(state._trackLine); } catch (e) {}
        state._trackLine = L.polyline(state.trackPts, { color: '#ef4444', weight: 3 }).addTo(state.toolLayer);
      }
      state.map.panTo(ll);
    }, function () {}, { enableHighAccuracy: true, maximumAge: 2000 });
  }
  function stopSimpleTrack() {
    if (state.gpsWatch != null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(state.gpsWatch); } catch (e) {}
      state.gpsWatch = null;
    }
  }

  function updateCoordHud(lat, lng) {
    var hud = $('map-coord-hud');
    if (!hud || lat == null || lng == null) return;
    // Never show coords unless Map settings → Show coordinate HUD is checked
    if (!loadMapSettings().coordHud) {
      hud.style.display = 'none';
      hud.classList.remove('is-visible');
      return;
    }
    hud.style.display = '';
    hud.classList.add('is-visible');
    hud.textContent = Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5);
  }

  function setBasemap(key) {
    if (!state.map || !BASEMAPS[key]) return;
    state.basemapKey = key;
    if (state.mapLayer) {
      try { state.map.removeLayer(state.mapLayer); } catch (e) {}
    }
    var b = BASEMAPS[key];
    state.mapLayer = L.tileLayer(b.url, b.opts).addTo(state.map);
    // keep labels above basemap if on
    if (state.labelsOn) setLabelsOverlay(true);
    document.querySelectorAll('input[name="map-basemap"]').forEach(function (r) {
      r.checked = r.value === key;
    });
    updateMapChromeLabels();
  }

  function setLabelsOverlay(on) {
    state.labelsOn = !!on;
    if (state.labelsLayer) {
      try { state.map.removeLayer(state.labelsLayer); } catch (e) {}
      state.labelsLayer = null;
    }
    if (state.labelsOn && state.map) {
      state.labelsLayer = L.tileLayer(LABELS_URL, {
        maxZoom: MAP_MAX_ZOOM, maxNativeZoom: 20, subdomains: 'abcd',
        opacity: 0.9, pane: 'overlayPane', attribution: '© CARTO labels'
      }).addTo(state.map);
    }
    var btn = $('map-labels-toggle');
    if (btn) {
      if (btn.type === 'checkbox') btn.checked = state.labelsOn;
      else btn.classList.toggle('is-active', state.labelsOn);
    }
  }

  function redrawPins(ev) {
    if (!state.pinsLayer) return;
    state.pinsLayer.clearLayers();
    var pins = [];
    if (ev && !ev._personalOnly) {
      if (ev.lat != null && ev.lng != null) {
        L.circleMarker([ev.lat, ev.lng], {
          radius: 9, color: '#fff', weight: 2, fillColor: '#e59a18', fillOpacity: 0.95
        }).bindPopup(esc(ev.location_label || 'Event location')).addTo(state.pinsLayer);
        updateCoordHud(ev.lat, ev.lng);
      }
      pins = ev.state.mapPins || [];
    } else {
      pins = (loadPersonalBoard().mapPins || []);
    }
    pins.forEach(function (p) {
      L.marker([p.lat, p.lng]).bindPopup(
        '<strong>' + esc(p.name || 'Pin') + '</strong><br>' +
        Number(p.lat).toFixed(5) + ', ' + Number(p.lng).toFixed(5)
      ).addTo(state.pinsLayer);
    });
  }

  async function toggleRadar() {
    if (!state.map) return;
    var btn = $('map-radar-toggle');
    var btn2 = $('map-radar-layer');
    var ctrl = $('map-radar-control');
    if (state.radarLayer) {
      try { state.map.removeLayer(state.radarLayer); } catch (e) {}
      state.radarLayer = null;
      if (btn) btn.setAttribute('aria-pressed', 'false');
      if (btn2) btn2.checked = false;
      if (ctrl) ctrl.classList.remove('radar-on');
      return;
    }
    try {
      var res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      var data = await res.json();
      var host = data.host;
      var frames = (data.radar && data.radar.past) || [];
      var last = frames[frames.length - 1];
      if (!last) return;
      var path = last.path;
      state.radarLayer = L.tileLayer(host + path + '/256/{z}/{x}/{y}/2/1_1.png', {
        opacity: 0.55,
        zIndex: 10,
        maxZoom: MAP_MAX_ZOOM
      }).addTo(state.map);
      if (btn) btn.setAttribute('aria-pressed', 'true');
      if (btn2) btn2.checked = true;
      if (ctrl) ctrl.classList.add('radar-on');
    } catch (e) {
      appToast('Radar unavailable right now.');
    }
  }

  function goGps() {
    // Prefer PlanMap (directional marker + snap)
    if (state.mapMode === 'button') setMapMode('mini');
    if (window.PlanMap && typeof window.PlanMap.goGps === 'function') {
      try { window.PlanMap.ensure(); window.PlanMap.goGps(); return; } catch (e) {}
    }
    ensureMap();
    if (!navigator.geolocation || !state.map) return;
    var btn = $('gps-snap-btn');
    if (btn) btn.classList.add('is-on');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      state.map.setView([lat, lng], 14);
      updateCoordHud(lat, lng);
      if (state.gpsMarker) {
        try { state.map.removeLayer(state.gpsMarker); } catch (e) {}
      }
      state.gpsMarker = L.circleMarker([lat, lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: myColor(), fillOpacity: 1
      }).bindPopup('You').addTo(state.map);
      setTimeout(function () { if (btn) btn.classList.remove('is-on'); }, 1200);
    }, function () {
      if (btn) btn.classList.remove('is-on');
      appAlert('Could not get location. Allow location access on this device.', 'Location');
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function parseLatLng(q) {
    q = String(q || '').trim();
    var m = q.match(/^(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)$/);
    if (!m) return null;
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: lat, lng: lng };
  }

  async function runMapSearch(q) {
    q = String(q || '').trim();
    var box = $('map-search-results');
    if (!q) {
      if (box) box.innerHTML = '';
      return;
    }
    var coords = parseLatLng(q);
    if (coords) {
      if (state.map) {
        state.map.setView([coords.lat, coords.lng], 14);
        updateCoordHud(coords.lat, coords.lng);
        L.circleMarker([coords.lat, coords.lng], {
          radius: 7, color: '#fff', weight: 2, fillColor: '#60a5fa', fillOpacity: 0.95
        }).bindPopup(coords.lat.toFixed(5) + ', ' + coords.lng.toFixed(5))
          .addTo(state.pinsLayer || state.map).openPopup();
      }
      if (box) box.innerHTML = '';
      return;
    }
    if (box) box.innerHTML = '<p class="muted" style="font-size:11px;padding:4px">Searching…</p>';
    try {
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(q);
      var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      var data = await res.json();
      if (!box) return;
      if (!data || !data.length) {
        box.innerHTML = '<p class="muted" style="font-size:11px;padding:4px">No results</p>';
        return;
      }
      box.innerHTML = data.map(function (r) {
        return '<button type="button" class="map-search-item" data-lat="' + esc(r.lat) +
          '" data-lng="' + esc(r.lon) + '">' + esc(r.display_name) + '</button>';
      }).join('');
    } catch (e) {
      if (box) box.innerHTML = '<p class="muted" style="font-size:11px;padding:4px">Search failed</p>';
    }
  }

  /* ---------- render ---------- */
  function membersChipsHtml(members, opts) {
    opts = opts || {};
    var list = (members || []).filter(Boolean);
    if (!list.length) {
      return '<span class="muted" style="font-size:11px">Just you</span>';
    }
    var scope = opts.scope || 'event'; // event | list
    var listId = opts.listId || '';
    return list.map(function (m) {
      var mid = m.user_id || m.id || m.display_name || '';
      var isOwner = m.role === 'owner';
      // Always clickable to see what they're bringing (remove is only in Edit event/list)
      return '<button type="button" class="member-chip member-chip-sm is-clickable' +
        '" style="margin:2px 4px 2px 0;display:inline-flex" ' +
        'data-member-chip="' + esc(String(mid)) + '" data-member-scope="' + esc(scope) +
        '" data-member-list-id="' + esc(listId) + '" title="What they are bringing">' +
        esc(m.display_name || m.username || 'Member') +
        (isOwner ? ' · host' : (m.provisional ? ' · name' : '')) +
        '</button>';
    }).join('');
  }

  /** Shared left-card chrome for lists (My lists) — same shape as event cards */
  function renderListCardHtml(n, opts) {
    opts = opts || {};
    try { normalizeNamedList(n); } catch (eN) {}
    var shared = listIsShared(n);
    var peopleN = listMemberCount(n);
    var linked = n.eventId ? eventNameById(n.eventId) : null;
    var active = String(n.id) === String(state.activeNamedListId) ? ' is-active' : '';
    var dates = listAssociatedDates(n);
    var cd = countdownHtml(dates.start, dates.end);
    // Members drawer when this card is open (and drawer not collapsed by click-away)
    var membersBlock = '';
    var listDrawerKey = 'list:' + String(n.id);
    var showListDrawer = !!active && state.membersDrawerKey !== '' &&
      (state.membersDrawerKey == null || String(state.membersDrawerKey) === listDrawerKey);
    if (active && showListDrawer) {
      var chips = membersChipsHtml(n.members || [], {
        scope: 'list', listId: n.id, canRemove: false
      });
      membersBlock = '<div class="event-card-members" data-list-members="' + esc(n.id) + '">' +
        renderInlineAddMembersHtml({
          prefix: 'list-card',
          scope: 'list',
          listId: n.id,
          drawerKey: listDrawerKey,
          canAdd: isNamedListOwner(n),
          membersHtml: chips
        }) + '</div>';
    }
    // Meta: people count only if >1, event name if linked — no item counts / "just you"
    var metaBits = [];
    if (peopleN > 1) metaBits.push(peopleN + ' people');
    if (isPersonalEventShadowList(n)) {
      var pevName = eventNameById(n.personalForEventId || n.eventId);
      if (pevName) metaBits.push('from ' + pevName);
      else metaBits.push('personal event list');
    } else if (linked) {
      metaBits.push('event: ' + linked);
    } else if (opts.badge && !linked) {
      metaBits.push(opts.badge);
    }
    var metaHtml = metaBits.length
      ? '<div class="ec-meta">' + esc(metaBits.join(' · ')) + '</div>'
      : '';
    // Name + countdown + Edit list (on the dropdown card)
    return (
      '<div class="event-card-wrap list-card-wrap' + active + (membersBlock ? ' has-members' : '') +
        (isPersonalEventShadowList(n) ? ' is-personal-event-list' : '') + '">' +
        '<div class="event-card' + active + '" data-open-list="' + esc(n.id) + '" role="button" tabindex="0">' +
          '<div class="ec-top">' +
            '<strong class="ec-name">' + esc(n.name || 'Untitled list') + '</strong>' +
            (cd ? ('<span class="ec-countdown">' + cd + '</span>') : '') +
            '<button type="button" class="btn ec-edit-btn" data-edit-list="' + esc(n.id) +
              '" title="Edit list">Edit list</button>' +
          '</div>' +
          metaHtml +
        '</div>' +
        membersBlock +
      '</div>'
    );
  }

  /** My events cards — same shell as lists, with Edit event on the card */
  function renderEventCardHtml(e) {
    var active = String(e.id) === String(state.activeEventId) ? ' is-active' : '';
    var linked = listsForEvent(e.id);
    var linkedList = linked[0] || null;
    var mems = (active && state.members && state.members.length)
      ? state.members
      : (e._cachedMembers || []);
    if ((!mems || !mems.length) && linkedList && linkedList.members && linkedList.members.length) {
      mems = linkedList.members;
    }
    // Unique people count for "N people"
    var peopleIds = {};
    (mems || []).forEach(function (m) {
      var id = String((m && (m.user_id || m.id)) || '');
      if (id) peopleIds[id] = true;
    });
    var peopleN = Math.max(Object.keys(peopleIds).length, mems && mems.length ? mems.length : 1);
    var shared = peopleN > 1;
    // Members drawer when event selected (names collapse on click-away)
    var membersBlock = '';
    var evDrawerKey = 'event:' + String(e.id);
    // membersDrawerKey: matching key = open; '' = collapsed; null = open for active card
    var showEvDrawer = !!active && state.membersDrawerKey !== '' &&
      (state.membersDrawerKey == null || String(state.membersDrawerKey) === evDrawerKey);
    if (active && showEvDrawer) {
      var canAddL = isEventCreator(e) || String(e.owner_user_id) === String(myId()) || !myId();
      var chips = membersChipsHtml(mems, {
        scope: 'event', listId: '', canRemove: false
      });
      membersBlock = '<div class="event-card-members" data-event-members="' + esc(e.id) + '">' +
        renderInlineAddMembersHtml({
          prefix: 'event-card',
          scope: 'event',
          listId: '',
          drawerKey: evDrawerKey,
          canAdd: canAddL,
          membersHtml: chips
        }) + '</div>';
    }
    var cd = countdownHtml(e.start_at, e.end_at);
    // Type + people count sit under the name (not beside edit buttons)
    var underBits = [];
    if (e.event_type) underBits.push(String(e.event_type));
    if (peopleN > 1) underBits.push(peopleN + ' people');
    var metaHtml = underBits.length
      ? '<div class="ec-meta">' + esc(underBits.join(' · ')) + '</div>'
      : '';
    // Name + countdown + Edit event (on the dropdown card)
    return (
      '<div class="event-card-wrap' + active + (membersBlock ? ' has-members' : '') + '">' +
        '<div class="event-card' + active + '" data-open-event="' + esc(e.id) + '" role="button" tabindex="0">' +
          '<div class="ec-top">' +
            '<strong class="ec-name">' + esc(e.name) + '</strong>' +
            (cd ? ('<span class="ec-countdown">' + cd + '</span>') : '') +
            '<button type="button" class="btn ec-edit-btn" data-edit-event="' + esc(e.id) +
              '" title="Edit event">Edit event</button>' +
          '</div>' +
          metaHtml +
        '</div>' +
        membersBlock +
      '</div>'
    );
  }

  function renderHomeList() {
    // Always My lists under the calendar (events live under calendar like Hunt)
    state.leftTab = 'lists';
    var personal = personalListsOnly();
    var eventLists = eventLinkedListsAll().filter(function (n) {
      return eventNameById(n.eventId);
    });
    var orphanLists = eventLinkedListsAll().filter(function (n) {
      return !eventNameById(n.eventId);
    });
    var htmlL = '';
    htmlL += '<div class="section-label section-label-lists">Personal lists</div>';
    if (!personal.length) {
      htmlL += '<p class="empty" style="margin:0 0 10px">No personal lists yet. Tap <strong>+</strong> — shopping, home, etc. stay here.</p>';
    } else {
      htmlL += personal.map(function (n) { return renderListCardHtml(n); }).join('');
    }
    htmlL += '<div class="section-label section-label-lists" style="margin-top:14px">Event lists</div>';
    if (!eventLists.length && !orphanLists.length) {
      htmlL += '<p class="empty">No event packing lists yet. Use <strong>+ Add Event</strong> under the calendar — its To do / To buy / To bring pack appears here.</p>';
    } else {
      htmlL += eventLists.map(function (n) {
        return renderListCardHtml(n, { badge: eventNameById(n.eventId) || 'event' });
      }).join('');
      if (orphanLists.length) {
        htmlL += '<div class="section-label" style="margin-top:10px">Event lists (event not loaded)</div>' +
          orphanLists.map(function (n) { return renderListCardHtml(n); }).join('');
      }
    }
    return htmlL;
  }

  function syncCalModeSwitchUi() {
    var mode = state.calListMode === 'chores' ? 'chores' : 'events';
    // Selected mode always on the left — buttons trade places
    var switchEl = document.querySelector('.cal-mode-switch');
    if (switchEl) {
      var leftMode = mode;
      var rightMode = mode === 'events' ? 'chores' : 'events';
      var leftLabel = leftMode === 'events' ? 'Events' : 'Chores';
      var rightLabel = rightMode === 'events' ? 'Events' : 'Chores';
      switchEl.innerHTML =
        '<button type="button" class="cal-mode-btn is-active" id="cal-mode-' + leftMode +
          '" data-cal-mode="' + leftMode + '">' + leftLabel + '</button>' +
        '<button type="button" class="cal-mode-btn" id="cal-mode-' + rightMode +
          '" data-cal-mode="' + rightMode + '">' + rightLabel + '</button>';
    }
    var addBtn = $('add-event-tab-btn');
    if (addBtn) {
      if (mode === 'chores') {
        addBtn.textContent = '+ Schedule chore';
        addBtn.title = 'Schedule a chore (list item optional)';
      } else {
        addBtn.textContent = '+ Add Event';
        addBtn.title = 'Add event';
      }
    }
    var titleEl = $('events-title-date');
    if (titleEl) {
      // Larger label above the Events / Chores switch
      if (mode === 'chores') {
        titleEl.textContent = state.sideCal && state.sideCal.selectedDay
          ? ('Chores · ' + state.sideCal.selectedDay)
          : 'Chores';
      } else {
        titleEl.textContent = state.sideCal && state.sideCal.selectedDay
          ? ('Events · ' + state.sideCal.selectedDay)
          : 'Events';
      }
    }
  }

  /** Compact event or chore rows under the calendar */
  function renderCalendarEventsList() {
    var box = $('calendar-events-list');
    if (!box) return;
    syncCalModeSwitchUi();
    var mode = state.calListMode === 'chores' ? 'chores' : 'events';
    if (mode === 'chores') {
      // Always collect from lists + standalone (hidden still listed)
      var chores = collectAllChores({ includeHidden: true });
      var totalChores = chores.length;
      // Day filter only when a calendar day is selected; otherwise show ALL chores
      // (month filter was hiding scheduled chores outside the visible month)
      if (state.sideCal && state.sideCal.selectedDay) {
        var day = state.sideCal.selectedDay;
        chores = chores.filter(function (ch) {
          var s = choreYmd(ch) || ymdFromIso(ch.chore_at);
          var e = ymdFromIso(ch.chore_end_at) || s;
          return s && day >= s && day <= e;
        });
      }
      if (!chores.length) {
        if (totalChores > 0 && state.sideCal && state.sideCal.selectedDay) {
          box.innerHTML = '<p class="empty" style="margin:4px 0;font-size:11px">No chores on <strong>' +
            esc(state.sideCal.selectedDay) + '</strong>. Tap the day again to clear filter, or ' +
            '<button type="button" class="btn" id="chore-show-all-btn" style="margin-left:4px">Show all ' +
            totalChores + '</button></p>';
          var showAllBtn = $('chore-show-all-btn');
          if (showAllBtn) {
            showAllBtn.onclick = function () {
              state.sideCal.selectedDay = null;
              renderSideCalendar();
              renderCalendarEventsList();
            };
          }
        } else {
          box.innerHTML = '<p class="empty" style="margin:4px 0;font-size:11px">No chores yet. Tap <strong>+ Schedule chore</strong> (same idea as + Add Event).</p>';
        }
        return;
      }
      box.innerHTML = chores.slice(0, 80).map(function (ch) {
        return renderChoreCardHtml(ch);
      }).join('');
      return;
    }
    var list = sortedEvents();
    if (state.eventsScope === 'month' && state.sideCal) {
      var y2 = state.sideCal.y;
      var m2 = state.sideCal.m;
      list = list.filter(function (e) {
        if (!e.start_at) return true;
        try {
          var d = new Date(e.start_at);
          return d.getFullYear() === y2 && d.getMonth() === m2;
        } catch (err) { return true; }
      });
    }
    if (state.sideCal && state.sideCal.selectedDay) {
      var day2 = state.sideCal.selectedDay;
      list = list.filter(function (e) {
        if (!e.start_at) return true;
        var s = ymdFromIso(e.start_at);
        var en = ymdFromIso(e.end_at) || s;
        return s && day2 >= s && day2 <= en;
      });
    }
    if (!list.length) {
      box.innerHTML = '<p class="empty" style="margin:4px 0;font-size:11px">No events yet. Tap <strong>+ Add Event</strong>.</p>';
      return;
    }
    box.innerHTML = list.slice(0, 40).map(function (e) {
      return renderEventCardHtml(e);
    }).join('');
  }

  function renderChoreCardHtml(ch) {
    if (!ch) return '';
    var when = '';
    try {
      var d = new Date(ch.chore_at || ch.start_at);
      when = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      if (ch.chore_end_at || ch.end_at) {
        var d2 = new Date(ch.chore_end_at || ch.end_at);
        when += ' – ' + d2.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      }
    } catch (e) { when = ''; }
    var startAt = ch.chore_at || ch.start_at;
    var endAt = ch.chore_end_at || ch.end_at || startAt;
    var cd = countdownHtml(startAt, endAt);
    var hidden = ch.showOnCalendar === false;
    var cid = ch.choreId || ch.id || '';
    var openAttrs = ' data-open-chore-id="' + esc(cid) + '"';
    // Compact: name + actions on one row; T minus under the name (not beside it)
    return (
      '<div class="event-card-wrap chore-card-wrap' + (ch.done ? ' is-done' : '') + '">' +
        '<div class="event-card chore-event-card"' + openAttrs + ' role="button" tabindex="0">' +
          '<div class="ec-top chore-ec-top">' +
            '<div class="chore-ec-main">' +
              '<div class="chore-ec-name-row">' +
                '<span class="ec-dot" style="background:' + esc(ch.color || DEFAULT_CHORE_COLOR) + '"></span>' +
                '<strong class="ec-name">' + esc(ch.title || ch.name || 'Chore') + '</strong>' +
              '</div>' +
              (cd && !ch.done ? ('<div class="chore-ec-countdown ec-countdown">' + cd + '</div>') : '') +
              '<div class="ec-meta chore-ec-meta">Chore' +
                (when ? (' · ' + esc(when)) : '') +
                (hidden ? ' · <span style="opacity:0.75">hidden from calendar</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="ec-chore-actions">' +
              '<button type="button" class="btn ec-edit-btn"' + openAttrs + ' title="Edit chore">Edit chore</button>' +
              '<button type="button" class="btn btn-got ec-chore-done" data-chore-done="' + esc(cid) +
                '" title="Mark chore done">Done!</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function syncLeftTabChrome() {
    // Single My lists chrome — events are under the calendar
    state.leftTab = 'lists';
    document.querySelectorAll('[data-left-tab]').forEach(function (b) {
      b.classList.add('is-active');
      b.setAttribute('aria-selected', 'true');
    });
    if ($('btn-create-list')) $('btn-create-list').style.display = '';
    if ($('btn-join-event')) $('btn-join-event').style.display = '';
    if ($('events-filter-row')) $('events-filter-row').style.display = 'none';
    if ($('home-controls')) $('home-controls').style.display = 'none';
    if ($('search-input')) $('search-input').placeholder = 'Search lists…';
  }

  function currentListBucket() {
    // Named My list takes priority
    if (state.activeNamedListId) {
      var fb = getActiveFreeBucket();
      return { bucket: fb.bucket, scope: 'free-list', free: fb, ev: null };
    }
    // Event group lists when event open
    var ev = activeEvent();
    if (ev && !ev._personalOnly && state.view === 'event') {
      return { bucket: getListBucket(ev, state.listTab, 'group'), scope: 'group', ev: ev };
    }
    var empty = getActiveFreeBucket();
    return { bucket: empty.bucket, scope: 'free-list', free: empty, ev: null };
  }

  function formatEventDateLabel(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }

  function updateEventDateDisplay(ev) {
    if (!ev) return;
    var startLabel = formatEventDateLabel(ev.start_at);
    var endLabel = formatEventDateLabel(ev.end_at);
    var startBtn = $('ev-start-tbd');
    var endBtn = $('ev-end-tbd');
    var startSp = $('ev-start');
    var endSp = $('ev-end');
    if (startBtn) {
      startBtn.textContent = startLabel ? 'Change' : 'TBD';
      startBtn.classList.toggle('is-tbd', !startLabel);
    }
    if (endBtn) {
      endBtn.textContent = endLabel ? 'Change' : 'TBD';
      endBtn.classList.toggle('is-tbd', !endLabel);
    }
    if (startSp) startSp.textContent = startLabel ? (' · ' + startLabel) : '';
    if (endSp) endSp.textContent = endLabel ? (' · ' + endLabel) : '';
    if ($('edit-ev-start-btn')) $('edit-ev-start-btn').textContent = startLabel || 'TBD';
    if ($('edit-ev-end-btn')) $('edit-ev-end-btn').textContent = endLabel || 'TBD';
  }

  function listAsText(bucket, kind) {
    var heading = listKindLabel(kind) || String(kind || 'List');
    var lines = [heading + ':'];
    (bucket || []).forEach(function (it) {
      if (!it) return;
      var c = { total: 0, need: Math.max(1, Number(it.qty) || 1) };
      try { c = claimsFilled(it); } catch (eC) {}
      var mark = c.total >= c.need ? '[x]' : '[ ]';
      lines.push(mark + ' ' + (it.title || 'Item') + (it.qty > 1 ? ' ×' + it.qty : ''));
      if (it.notes) lines.push('    note: ' + it.notes);
    });
    if (lines.length === 1) lines.push('(empty)');
    return lines.join('\n');
  }
  /** One column of a named list as plain text */
  function listSectionAsText(list, colId) {
    if (!list) return '';
    try { sanitizeNamedList(list); } catch (e) {}
    var col = getListColumn(list, colId);
    var items = (col && col.items) || [];
    var heading = (col && col.name) || listKindLabel(colId) || 'Section';
    var title = (list.name || 'List') + ' · ' + heading;
    return title + '\n\n' + listAsText(items, colId || heading);
  }
  /** Full named list: all sections except private My checklist */
  function fullListAsText(list) {
    if (!list) return '';
    try { sanitizeNamedList(list); } catch (e) {}
    var parts = [list.name || 'List'];
    (list.columns || []).forEach(function (c) {
      if (!c || String(c.id) === 'personal') return;
      parts.push('');
      parts.push(listAsText(c.items || [], c.id));
    });
    return parts.join('\n');
  }
  /** Copy or native-share text (mobile prefers share sheet when available) */
  function shareOrCopyText(text, title) {
    text = String(text || '').trim();
    if (!text) {
      appToast('Nothing to share yet');
      return Promise.resolve(false);
    }
    title = title || 'Plan Slayer list';
    if (navigator.share) {
      return navigator.share({ title: title, text: text }).then(function () {
        return true;
      }).catch(function (err) {
        // User cancelled share sheet — don't fall through as error spam
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return false;
        return copyText(text);
      });
    }
    return copyText(text);
  }
  var _shareScopeCtx = { listId: null, colId: null };
  function openShareScopeModal(list, colId) {
    if (!list) {
      appToast('Open a list first');
      return;
    }
    try { sanitizeNamedList(list); } catch (e) {}
    var col = colId ? getListColumn(list, colId) : null;
    if (!col) {
      colId = state.listTab || (list.columns[0] && list.columns[0].id) || 'todo';
      col = getListColumn(list, colId);
    }
    _shareScopeCtx = { listId: list.id, colId: colId };
    var secName = (col && col.name) || listKindLabel(colId) || 'This section';
    if ($('share-scope-title')) $('share-scope-title').textContent = 'Share · ' + (list.name || 'List');
    if ($('share-scope-sub')) {
      $('share-scope-sub').textContent = 'Send the section you’re viewing, or the whole pack.';
    }
    if ($('share-scope-section-label')) {
      $('share-scope-section-label').textContent = 'This section only · ' + secName;
    }
    if ($('share-scope-modal')) {
      $('share-scope-modal').classList.add('is-open');
      $('share-scope-modal').setAttribute('aria-hidden', 'false');
    }
  }
  function closeShareScopeModal() {
    if ($('share-scope-modal')) {
      $('share-scope-modal').classList.remove('is-open');
      $('share-scope-modal').setAttribute('aria-hidden', 'true');
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function renderFriends() {
    var box = $('friends-list');
    if (!box) return;
    loadFriends();
    var q = String(state.friendsSearch || '').toLowerCase().trim();
    var list = (state.friends || []).slice();
    if (q) {
      list = list.filter(function (f) {
        return String(f.display_name || '').toLowerCase().indexOf(q) >= 0 ||
          String(f.username || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    list.sort(function (a, b) {
      return String(a.display_name || '').localeCompare(String(b.display_name || ''));
    });
    box.innerHTML = list.map(function (f) {
      return '<div class="friend-row">' +
        '<span class="friend-swatch" style="background:' + esc(f.arrow_color || COLORS[0]) + '"></span>' +
        '<div style="flex:1;min-width:0"><strong>' + esc(f.display_name || 'Friend') + '</strong>' +
        (f.username ? '<div class="muted" style="font-size:11px">@' + esc(f.username) + '</div>' : '') +
        '</div></div>';
    }).join('') || '<p class="empty">No friends yet. Join events or maps with others to build this list.</p>';
  }

  function renderInboxBanner() {
    var area = $('inbox-area');
    if (!area) return;
    if (state.mode !== 'personal') { area.innerHTML = ''; return; }
    var board = loadPersonalBoard();
    var recent = (board.inbox || []).slice(-3).reverse();
    if (!recent.length) { area.innerHTML = ''; return; }
    area.innerHTML = recent.map(function (p) {
      return '<div class="inbox-banner">' + esc(p.fromName || 'Someone') + ' shared ' +
        (p.count || 0) + ' item(s) to your ' + esc(p.kind || 'list') +
        ' · you can delete any item anytime</div>';
    }).join('');
  }

  /** Preserve list scroll positions across full render() rebuilds (#76) */
  function captureListScrollPositions() {
    var out = { cols: {} };
    try {
      var ev = $('ev-list');
      if (ev) out.evList = ev.scrollTop;
      var mls = $('mls-body');
      if (mls) out.mls = mls.scrollTop;
      var planBody = document.querySelector('.card-planner .card-body');
      if (planBody) out.planBody = planBody.scrollTop;
      var listsBody = document.querySelector('.card-lists .card-body');
      if (listsBody) out.listsBody = listsBody.scrollTop;
      document.querySelectorAll('.list-col-body[data-col-body]').forEach(function (el) {
        var k = el.getAttribute('data-col-body');
        if (k) out.cols[k] = el.scrollTop;
      });
    } catch (e) {}
    return out;
  }
  function restoreListScrollPositions(saved) {
    if (!saved) return;
    function apply() {
      try {
        if (saved.evList != null && $('ev-list')) $('ev-list').scrollTop = saved.evList;
        if (saved.mls != null && $('mls-body')) $('mls-body').scrollTop = saved.mls;
        if (saved.planBody != null) {
          var planBody = document.querySelector('.card-planner .card-body');
          if (planBody) planBody.scrollTop = saved.planBody;
        }
        if (saved.listsBody != null) {
          var listsBody = document.querySelector('.card-lists .card-body');
          if (listsBody) listsBody.scrollTop = saved.listsBody;
        }
        if (saved.cols) {
          Object.keys(saved.cols).forEach(function (k) {
            var el = document.querySelector('.list-col-body[data-col-body="' + String(k).replace(/"/g, '') + '"]');
            if (el) el.scrollTop = saved.cols[k];
          });
        }
      } catch (e) {}
    }
    try {
      apply();
      requestAnimationFrame(function () {
        apply();
        requestAnimationFrame(apply);
      });
    } catch (e2) {}
  }

  function render() {
    // Full UI rebuild replaces #ev-list / mobile triad — keep in-progress item typing
    var listAddDraft = captureListAddDrafts();
    var listScroll = captureListScrollPositions();

    // Keep header badge in sync with APP_VERSION (avoid stale index.html hardcode)
    try {
      var vb = $('ver-badge');
      if (vb) vb.textContent = 'V' + APP_VERSION;
    } catch (eVb) {}

    var who = $('user-chip') || $('user-chip-btn');
    if (who) who.textContent = myName();

    mergeInboxIntoPersonal();
    // Calendar collapsed state
    try {
      if (state.calCollapsed == null) {
        state.calCollapsed = localStorage.getItem(LOCAL_CAL_COLLAPSED_KEY) === '1';
      }
    } catch (eCal) {}
    var sideCal = $('side-cal');
    var sideCalBlock = $('side-cal-block');
    var calFab = $('cal-collapsed-btn');
    if (sideCalBlock) {
      sideCalBlock.classList.toggle('is-collapsed', !!state.calCollapsed);
      sideCalBlock.style.display = state.calCollapsed ? 'none' : '';
    }
    if (sideCal) {
      sideCal.classList.toggle('is-collapsed', !!state.calCollapsed);
      sideCal.style.display = state.calCollapsed ? 'none' : '';
    }
    if (calFab) {
      calFab.style.display = state.calCollapsed ? '' : 'none';
      calFab.setAttribute('aria-hidden', state.calCollapsed ? 'false' : 'true');
    }
    renderSideCalendar();
    try { renderCalendarEventsList(); } catch (eCel) {}
    setMapMode(state.mapMode);
    ensureCountdownTicker();

    // Left: My lists (events under calendar like Hunt)
    var eventsBlock = $('panel-events-block');
    var friendsPanel = $('panel-friends');
    if (eventsBlock) eventsBlock.style.display = '';
    if (friendsPanel) friendsPanel.style.display = 'none';
    syncLeftTabChrome();

    // Month / all toggles (events tab only)
    if ($('btn-events-month')) $('btn-events-month').classList.toggle('is-active', state.eventsScope === 'month');
    if ($('btn-events-all')) $('btn-events-all').classList.toggle('is-active', state.eventsScope === 'all');

    var homeL = $('view-home-list');
    var meta = $('event-meta');
    var listsPh = $('lists-placeholder');
    var listsAct = $('lists-active');
    var listsTitle = $('lists-title');
    var headActions = $('lists-head-actions');

    var showEv = state.view === 'event' && !!activeEvent();
    var ev = activeEvent();

    // LEFT: browse only (never stack selected detail under calendar/map)
    if (homeL) {
      homeL.innerHTML = renderHomeList();
      homeL.style.display = '';
      // Wire Add members under the active card (lists or events look the same)
      if (state.leftTab === 'events' && state.activeEventId) {
        wireInlineMemberSearch('event-card', null, 'event');
      }
      if (state.leftTab === 'lists' && state.activeNamedListId) {
        wireInlineMemberSearch('list-card', state.activeNamedListId, 'list');
      }
    }

    document.querySelectorAll('[data-list-tab]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-list-tab') === state.listTab);
    });
    var openList = null;
    try {
      openList = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null;
    } catch (eFind) {
      console.warn('findNamedListById', eFind);
      openList = null;
    }
    // If we have an active list id but lookup failed, clear and show empty rather than silent fail
    if (state.activeNamedListId && !openList) {
      console.warn('activeNamedListId missing from store', state.activeNamedListId);
    }
    var showingListDetail = !!openList;
    // Event meta (no list pack): only when event open and list pack missing
    var showingEventDetail = !showingListDetail && showEv && ev && !ev._personalOnly;

    if (listsTitle) {
      // #71 — list/event name + T-minus on one line (no separate Back / countdown block)
      var titleText = 'Details';
      var titleCd = '';
      if (showingListDetail) {
        titleText = openList.name || 'List';
        try {
          var datesTitle = listAssociatedDates(openList);
          if (datesTitle && datesTitle.start) titleCd = countdownHtml(datesTitle.start, datesTitle.end);
        } catch (eTc) {}
      } else if (showingEventDetail) {
        titleText = ev.name || 'Event';
        try {
          if (ev.start_at) titleCd = countdownHtml(ev.start_at, ev.end_at);
        } catch (eTe) {}
      }
      listsTitle.innerHTML = '<span class="lists-title-name">' + esc(titleText) + '</span>' +
        (titleCd ? (' <span class="lists-title-cd">' + titleCd + '</span>') : '');
    }
    if (headActions) headActions.style.display = (showingListDetail || showingEventDetail) ? '' : 'none';
    try { updateBackButtonsVisibility(); } catch (eBk) {}

    if (showingListDetail) {
      setRightPanelMode('list');
      // #71 — countdown lives next to #lists-title; hide legacy bar countdown slot
      if ($('list-detail-bar')) {
        // Keep bar only if members chips need it; otherwise collapse empty bar
        try {
          var barMem0 = $('list-bar-members');
          var hasMem = barMem0 && listIsShared(openList);
          $('list-detail-bar').style.display = hasMem ? '' : 'none';
        } catch (eBar) {
          $('list-detail-bar').style.display = 'none';
        }
      }
      try {
        var barCd = $('list-bar-countdown');
        if (barCd) { barCd.innerHTML = ''; barCd.style.display = 'none'; }
      } catch (eCd) {}
      // Ensure My checklist column exists + mirror claims (same on mobile & desktop)
      try {
        if (listWantsPersonalChecklist(openList) || openList.eventId) {
          ensurePersonalColumn(openList);
          rebuildMyChecklistFromClaims(openList);
        }
      } catch (ePers) {}
      // Compact member chips in the detail bar (never inside #ev-list — that crushed the triad)
      try {
        var barMem = $('list-bar-members');
        if (barMem) {
          var sharedList = listIsShared(openList);
          if (sharedList) {
            barMem.style.display = '';
            barMem.innerHTML = membersChipsHtml(openList.members || [], {
              scope: 'list', listId: openList.id, canRemove: false
            });
            if ($('list-detail-bar')) $('list-detail-bar').style.display = '';
          } else {
            barMem.style.display = 'none';
            barMem.innerHTML = '';
            if ($('list-detail-bar')) $('list-detail-bar').style.display = 'none';
          }
        }
      } catch (eBarM) {}
      try { maybeOfferMemberClaim(openList); } catch (eClaim) {}
      if ($('list-kind-tabs')) $('list-kind-tabs').style.display = 'none';
      if ($('event-add-bar')) $('event-add-bar').style.display = 'none';
      if ($('inbox-area')) $('inbox-area').innerHTML = '';
      // ONLY the triad in #ev-list — heal list first so reopen always works
      openList = sanitizeNamedList(openList);
      // Soft heal only — avoid saveNamedList on every open (was racing cloud pull → blank lists)
      if (!state._healedLists) state._healedLists = {};
      if (!state._healedLists[String(openList.id)]) {
        state._healedLists[String(openList.id)] = true;
      }
      var qEvList = { state: { qualifiers: DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); }) } };
      try {
        var aevQ = openList.eventId ? findEventById(openList.eventId) : null;
        if (aevQ && aevQ.state && aevQ.state.qualifiers) qEvList.state.qualifiers = aevQ.state.qualifiers;
      } catch (eQ0) {}
      if ($('ev-list')) {
        try {
          $('ev-list').innerHTML = renderListTriad(openList, qEvList);
          // Recover if render produced nothing
          if (!$('ev-list').innerHTML || !$('ev-list').innerHTML.trim()) {
            $('ev-list').innerHTML = renderListTriad(sanitizeNamedList(findNamedListById(openList.id) || openList), qEvList);
          }
        } catch (eTri) {
          console.warn('renderListTriad', eTri);
          // Absolute last resort: three empty columns + any raw titles
          $('ev-list').innerHTML =
            '<div class="list-triad" id="list-triad" data-list-id="' + esc(openList.id) + '">' +
            ['todo', 'buy', 'bring'].map(function (k) {
              return '<div class="list-col" data-col-kind="' + k + '">' +
                '<div class="list-col-head"><span class="list-col-title">' + esc(listKindLabel(k)) + '</span></div>' +
                '<div class="list-col-body" data-col-body="' + k + '" data-col-focus-add="' + k + '"><p class="empty">Nothing here yet.</p></div>' +
                '<div class="list-col-add">' +
                  '<input type="text" class="list-col-add-input" data-col-add-input="' + k + '" placeholder="Type item, press Enter…" />' +
                  '<button type="button" class="btn btn-icon list-ocr-cam" data-ocr-list="' + k +
                    '" title="Photo → items"><img src="icons/pins/camera.png" alt="" width="18" height="18" /></button>' +
                  '<button type="button" class="btn btn-primary list-col-add-btn" data-col-add="' + k + '">Add</button>' +
                '</div></div>';
            }).join('') + '</div>';
        }
        try { wireListColumnUi(openList); } catch (eW) { console.warn(eW); }
      }
      try { renderQualifierFilters(qEvList, openList); } catch (eF) { console.warn(eF); }
    } else if (showingEventDetail) {
      setRightPanelMode('event');
      if ($('list-detail-bar')) $('list-detail-bar').style.display = 'none';
      if ($('list-kind-tabs')) $('list-kind-tabs').style.display = 'none';
      if ($('event-add-bar')) $('event-add-bar').style.display = 'none';
      if ($('inbox-area')) $('inbox-area').innerHTML = '';
      // Name/type/dates only in Edit event — keep countdown on the right
      // #71 — countdown is on #lists-title; hide duplicate slot under event chrome
      if ($('ev-countdown')) {
        $('ev-countdown').innerHTML = '';
        $('ev-countdown').style.display = 'none';
      }
      try {
        if ($('ev-members')) {
          var canRemEv = isEventCreator(ev) || String(ev.owner_user_id) === String(myId()) || !myId();
          $('ev-members').innerHTML = membersChipsHtml(state.members || [], {
            scope: 'event', listId: '', canRemove: false
          });
        }
        renderExpenses(ev);
        collectFriendsFromMembers();
        // Prefer linked packing triad when present even without activeNamedListId
        var linkedForEv = listsForEvent(ev.id);
        if (linkedForEv.length) {
          state.activeNamedListId = linkedForEv[0].id;
          // re-enter list mode this frame
          openList = linkedForEv[0];
          setRightPanelMode('list');
          if ($('list-detail-bar')) $('list-detail-bar').style.display = '';
          try {
            var barCd2 = $('list-bar-countdown');
            if (barCd2) {
              barCd2.innerHTML = ev.start_at ? countdownHtml(ev.start_at, ev.end_at) : '';
            }
          } catch (eCd2) {}
          if ($('ev-list')) {
            var qEv2 = { state: { qualifiers: DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); }) } };
            try {
              if (ev.state && ev.state.qualifiers) qEv2.state.qualifiers = ev.state.qualifiers;
            } catch (eQ) {}
            $('ev-list').innerHTML = renderListTriad(openList, qEv2);
            wireListColumnUi(openList);
            renderQualifierFilters(ev, openList);
          }
        } else if ($('ev-list')) {
          $('ev-list').innerHTML = renderEventTriad(ev);
          renderQualifierFilters(ev, null);
        }
      } catch (eEvUi) {
        console.warn('event detail UI', eEvUi);
        if ($('ev-list')) $('ev-list').innerHTML = '<p class="empty">Could not open event lists.</p>';
      }
    } else {
      setRightPanelMode('empty');
      if (listsPh) {
        listsPh.textContent = state.leftTab === 'lists'
          ? 'Select a personal list on the left — To do / To buy / To bring open here on the right.'
          : 'Select an event on the left — details and packing columns open here on the right.';
      }
      renderQualifierFilters(null);
    }

    if (state.mapMode === 'mini' || state.mapMode === 'max') {
      if (window.PlanMap) {
        window.PlanMap.ensure();
        window.PlanMap.redraw();
        window.PlanMap.invalidate();
      }
      // When viewing an event (or its lists) with map open, snap once to event location
      if (showEv && ev && ev.lat != null && state._mapFollowedEvent !== String(ev.id)) {
        snapMapToActiveEvent(false);
      }
    }
    updateMapPinFilterBtn();
    wireListDrag();
    // Keep mobile sheet in sync when open
    if (state.mobileSheetOpen && isMobileLayout()) {
      try { renderMobileListSheet(); } catch (eMs) {}
    } else if (state.mobileSheetOpen && !isMobileLayout()) {
      closeMobileListSheet(true);
    }
    // Restore typed text + caret after triad/sheet DOM was rebuilt
    try { restoreListAddDrafts(listAddDraft); } catch (eDraft) {}
    // Restore list scroll after full rebuild (#76)
    try { restoreListScrollPositions(listScroll); } catch (eScr) {}
  }

  /**
   * Drag-and-drop reorder via ⋮⋮ handle (desktop + mobile).
   * Item follows the finger with transform; drop index from frozen slot mids.
   * Uses pointer + touch (iOS) without pointer-events:none on the handle.
   */
  var _dragState = null;
  function wireListDrag() {
    if (document._psListDragWired) return;
    document._psListDragWired = true;

    function bucketForRow(row) {
      if (!row) return null;
      var kind = row.getAttribute('data-kind');
      var scope = row.getAttribute('data-scope');
      var id = row.getAttribute('data-item-id');
      if (scope === 'group') {
        var ev = activeEvent();
        if (!ev) return null;
        return { bucket: getListBucket(ev, kind, 'group'), kind: kind, scope: scope, id: id, save: function () { saveActiveEvent(); } };
      }
      if (scope === 'free-list' || scope === 'personal-board') {
        var nlist = resolveOpenNamedList(row) || findNamedListById(state.activeNamedListId);
        var hit = nlist ? findInNamedListColumn(nlist, kind, id) : null;
        if (hit) {
          return {
            bucket: hit.bucket, kind: hit.colId, scope: scope, id: id,
            save: function () { saveNamedList(hit.list); }
          };
        }
      }
      var free = getActiveFreeBucket(kind);
      if (!free || !free.bucket) return null;
      return {
        bucket: free.bucket, kind: kind, scope: scope, id: id,
        save: function () {
          if (free.named) saveNamedList(free.named);
          else saveFreeListsStore(free.store);
        }
      };
    }

    /**
     * Reorder so fromId ends up at the position of targetId (before or after).
     */
    function reorderRelative(bucket, fromId, targetId, placeAfter) {
      if (!bucket || String(fromId) === String(targetId)) return false;
      var fromIdx = -1;
      var toIdx = -1;
      var i;
      for (i = 0; i < bucket.length; i++) {
        if (String(bucket[i].id) === String(fromId)) fromIdx = i;
        if (String(bucket[i].id) === String(targetId)) toIdx = i;
      }
      if (fromIdx < 0 || toIdx < 0) return false;
      var item = bucket.splice(fromIdx, 1)[0];
      toIdx = -1;
      for (i = 0; i < bucket.length; i++) {
        if (String(bucket[i].id) === String(targetId)) { toIdx = i; break; }
      }
      if (toIdx < 0) { bucket.push(item); return true; }
      var insertAt = placeAfter ? toIdx + 1 : toIdx;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > bucket.length) insertAt = bucket.length;
      bucket.splice(insertAt, 0, item);
      return true;
    }

    /** Snapshot sibling slots at drag start (stable mids while row translates). */
    function snapshotSlots(row) {
      var kind = row.getAttribute('data-kind');
      var root = row.closest('.list-col-body') || row.closest('#mls-body') || row.parentElement;
      if (!root) return [];
      var nodes = Array.prototype.slice.call(root.querySelectorAll('.list-item')).filter(function (el) {
        return el.getAttribute('data-kind') === kind;
      });
      return nodes.map(function (el, index) {
        var r = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-item-id'),
          el: el,
          index: index,
          top: r.top,
          bottom: r.bottom,
          mid: r.top + r.height / 2,
          height: r.height
        };
      });
    }

    function pickSlotByY(slots, y, dragId) {
      if (!slots || !slots.length) return null;
      var best = null;
      var bestDist = Infinity;
      var i;
      for (i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (String(s.id) === String(dragId)) continue;
        var d = Math.abs(y - s.mid);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      if (!best) return null;
      return {
        id: best.id,
        placeAfter: y > best.mid,
        el: best.el
      };
    }

    function clientXY(e) {
      if (!e) return { x: 0, y: 0 };
      if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if (e.changedTouches && e.changedTouches.length) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function clearDragVisuals(st) {
      document.querySelectorAll('.list-item.is-dragging, .list-item.drag-over, .list-item.drag-over-after').forEach(function (n) {
        n.classList.remove('is-dragging', 'drag-over', 'drag-over-after');
        n.style.transform = '';
        n.style.zIndex = '';
        n.style.transition = '';
        n.style.boxShadow = '';
      });
      try { document.body.classList.remove('ps-list-dragging'); } catch (eB) {}
      if (st && st.placeholder && st.placeholder.parentNode) {
        try { st.placeholder.parentNode.removeChild(st.placeholder); } catch (eP) {}
      }
    }

    function updateDropVisual(st, y) {
      document.querySelectorAll('.list-item.drag-over, .list-item.drag-over-after').forEach(function (n) {
        n.classList.remove('drag-over', 'drag-over-after');
      });
      var hit = pickSlotByY(st.slots, y, st.id);
      if (!hit) {
        st.overId = null;
        return;
      }
      st.overId = hit.id;
      st.placeAfter = hit.placeAfter;
      if (hit.el) {
        hit.el.classList.add(hit.placeAfter ? 'drag-over-after' : 'drag-over');
      }
    }

    function autoScroll(st, y) {
      var scroller = st.row.closest('#mls-body') || st.row.closest('.list-col-body') || st.row.closest('.mls-body');
      if (!scroller) return;
      var sRect = scroller.getBoundingClientRect();
      var edge = 56;
      var step = 18;
      if (y < sRect.top + edge) scroller.scrollTop -= step;
      else if (y > sRect.bottom - edge) scroller.scrollTop += step;
    }

    function beginDrag(handle, row, xy, pointerId) {
      if (_dragState) endDrag(null, true);
      var id = row.getAttribute('data-item-id');
      var slots = snapshotSlots(row);
      _dragState = {
        id: id,
        row: row,
        handle: handle,
        startY: xy.y || 0,
        startX: xy.x || 0,
        lastY: xy.y || 0,
        pointerId: pointerId,
        moved: false,
        overId: null,
        placeAfter: false,
        slots: slots
      };
      row.classList.add('is-dragging');
      row.style.zIndex = '40';
      row.style.transition = 'none';
      row.style.boxShadow = '0 8px 24px rgba(0,0,0,0.45)';
      try { document.body.classList.add('ps-list-dragging'); } catch (eB2) {}
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (eV) {}
    }

    function moveDrag(xy, e) {
      if (!_dragState || xy.y == null) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      var dy = xy.y - _dragState.startY;
      var dx = (xy.x || 0) - _dragState.startX;
      if (Math.abs(dy) > 4 || Math.abs(dx) > 4) _dragState.moved = true;
      _dragState.lastY = xy.y;
      // Visually follow the finger
      _dragState.row.style.transform = 'translateY(' + dy + 'px)';
      updateDropVisual(_dragState, xy.y);
      autoScroll(_dragState, xy.y);
    }

    function endDrag(xy, cancelled) {
      if (!_dragState) return;
      var st = _dragState;
      _dragState = null;
      if (!cancelled && xy && xy.y != null) {
        updateDropVisual(st, xy.y);
      } else if (!cancelled && st.lastY != null) {
        updateDropVisual(st, st.lastY);
      }
      var moved = st.moved;
      var overId = st.overId;
      var placeAfter = st.placeAfter;
      var id = st.id;
      var row = st.row;
      // reset visual before re-render
      try {
        row.style.transform = '';
        row.style.zIndex = '';
        row.style.transition = '';
        row.style.boxShadow = '';
      } catch (eR) {}
      clearDragVisuals(st);
      if (cancelled || !moved || !overId) return;
      state._suppressItemClick = true;
      setTimeout(function () { state._suppressItemClick = false; }, 150);
      var meta = bucketForRow(row);
      if (!meta) return;
      if (reorderRelative(meta.bucket, id, overId, placeAfter)) {
        meta.save();
        render();
      }
    }

    var _pressTimer = null;
    var _pressCandidate = null;
    var ROW_HOLD_MS = 300;
    var ROW_HOLD_SLOP = 12;

    function clearPressCandidate() {
      if (_pressTimer) {
        try { clearTimeout(_pressTimer); } catch (eT) {}
        _pressTimer = null;
      }
      _pressCandidate = null;
    }

    function isListRowHost(el) {
      return !!(el && el.closest &&
        el.closest('#ev-list, #lists-active, #mobile-list-sheet, .list-col-body, .list-triad, #mls-body'));
    }

    /** Hold-and-drag: press anywhere on the row (not buttons/inputs/detail). */
    function isRowHoldTarget(e) {
      var t = e.target;
      if (!t || !t.closest) return null;
      if (t.closest('button, input, select, textarea, a, label, .li-detail, .li-actions')) return null;
      var row = t.closest('.list-item');
      if (!row) return null;
      if (!isListRowHost(row)) return null;
      // Expanded detail edits should not start a drag
      if (row.classList.contains('is-expanded') && t.closest('.li-detail')) return null;
      return { handle: row, row: row };
    }

    function startHoldThenDrag(hit, xy, pointerId, e) {
      clearPressCandidate();
      _pressCandidate = {
        handle: hit.handle,
        row: hit.row,
        startX: xy.x || 0,
        startY: xy.y || 0,
        pointerId: pointerId
      };
      _pressTimer = setTimeout(function () {
        var cand = _pressCandidate;
        _pressTimer = null;
        _pressCandidate = null;
        if (!cand || !cand.row || !cand.row.isConnected) return;
        beginDrag(cand.handle, cand.row, { x: cand.startX, y: cand.startY }, cand.pointerId);
        try {
          if (cand.handle.setPointerCapture && cand.pointerId != null && cand.pointerId !== 'touch') {
            cand.handle.setPointerCapture(cand.pointerId);
          }
        } catch (err) {}
        // prevent the synthetic click that follows a long-press
        state._suppressItemClick = true;
        setTimeout(function () { state._suppressItemClick = false; }, 200);
      }, ROW_HOLD_MS);
    }

    // --- Pointer events (desktop + modern mobile): hold row → drag ---
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var hit = isRowHoldTarget(e);
      if (!hit) return;
      startHoldThenDrag(hit, clientXY(e), e.pointerId, e);
    }, { capture: true, passive: true });

    document.addEventListener('pointermove', function (e) {
      if (_pressCandidate) {
        if (_pressCandidate.pointerId != null && e.pointerId != null && e.pointerId !== _pressCandidate.pointerId) return;
        var xy0 = clientXY(e);
        var dx0 = (xy0.x || 0) - _pressCandidate.startX;
        var dy0 = (xy0.y || 0) - _pressCandidate.startY;
        // Finger moved before hold completed → user is scrolling; cancel drag arm
        if (Math.abs(dx0) > ROW_HOLD_SLOP || Math.abs(dy0) > ROW_HOLD_SLOP) {
          clearPressCandidate();
        }
        return;
      }
      if (!_dragState) return;
      if (_dragState.pointerId != null && e.pointerId != null && e.pointerId !== _dragState.pointerId) return;
      moveDrag(clientXY(e), e);
    }, { capture: true, passive: false });

    function onPointerEnd(e) {
      if (_pressCandidate) {
        if (_pressCandidate.pointerId != null && e.pointerId != null && e.pointerId !== _pressCandidate.pointerId) return;
        clearPressCandidate();
        return;
      }
      if (!_dragState) return;
      if (_dragState.pointerId != null && e.pointerId != null && e.pointerId !== _dragState.pointerId) return;
      try {
        if (_dragState.handle && _dragState.handle.releasePointerCapture) {
          _dragState.handle.releasePointerCapture(e.pointerId);
        }
      } catch (errR) {}
      endDrag(clientXY(e), false);
    }
    document.addEventListener('pointerup', onPointerEnd, { capture: true, passive: false });
    document.addEventListener('pointercancel', function (e) {
      clearPressCandidate();
      if (!_dragState) return;
      endDrag(null, true);
    }, { capture: true, passive: false });

    // --- Touch fallback (older iOS / when pointer events flake) ---
    document.addEventListener('touchstart', function (e) {
      if (_dragState || _pressCandidate) return;
      var hit = isRowHoldTarget(e);
      if (!hit) return;
      startHoldThenDrag(hit, clientXY(e), 'touch', e);
    }, { capture: true, passive: true });

    document.addEventListener('touchmove', function (e) {
      if (_pressCandidate) {
        var xy1 = clientXY(e);
        var dx1 = (xy1.x || 0) - _pressCandidate.startX;
        var dy1 = (xy1.y || 0) - _pressCandidate.startY;
        if (Math.abs(dx1) > ROW_HOLD_SLOP || Math.abs(dy1) > ROW_HOLD_SLOP) {
          clearPressCandidate();
        }
        return;
      }
      if (!_dragState) return;
      moveDrag(clientXY(e), e);
    }, { capture: true, passive: false });

    document.addEventListener('touchend', function (e) {
      if (_pressCandidate) { clearPressCandidate(); return; }
      if (!_dragState) return;
      endDrag(clientXY(e), false);
    }, { capture: true, passive: false });

    document.addEventListener('touchcancel', function () {
      clearPressCandidate();
      if (!_dragState) return;
      endDrag(null, true);
    }, { capture: true, passive: false });
  }

  /** Move item one slot up/down in its bucket (legacy helper). */
  function moveItemBy(kind, scope, id, dir) {
    var bucket;
    var isPersonal = scope === 'personal-board';
    var isFree = scope === 'free-list';
    var board = null;
    var free = null;
    var freeHit = null;
    if (isPersonal) {
      board = loadPersonalBoard();
      bucket = board[kind] || [];
    } else if (isFree) {
      var nlist = resolveOpenNamedList(null);
      freeHit = nlist ? resolveNamedListItemHit(nlist, kind, id) : null;
      if (freeHit) {
        bucket = freeHit.bucket;
      } else {
        free = getActiveFreeBucket(kind);
        bucket = free.bucket || [];
      }
    } else {
      var ev = activeEvent();
      if (!ev) return;
      bucket = getListBucket(ev, kind, scope);
    }
    var idx = bucket.findIndex(function (x) { return String(x.id) === String(id); });
    if (idx < 0) return;
    var to = idx + (dir < 0 ? -1 : 1);
    if (to < 0 || to >= bucket.length) return;
    var tmp = bucket[idx];
    bucket[idx] = bucket[to];
    bucket[to] = tmp;
    if (isPersonal) {
      board[kind] = bucket;
      savePersonalBoard(board);
    } else if (isFree) {
      if (freeHit) saveNamedListItemHit(freeHit);
      else if (free && free.named) saveNamedList(free.named);
      else if (free) saveFreeListsStore(free.store);
    } else {
      saveActiveEvent();
    }
    render();
  }

  function findItemAny(kind, scope, id) {
    if (scope === 'personal-board') {
      var board = loadPersonalBoard();
      var arr = board[kind] || [];
      var index = arr.findIndex(function (x) { return x.id === id; });
      return { board: board, bucket: arr, item: index >= 0 ? arr[index] : null, index: index, scope: scope };
    }
    if (scope === 'free-list' || !scope) {
      var named = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
      if (named) {
        var hit = resolveNamedListItemHit(named, kind, id);
        if (hit) {
          return {
            list: hit.list,
            bucket: hit.bucket,
            item: hit.item,
            index: hit.index,
            scope: 'free-list',
            colId: hit.colId,
            isChecklist: !!hit.isChecklist || !!hit.isPrivateOnly
          };
        }
      }
      // Scan every named list so chore / detail saves still work if active list id is stale
      var across = findItemAcrossNamedLists(id);
      if (across && across.item) return across;
      return { item: null, scope: scope || 'free-list' };
    }
    var event = activeEvent();
    if (!event) {
      // Maybe the row said group but item lives on a named packing list
      var across2 = findItemAcrossNamedLists(id);
      if (across2 && across2.item) return across2;
      return { item: null };
    }
    var found = findItem(event, kind, scope, id);
    if (found && found.item) {
      return { event: event, bucket: found.bucket, item: found.item, index: found.index, scope: scope };
    }
    var across3 = findItemAcrossNamedLists(id);
    if (across3 && across3.item) return across3;
    return { event: event, bucket: found.bucket, item: null, index: found.index, scope: scope };
  }

  function membersForSplitPick() {
    var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
    var mems = [];
    if (list && Array.isArray(list.members) && list.members.length) {
      mems = list.members.filter(Boolean);
    } else if (state.members && state.members.length) {
      mems = state.members.slice();
    }
    if (!mems.length) {
      mems = [{ user_id: myId() || 'local', display_name: myName() || 'You' }];
    }
    return mems;
  }

  function canManageList(list) {
    if (!list) {
      var ev = activeEvent();
      return !!(ev && isEventCreator(ev));
    }
    return isNamedListOwner(list) || isListCreator(list);
  }

  function openDelegateModal(item, kind, scope) {
    if (!item) return;
    state.delegateCtx = { itemId: item.id, kind: kind, scope: scope, listId: state.activeNamedListId };
    var box = $('delegate-member-list');
    if (box) {
      var mems = membersForSplitPick();
      box.innerHTML = mems.map(function (m) {
        var id = m.user_id || m.id || '';
        var label = m.display_name || m.username || 'Member';
        var on = item.delegated_to && String(item.delegated_to.user_id) === String(id);
        return '<button type="button" class="btn delegate-pick' + (on ? ' is-on' : '') +
          '" data-delegate-to="' + esc(id) + '" data-delegate-name="' + esc(label) + '">' +
          esc(label) + '</button>';
      }).join('') || '<p class="muted">No members to delegate to.</p>';
    }
    if ($('delegate-title')) {
      $('delegate-title').textContent = 'Delegate · ' + (item.title || 'item');
    }
    if ($('delegate-modal')) {
      $('delegate-modal').classList.add('is-open');
      $('delegate-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function closeDelegateModal() {
    state.delegateCtx = null;
    if ($('delegate-modal')) {
      $('delegate-modal').classList.remove('is-open');
      $('delegate-modal').setAttribute('aria-hidden', 'true');
    }
  }

  function applyDelegateToMember(memberId, memberName) {
    var ctx = state.delegateCtx || {};
    var found = findItemAny(ctx.kind, ctx.scope, ctx.itemId);
    if (!found.item) { closeDelegateModal(); return; }
    var item = found.item;
    item.delegated_to = {
      user_id: memberId,
      display_name: memberName || 'Member',
      at: new Date().toISOString(),
      by: myId() || 'local'
    };
    // Put a copy on their personal To bring (inbox → merges for them)
    try {
      var pack = {
        fromId: myId(),
        fromName: myName(),
        kind: 'bring',
        at: new Date().toISOString(),
        items: [{
          title: item.title,
          qty: item.qty || 1,
          notes: item.notes || '',
          notesList: item.notesList || [],
          qualifier: item.qualifier || 'other',
          priority: item.priority || 0,
          shared_from: myName() + ' · delegated',
          delegated_from_item: item.id
        }]
      };
      var inbox = loadInboxFor(memberId);
      inbox.push(pack);
      saveInboxFor(memberId, inbox);
      if (String(memberId) === String(myId())) mergeInboxIntoPersonal();
    } catch (eD) { console.warn(eD); }
    if (found.scope === 'free-list' && found.list) saveNamedList(found.list);
    else if (found.scope === 'personal-board' && found.board) {
      found.board[ctx.kind] = found.bucket;
      savePersonalBoard(found.board);
    } else saveActiveEvent();
    closeDelegateModal();
    appToast('Delegated to ' + (memberName || 'member') + ' · To bring');
    render();
  }

  function openUserSettingsModal() {
    _userSettingsPendingColor = null;
    _userSettingsDirty = false;
    if ($('user-settings-nick')) {
      $('user-settings-nick').value = myName() || '';
    }
    if ($('user-settings-username')) {
      var p = state.profile || (window.PlanSlayerAuth && window.PlanSlayerAuth.getProfile && window.PlanSlayerAuth.getProfile());
      $('user-settings-username').textContent = (p && p.username) ? ('@' + p.username) : 'Signed in';
    }
    renderMyColorPicker(myColor());
    if ($('user-color-panel')) $('user-color-panel').style.display = 'none';
    syncUserSettingsCloseSaveBtn();
    if ($('user-settings-modal')) {
      $('user-settings-modal').classList.add('is-open');
      $('user-settings-modal').setAttribute('aria-hidden', 'false');
    }
  }
  function closeUserSettingsModal() {
    _userSettingsPendingColor = null;
    _userSettingsDirty = false;
    if ($('user-settings-modal')) {
      $('user-settings-modal').classList.remove('is-open');
      $('user-settings-modal').setAttribute('aria-hidden', 'true');
    }
  }
  function applyNicknameEverywhere(nick) {
    nick = autoCap(String(nick || '').trim());
    if (!nick) return false;
    // Local profile override (what others see in this app)
    if (!state.profile) state.profile = {};
    state.profile.display_name = nick;
    try {
      localStorage.setItem('plan_slayer_nickname_v1', nick);
    } catch (e) {}
    var me = myId() || 'local';
    // Update me on every named list membership
    try {
      var store = loadFreeListsStore();
      (store.named || []).forEach(function (n) {
        (n.members || []).forEach(function (m) {
          if (m && String(m.user_id) === String(me)) m.display_name = nick;
        });
      });
      saveFreeListsStore(store);
    } catch (eL) {}
    // Active event members
    (state.members || []).forEach(function (m) {
      if (m && String(m.user_id) === String(me)) m.display_name = nick;
    });
    // Friends entry for self
    rememberFriend({ user_id: me, display_name: nick, username: (state.profile && state.profile.username) || '' });
    // Best-effort profile upsert if Supabase available
    try {
      var client = sb();
      if (client && me && me !== 'local') {
        client.from('profiles').upsert({
          id: me,
          display_name: nick,
          username: (state.profile && state.profile.username) || undefined
        }).then(function () {}).catch(function () {});
      }
    } catch (eP) {}
    return true;
  }

  function renderExpenses(ev) {
    var box = $('ev-settle');
    if (!box) return;
    var members = (state.members || []).filter(Boolean).map(function (m) {
      return { id: m.user_id, name: m.display_name || m.username };
    });
    var expenses = [];
    try {
      ['todo', 'buy', 'bring'].forEach(function (kind) {
        var group = (ev && ev.state && ev.state.lists && ev.state.lists[kind] && ev.state.lists[kind].group) || [];
        group.forEach(function (it) {
          if (it.shared_expense && Number(it.expense_amount) > 0) {
            expenses.push({
              payerId: it.created_by || myId(),
              amount: Number(it.expense_amount),
              shareWith: (it.expense_share_with && it.expense_share_with.length) ? it.expense_share_with : null
            });
          }
        });
      });
    } catch (eEx) {}
    if (!expenses.length) {
      box.innerHTML = '';
      return;
    }
    var transfers = settleBalances(members, expenses);
    var meId = myId();
    var lines = transfers.map(function (t) {
      var text = esc(memberLabel(t.from)) + ' → ' + esc(memberLabel(t.to)) + ': <strong>$' + t.amount.toFixed(2) + '</strong>';
      if (String(t.from) === String(meId)) text = 'You pay ' + esc(memberLabel(t.to)) + ' <strong>$' + t.amount.toFixed(2) + '</strong>';
      if (String(t.to) === String(meId)) text = esc(memberLabel(t.from)) + ' pays you <strong>$' + t.amount.toFixed(2) + '</strong>';
      return '<div class="settle-line' + ((String(t.from) === String(meId) || String(t.to) === String(meId)) ? ' is-mine' : '') + '">' + text + '</div>';
    }).join('');
    box.innerHTML = '<h4 style="margin:0 0 6px;font-size:13px;color:#fff">Settle up</h4>' + (lines || '<p class="muted">Already even.</p>');
  }

  /* ---------- create calendar ---------- */
  function openCreateModal() {
    state.leftTab = 'lists';
    var now = new Date();
    // Default start = side calendar selected day (else today) (#37)
    var seed = state.sideCal && state.sideCal.selectedDay
      ? String(state.sideCal.selectedDay)
      : (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0'));
    var parts = seed.split('-').map(Number);
    if (parts.length === 3 && parts[0] && parts[1]) {
      state.createCal.y = parts[0];
      state.createCal.m = parts[1] - 1;
      state.createCal.selected = seed;
    } else {
      state.createCal.y = now.getFullYear();
      state.createCal.m = now.getMonth();
      state.createCal.selected = null;
    }
    state.createCal.endSelected = null;
    if ($('create-name')) $('create-name').value = '';
    if ($('create-type')) $('create-type').value = 'camping';
    if ($('create-template')) $('create-template').checked = true;
    if ($('create-time')) $('create-time').value = '09:00';
    if ($('create-end-time')) $('create-end-time').value = '17:00';
    if ($('create-end-next-day')) $('create-end-next-day').checked = false;
    if ($('create-personal-only')) $('create-personal-only').checked = state.mode === 'personal';
    updateCreateCalSelectedLabel();
    renderCalGrid();
    try { populateCreateMapSelect('personal'); } catch (eMap) {}
    if ($('create-modal')) {
      $('create-modal').classList.add('is-open');
      $('create-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function updateCreateCalSelectedLabel() {
    var start = state.createCal.selected;
    var end = state.createCal.endSelected;
    var el = $('cal-selected');
    if (!el) return;
    if (!start) {
      el.textContent = 'None (optional) · TBD if unset · tap a day for start, another for end';
      return;
    }
    if (end && end !== start) {
      el.textContent = start + ' → ' + end;
    } else {
      el.textContent = start + ' (tap another day for end date)';
    }
  }
  function closeCreateModal() {
    if ($('create-modal')) {
      $('create-modal').classList.remove('is-open');
      $('create-modal').setAttribute('aria-hidden', 'true');
    }
  }

  function renderNamedListTabs() { /* legacy no-op — home list is on the left under My lists tab */ }
  function renderMyListsHome() {
    var home = $('my-lists-home');
    if (home) { home.style.display = 'none'; home.innerHTML = ''; }
  }

  function buildEventLinkOptionsHtml(selectedId) {
    var opts = '<option value="">None — personal list only</option>';
    (state.events || []).forEach(function (e) {
      if (!e || e._personalOnly) return;
      var sel = selectedId && String(selectedId) === String(e.id) ? ' selected' : '';
      opts += '<option value="' + esc(e.id) + '"' + sel + '>' + esc(e.name || 'Event') + '</option>';
    });
    return opts;
  }

  function openListModal() {
    if ($('list-name')) $('list-name').value = '';
    if ($('list-kind')) $('list-kind').value = 'todo';
    if ($('list-link-event')) {
      $('list-link-event').innerHTML = buildEventLinkOptionsHtml(
        state.leftTab === 'events' && state.activeEventId ? state.activeEventId : null
      );
    }
    if ($('list-modal')) {
      $('list-modal').classList.add('is-open');
      $('list-modal').setAttribute('aria-hidden', 'false');
    }
  }
  function closeListModal() {
    if ($('list-modal')) {
      $('list-modal').classList.remove('is-open');
      $('list-modal').setAttribute('aria-hidden', 'true');
    }
  }
  function openListInviteModal(list, col) {
    if (!list) return;
    var code = null;
    var label = list.name || 'list';
    if (col) {
      normalizeNamedList(list);
      var c = getListColumn(list, col.id || col);
      if (!c) return;
      if (!c.invite_code) {
        c.invite_code = makeListInviteCode();
        saveNamedList(list);
      }
      code = c.invite_code;
      label = (list.name || 'list') + ' · ' + (c.name || 'section');
    } else {
      if (!list.invite_code) {
        list.invite_code = makeListInviteCode();
        list.updated_at = new Date().toISOString();
        saveNamedList(list);
      }
      code = list.invite_code;
    }
    if ($('list-invite-code-input')) $('list-invite-code-input').value = code;
    if ($('list-invite-blurb')) {
      $('list-invite-blurb').textContent =
        'Share this code so others can join “' + label + '”. Leave it private if you only want it for yourself.';
    }
    if ($('list-invite-modal')) {
      $('list-invite-modal').classList.add('is-open');
      $('list-invite-modal').setAttribute('aria-hidden', 'false');
    }
  }

  var _shareCtx = { listId: null, colId: null, itemId: null, kind: null, mode: 'section' };
  var _catItemCtx = { itemId: null, kind: null, scope: null, listId: null };

  function openSectionShareModal(list, col) {
    if (!list || !col) return;
    _shareCtx = { listId: list.id, colId: col.id, itemId: null, kind: col.id, mode: 'section' };
    if ($('sec-share-title')) $('sec-share-title').textContent = 'Share · ' + (col.name || 'Section');
    if ($('sec-share-blurb')) {
      $('sec-share-blurb').textContent = 'Copy “' + (col.name || 'section') + '” as text, or send its items to a member’s list.';
    }
    fillMemberSharePick($('sec-share-member-pick'), '');
    if ($('sec-share-modal')) {
      $('sec-share-modal').classList.add('is-open');
      $('sec-share-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function openItemShareToMemberModal(item, kind) {
    if (!item) return;
    var list = resolveOpenNamedList(null);
    _shareCtx = {
      listId: list && list.id,
      colId: kind,
      itemId: item.id,
      kind: kind,
      mode: 'item',
      item: item
    };
    if ($('sec-share-title')) $('sec-share-title').textContent = 'Share item';
    if ($('sec-share-blurb')) {
      $('sec-share-blurb').textContent = 'Copy “' + (item.title || 'item') + '” or send it to a member’s list.';
    }
    fillMemberSharePick($('sec-share-member-pick'), '');
    if ($('sec-share-modal')) {
      $('sec-share-modal').classList.add('is-open');
      $('sec-share-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function closeSecShareModal() {
    if ($('sec-share-modal')) {
      $('sec-share-modal').classList.remove('is-open');
      $('sec-share-modal').setAttribute('aria-hidden', 'true');
    }
  }

  /** Clipboard payload so paste into another list keeps item settings */
  function itemToClipboardPayload(item) {
    if (!item) return null;
    return {
      v: 1,
      type: 'plan_slayer_item',
      item: {
        title: item.title || 'Item',
        qty: Math.max(1, Number(item.qty) || 1),
        qualifier: item.qualifier || 'other',
        priority: item.priority || 0,
        due_mode: item.due_mode || 'anytime_before',
        due_days: item.due_days || 0,
        highlight: !!item.highlight,
        highlight_color: item.highlight_color || 'red',
        creator_only_edit: !!item.creator_only_edit,
        require_all: !!item.require_all,
        notes: item.notes || '',
        notesList: Array.isArray(item.notesList) ? item.notesList.map(function (n) {
          return { text: n.text, byName: n.byName, at: n.at };
        }) : [],
        shared_expense: !!item.shared_expense,
        expense_amount: Number(item.expense_amount) || 0
      }
    };
  }
  function copyItemPayloadToClipboard(item) {
    var payload = itemToClipboardPayload(item);
    if (!payload) return Promise.resolve(false);
    var text = '[[PSITEM]]' + JSON.stringify(payload);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () {
        return fallbackCopyText(text);
      });
    }
    return Promise.resolve(fallbackCopyText(text));
  }
  function fallbackCopyText(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }
  function parseClipboardItem(text) {
    text = String(text || '').trim();
    if (text.indexOf('[[PSITEM]]') !== 0) return null;
    try {
      var raw = JSON.parse(text.slice('[[PSITEM]]'.length));
      if (!raw || raw.type !== 'plan_slayer_item' || !raw.item) return null;
      return raw.item;
    } catch (e) { return null; }
  }
  function itemFromClipboardPayload(payload) {
    if (!payload) return null;
    return newItem(payload.title || 'Item', {
      qty: payload.qty,
      qualifier: payload.qualifier,
      priority: payload.priority,
      due_mode: payload.due_mode,
      due_days: payload.due_days,
      highlight: payload.highlight,
      highlight_color: payload.highlight_color,
      creator_only_edit: payload.creator_only_edit,
      require_all: payload.require_all,
      notes: payload.notes,
      notesList: payload.notesList,
      shared_expense: payload.shared_expense,
      expense_amount: payload.expense_amount,
      claims: {}
    });
  }

  function fillMemberSharePick(box, q) {
    if (!box) return;
    q = String(q || '').trim();
    // Combine friends + map partners for typeahead
    var hits = searchFriends(q, 20);
    var byKey = {};
    hits.forEach(function (f) {
      var k = String(f.user_id || f.username || f.display_name || '');
      if (k) byKey[k.toLowerCase()] = f;
    });
    try {
      allPeopleForAddMembers(q, 30).forEach(function (p) {
        var k = String(p.user_id || p.username || p.display_name || '');
        if (!k || byKey[k.toLowerCase()]) return;
        byKey[k.toLowerCase()] = {
          user_id: p.user_id,
          display_name: p.display_name,
          username: p.username,
          arrow_color: p.arrow_color
        };
      });
    } catch (eP) {}
    hits = Object.keys(byKey).map(function (k) { return byKey[k]; });
    // Exclude people already on the active event/list
    var already = {};
    try {
      (state.members || []).forEach(function (m) {
        if (m && m.user_id) already[String(m.user_id).toLowerCase()] = true;
        if (m && m.display_name) already[String(m.display_name).toLowerCase()] = true;
      });
      var openL = findNamedListById(state.activeNamedListId);
      if (openL && openL.members) {
        openL.members.forEach(function (m) {
          if (m && m.user_id) already[String(m.user_id).toLowerCase()] = true;
          if (m && m.display_name) already[String(m.display_name).toLowerCase()] = true;
        });
      }
    } catch (eA) {}
    hits = hits.filter(function (f) {
      var id = String(f.user_id || '').toLowerCase();
      var dn = String(f.display_name || '').toLowerCase();
      var un = String(f.username || '').toLowerCase();
      return !already[id] && !already[dn] && !already[un];
    }).slice(0, 12);
    var html = '';
    if (hits.length) {
      html = hits.map(function (f) {
        var key = f.user_id || f.username || f.display_name;
        return '<button type="button" class="btn" data-share-to-member="' + esc(key) + '">' +
          esc(friendLabel(f) || f.display_name || f.username || 'Member') +
          (f.username ? (' <span class="muted">@' + esc(f.username) + '</span>') : '') +
          '</button>';
      }).join('');
    }
    if (q.length >= 1 && !hits.some(function (f) {
      return String(f.display_name || '').toLowerCase() === q.toLowerCase() ||
        String(f.username || '').toLowerCase() === q.toLowerCase();
    })) {
      if (q.length >= 2 && !already[q.toLowerCase()]) {
        html += '<button type="button" class="btn btn-accent" data-share-to-new="' + esc(q) +
          '">Add “' + esc(autoCap(q)) + '” as new name</button>';
      }
    }
    if (!html) {
      html = q.length
        ? '<p class="muted" style="font-size:12px;margin:0">No matches — type a full name to add someone new.</p>'
        : '<p class="muted" style="font-size:12px;margin:0">Type a name, nickname, or username…</p>';
    }
    box.innerHTML = html;
  }

  function copySharePayload() {
    var list = findNamedListById(_shareCtx.listId);
    if (_shareCtx.mode === 'item' && _shareCtx.item) {
      var it = _shareCtx.item;
      return (it.title || '') + ((it.qty || 1) > 1 ? ' ×' + it.qty : '');
    }
    if (!list) return '';
    normalizeNamedList(list);
    var col = getListColumn(list, _shareCtx.colId);
    if (!col) return '';
    return listAsText(col.items || [], col.id || 'todo');
  }

  function pushItemsToMemberList(friendKey, items, label) {
    items = (items || []).map(function (it) {
      return Object.assign({}, it, {
        id: uid(),
        claims: {},
        shared_from: myName() || 'Shared'
      });
    });
    if (!items.length) { appToast('Nothing to share'); return false; }
    // Destination: personal named list for this member under a shared pack name, or inbox
    var destName = (label || 'Shared') + ' · from ' + (myName() || 'friend');
    // Store in their inbox for this device if we know user_id; else create provisional friend pack
    var f = searchFriends('', 50).find(function (x) {
      return String(x.user_id || '') === String(friendKey) ||
        String(x.username || '').toLowerCase() === String(friendKey).toLowerCase() ||
        String(x.display_name || '').toLowerCase() === String(friendKey).toLowerCase();
    });
    if (f && f.user_id && String(f.user_id) !== String(myId())) {
      var inbox = loadInboxFor(f.user_id) || [];
      inbox.push({
        id: uid(),
        fromName: myName() || 'Someone',
        kind: _shareCtx.kind || 'todo',
        items: items,
        at: new Date().toISOString()
      });
      saveInboxFor(f.user_id, inbox);
      rememberFriend(f);
      appToast('Shared to ' + friendLabel(f) + '’s inbox');
      return true;
    }
    // Local / provisional: add to a named list "Shared with <name>"
    var store = loadFreeListsStore();
    var name = 'For ' + autoCap(String((f && f.display_name) || friendKey));
    var existing = (store.named || []).find(function (n) {
      return String(n.name || '').toLowerCase() === name.toLowerCase() && !n.eventId;
    });
    if (!existing) {
      existing = normalizeNamedList({
        id: uid(),
        name: name,
        kind: 'todo',
        items: [],
        buckets: { todo: [], buy: [], bring: [] },
        columnOrder: ['todo', 'buy', 'bring'],
        owner_id: myId() || 'local',
        members: [{ user_id: myId() || 'local', display_name: myName(), role: 'owner' }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      store.named = store.named || [];
      store.named.push(existing);
      saveFreeListsStore(store);
    }
    var live = findNamedListById(existing.id);
    var colId = _shareCtx.kind || 'todo';
    var col = getListColumn(live, colId) || getListColumn(live, 'todo');
    if (col) {
      items.forEach(function (it) { col.items.push(it); });
      saveNamedList(live);
    }
    if (!f) {
      rememberFriend({
        user_id: null,
        display_name: autoCap(String(friendKey)),
        provisional: true,
        nicknames: []
      });
    }
    appToast('Added to list “' + name + '”');
    return true;
  }

  function openItemCategoryModal(item, kind, scope) {
    if (!item) return;
    var list = resolveOpenNamedList(null);
    _catItemCtx = {
      itemId: item.id,
      kind: kind,
      scope: scope,
      listId: list && list.id,
      item: item
    };
    var qs = freeListQualifiers();
    var box = $('item-cat-list');
    if (box) {
      box.innerHTML = qs.map(function (q) {
        var on = String(item.qualifier || 'other') === String(q.id);
        return '<button type="button" class="btn' + (on ? ' btn-primary' : '') +
          '" data-pick-cat="' + esc(q.id) + '" style="width:100%;margin:0 0 6px;text-align:left;border-color:' +
          esc(q.color) + '"><span style="color:' + esc(q.color) + '">●</span> ' + esc(q.name) + '</button>';
      }).join('');
    }
    if ($('item-cat-modal')) {
      $('item-cat-modal').classList.add('is-open');
      $('item-cat-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function closeItemCatModal() {
    if ($('item-cat-modal')) {
      $('item-cat-modal').classList.remove('is-open');
      $('item-cat-modal').setAttribute('aria-hidden', 'true');
    }
  }

  function applyItemCategory(catId) {
    catId = catId || 'other';
    var list = findNamedListById(_catItemCtx.listId);
    var item = null;
    var hit = null;
    if (list) {
      hit = resolveNamedListItemHit(list, _catItemCtx.kind, _catItemCtx.itemId);
      if (hit) item = hit.item;
    }
    if (!item && _catItemCtx.item) item = _catItemCtx.item;
    if (!item) return;
    item.qualifier = catId;
    if (list && hit) saveNamedListItemHit(hit);
    else if (list) saveNamedList(list);
    else if (_catItemCtx.scope === 'group') saveActiveEvent();
    closeItemCatModal();
    render();
  }

  /** Creator: add name-only or friend members to a named list */
  function openListMembersModal(list) {
    if (!list) return;
    normalizeNamedList(list);
    _shareCtx.listId = list.id;
    renderListMembersModal(list);
    if ($('list-members-modal')) {
      $('list-members-modal').classList.add('is-open');
      $('list-members-modal').setAttribute('aria-hidden', 'false');
    }
  }

  function renderListMembersModal(list) {
    normalizeNamedList(list);
    var box = $('list-members-list');
    if (box) {
      box.innerHTML = (list.members || []).map(function (m) {
        var label = m.display_name || m.username || 'Member';
        var tag = m.provisional ? ' · name only' : (m.role === 'owner' ? ' · owner' : '');
        var claim = m.claimed_by ? ' · claimed' : '';
        return '<div class="friend-row" style="margin:0 0 6px">' +
          '<span class="friend-swatch" style="background:' + esc(m.arrow_color || COLORS[0]) + '"></span>' +
          '<div style="flex:1"><strong>' + esc(label) + '</strong>' +
          '<div class="muted" style="font-size:11px">' + esc((m.username || '') + tag + claim) + '</div></div></div>';
      }).join('') || '<p class="muted">Only you so far.</p>';
    }
    fillMemberSharePick($('list-member-add-pick'), ($('list-member-search') && $('list-member-search').value) || '');
  }

  function addListMemberFromPick(list, friendKey, isNewName) {
    if (!list) return;
    normalizeNamedList(list);
    if (!Array.isArray(list.members)) list.members = [];
    var typed = ($('list-member-search') && $('list-member-search').value) ||
      ($('sec-share-member-search') && $('sec-share-member-search').value) || '';
    typed = autoCap(String(typed).trim());
    var f = searchFriends('', 80).find(function (x) {
      return String(x.user_id || '') === String(friendKey) ||
        String(x.username || '').toLowerCase() === String(friendKey).toLowerCase() ||
        String(x.display_name || '').toLowerCase() === String(friendKey).toLowerCase();
    });
    var name = isNewName ? autoCap(String(friendKey)) : (f ? (f.display_name || f.username) : autoCap(String(friendKey)));
    var uidM = (f && f.user_id) ? f.user_id : ('name_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    if (list.members.some(function (m) {
      return String(m.user_id) === String(uidM) ||
        String(m.display_name || '').toLowerCase() === name.toLowerCase();
    })) {
      appToast('Already a member');
      return;
    }
    list.members.push({
      user_id: uidM,
      display_name: name,
      username: (f && f.username) || '',
      role: 'member',
      provisional: !(f && f.user_id),
      claimed_by: null,
      arrow_color: (f && f.arrow_color) || COLORS[list.members.length % COLORS.length]
    });
    if (isNewName || !f) {
      rememberFriend({
        user_id: f && f.user_id,
        display_name: name,
        username: (f && f.username) || '',
        provisional: !(f && f.user_id),
        nicknames: typed && typed.toLowerCase() !== name.toLowerCase() ? [typed] : []
      });
    } else {
      rememberFriend(f);
      // Typed query that isn't username/display becomes a nickname (e.g. Paul → FlawedXJ)
      if (typed) {
        var un = String(f.username || '').toLowerCase();
        var dn = String(f.display_name || '').toLowerCase();
        var t = typed.toLowerCase();
        if (t !== un && t !== dn) addNicknameToFriend(f.user_id || f.username || f.display_name, typed);
      }
    }
    saveNamedList(list);
    renderListMembersModal(findNamedListById(list.id) || list);
    appToast('Added ' + name + (typed && typed !== name ? ' (also as ' + typed + ')' : ''));
  }

  function maybeOfferMemberClaim(list) {
    if (!list) return;
    normalizeNamedList(list);
    // Owner already has their slot; only offer claim to non-owners looking at the list
    if (isNamedListOwner(list)) return;
    var provisional = (list.members || []).filter(function (m) {
      return m.provisional && !m.claimed_by;
    });
    if (!provisional.length) return;
    var me = myId();
    if ((list.members || []).some(function (m) {
      return (m.claimed_by && String(m.claimed_by) === String(me)) ||
        (m.user_id && String(m.user_id) === String(me));
    })) return;
    // Show claim modal once per open
    if (state._claimShownFor === list.id) return;
    state._claimShownFor = list.id;
    var box = $('claim-member-list');
    if (box) {
      box.innerHTML = provisional.map(function (m) {
        return '<button type="button" class="btn" data-claim-member="' + esc(m.user_id) +
          '" style="width:100%;margin:0 0 6px">' + esc(m.display_name || 'Member') + '</button>';
      }).join('') +
        '<button type="button" class="btn" id="claim-none-of-these" style="width:100%;margin-top:4px">None of these are me</button>';
    }
    if ($('claim-member-modal')) {
      $('claim-member-modal').classList.add('is-open');
      $('claim-member-modal').setAttribute('aria-hidden', 'false');
    }
  }

  var _colOpts = { listId: null, colId: null, slot: 'tab' };
  function openColOptionsModal(list, colId) {
    var col = getListColumn(list, colId);
    if (!col) return;
    _colOpts = { listId: list.id, colId: colId, slot: 'tab' };
    if ($('col-opt-title')) $('col-opt-title').textContent = 'Options · ' + (col.name || 'Section');
    if ($('col-opt-name')) $('col-opt-name').value = col.name || '';
    document.querySelectorAll('[data-col-color-slot]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-col-color-slot') === 'tab');
    });
    renderColColorSwatches(col.colors.tab || DEFAULT_COL_COLORS.tab);
    if ($('col-opt-save-template')) {
      $('col-opt-save-template').style.display = isNamedListOwner(list) ? '' : 'none';
    }
    if ($('col-options-modal')) {
      $('col-options-modal').classList.add('is-open');
      $('col-options-modal').setAttribute('aria-hidden', 'false');
    }
  }
  function closeColOptionsModal() {
    if ($('col-options-modal')) {
      $('col-options-modal').classList.remove('is-open');
      $('col-options-modal').setAttribute('aria-hidden', 'true');
    }
  }
  function renderColColorSwatches(selected) {
    var row = $('col-opt-swatches');
    if (!row) return;
    row.innerHTML = COL_COLOR_PRESETS.map(function (c) {
      return '<button type="button" class="col-swatch' + (c === selected ? ' selected' : '') +
        '" data-col-swatch="' + c + '" style="background:' + c +
        (c === '#ffffff' || c === '#f0f4ee' ? ';box-shadow:inset 0 0 0 1px #666' : '') + '"></button>';
    }).join('');
  }
  function applyColColor(hex) {
    var list = findNamedListById(_colOpts.listId);
    var col = getListColumn(list, _colOpts.colId);
    if (!list || !col) return;
    var slot = _colOpts.slot || 'tab';
    if (!col.colors) col.colors = Object.assign({}, DEFAULT_COL_COLORS);
    col.colors[slot] = hex;
    saveNamedList(list);
    renderColColorSwatches(hex);
    render();
  }

  function addItemToListColumn(list, colId, title, extras) {
    title = autoCap(String(title || '').trim());
    if (!title) return false;
    try {
      var listId = (list && list.id != null) ? list.id : state.activeNamedListId;
      // Work from a healed copy of the stored list
      var live = null;
      if (listId != null && listId !== '') {
        live = findNamedListById(listId);
      }
      if (!live && list && typeof list === 'object') {
        live = sanitizeNamedList(JSON.parse(JSON.stringify(list)));
      }
      if (!live) {
        var ev0 = activeEvent();
        if (ev0) {
          var linked = listsForEvent(ev0.id);
          if (linked.length) live = findNamedListById(linked[0].id) || sanitizeNamedList(linked[0]);
        }
      }
      if (!live) return false;
      sanitizeNamedList(live);

      var want = String(colId || 'todo').toLowerCase().trim();
      var col = (live.columns || []).find(function (c) {
        if (!c) return false;
        var id = String(c.id || '').toLowerCase();
        var name = String(c.name || '').toLowerCase();
        return id === want || name === want ||
          name === listKindLabel(want).toLowerCase() ||
          (want === 'todo' && (id === 'todo' || name === 'to do')) ||
          (want === 'buy' && (id === 'buy' || name === 'to buy')) ||
          (want === 'bring' && (id === 'bring' || name === 'to bring'));
      }) || null;
      // Create missing classic column if needed
      if (!col) {
        var newId = (want === 'buy' || want === 'bring' || want === 'todo') ? want : ('col_' + uid());
        col = defaultColumn(newId, listKindLabel(newId));
        live.columns.push(col);
      }
      if (!Array.isArray(col.items)) col.items = [];
      var item = newItem(title, extras || {});
      // Private checklist: mark as mine only (#66)
      if (String(col.id) === 'personal' || String(want) === 'personal') {
        item.private_to = String(myId() || 'local');
        item.from_manual = true;
      }
      col.items.push(item);

      state.listTab = col.id;
      state.activeNamedListId = String(live.id);
      state.filterQualifier = 'all';
      state.expandedItemId = null;

      var ok = saveNamedList(live);
      if (ok === false) {
        appToast('Could not save list (storage full?)');
        return false;
      }
      return true;
    } catch (eAdd) {
      console.warn('addItemToListColumn', eAdd);
      appToast('Could not add item');
      return false;
    }
  }

  /**
   * Single entry for column Add button + Enter key.
   * fromEl: the input or button that triggered the add.
   */
  var _addInFlight = false;
  function submitColumnAddFromUi(fromEl) {
    if (!fromEl) return false;
    // Prevent capture+bubble double-fire from racing two saves
    if (_addInFlight) return false;
    _addInFlight = true;
    try {
      return submitColumnAddFromUiInner(fromEl);
    } finally {
      setTimeout(function () { _addInFlight = false; }, 80);
    }
  }
  function submitColumnAddFromUiInner(fromEl) {
    var colEl = fromEl.closest ? fromEl.closest('.list-col') : null;
    var colId = fromEl.getAttribute && (
      fromEl.getAttribute('data-col-add') ||
      fromEl.getAttribute('data-col-add-input') ||
      fromEl.getAttribute('data-event-col-add') ||
      fromEl.getAttribute('data-event-col-add-input')
    );
    if (!colId && colEl) colId = colEl.getAttribute('data-col-kind');
    var wrap = fromEl.closest ? (fromEl.closest('.list-col-add') || colEl) : null;
    var inp = null;
    if (fromEl.tagName === 'INPUT') inp = fromEl;
    else if (wrap) inp = wrap.querySelector('input');
    if (!inp && colId) {
      inp = document.querySelector(
        '[data-col-add-input="' + colId + '"], [data-event-col-add-input="' + colId + '"]'
      );
    }
    var title = inp ? String(inp.value || '') : '';
    if (!String(title).trim()) {
      appToast('Type an item name first');
      if (inp) try { inp.focus(); } catch (e0) {}
      return false;
    }
    var list = resolveOpenNamedList(fromEl);
    if (!list) {
      var triad = fromEl.closest && fromEl.closest('[data-list-id]');
      if (triad) list = findNamedListById(triad.getAttribute('data-list-id'));
    }
    if (!list) list = findNamedListById(state.activeNamedListId);
    // Paste of a shared item payload keeps all settings from the source list
    var pasted = parseClipboardItem(title);
    var extras = null;
    if (pasted) {
      extras = {
        qty: pasted.qty,
        qualifier: pasted.qualifier,
        priority: pasted.priority,
        due_mode: pasted.due_mode,
        due_days: pasted.due_days,
        highlight: pasted.highlight,
        highlight_color: pasted.highlight_color,
        creator_only_edit: pasted.creator_only_edit,
        require_all: pasted.require_all,
        notes: pasted.notes,
        notesList: pasted.notesList,
        shared_expense: pasted.shared_expense,
        expense_amount: pasted.expense_amount
      };
      title = pasted.title || title;
    }
    // Named list path
    if (list && addItemToListColumn(list, colId, title, extras)) {
      if (inp) inp.value = '';
      // Keep the open list id stable so re-render never drops the pack
      if (list.id) state.activeNamedListId = String(list.id);
      // Paint triad FIRST from store so To buy / columns never flash empty
      function paintOpenTriad() {
        try {
          var live = findNamedListById(state.activeNamedListId) || list;
          if (!live) return;
          setRightPanelMode('list');
          if ($('lists-placeholder')) {
            $('lists-placeholder').style.display = 'none';
            $('lists-placeholder').hidden = true;
          }
          if ($('list-detail-bar')) $('list-detail-bar').style.display = '';
          if ($('ev-list')) {
            var q = { state: { qualifiers: DEFAULT_QUALIFIERS.map(function (qq) { return Object.assign({}, qq); }) } };
            $('ev-list').innerHTML = renderListTriad(live, q);
            wireListColumnUi(live);
            try { renderQualifierFilters(q, live); } catch (eF) {}
          }
        } catch (eP) { console.warn('paintOpenTriad', eP); }
      }
      paintOpenTriad();
      try {
        render();
      } catch (eRen) {
        console.warn('render after add', eRen);
        paintOpenTriad();
      }
      setTimeout(function () {
        var again = document.querySelector(
          '[data-col-add-input="' + colId + '"], [data-event-col-add-input="' + colId + '"]'
        );
        if (again) try { again.focus(); } catch (e1) {}
      }, 30);
      return true;
    }
    // Event packing buckets (no named list)
    var isEvPack = fromEl.getAttribute && (
      fromEl.getAttribute('data-event-col-add-input') != null ||
      fromEl.getAttribute('data-event-col-add') != null
    );
    if (isEvPack) {
      state.listTab = colId || 'todo';
      if ($('add-item-input')) $('add-item-input').value = title;
      addItemFromInputs();
      if (inp) inp.value = '';
      return true;
    }
    appToast('Could not add item — try opening the list again');
    return false;
  }

  function renderInlineAddMembersHtml(opts) {
    opts = opts || {};
    var drawerKey = opts.drawerKey || '';
    // Dropdown under event/list card: members only (add/remove is in Edit)
    return '<div class="inline-members-block" data-drawer-key="' + esc(drawerKey) + '">' +
      '<div class="section-label">Members</div>' +
      '<div class="inline-members-chips">' + (opts.membersHtml || '<span class="muted" style="font-size:12px">Just you</span>') + '</div>' +
      '</div>';
  }

  function wireInlineMemberSearch(prefix, listId, scope) {
    var search = $(prefix + '-member-search');
    var pick = $(prefix + '-member-pick');
    if (!search || !pick) return;
    if (!search._wiredInline) {
      search._wiredInline = true;
      function refresh() {
        fillMemberSharePick(pick, search.value);
      }
      search.addEventListener('input', function (e) {
        e.stopPropagation();
        refresh();
      });
      search.addEventListener('focus', function (e) {
        e.stopPropagation();
        refreshMapPartnersFromCloud().then(function () { refresh(); }).catch(function () { refresh(); });
        refresh();
      });
      search.addEventListener('keydown', function (e) { e.stopPropagation(); });
      search.addEventListener('click', function (e) { e.stopPropagation(); });
      pick.addEventListener('mousedown', function (e) {
        // Keep focus from leaving the search when clicking a match
        e.preventDefault();
        e.stopPropagation();
      });
      pick.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-share-to-member], [data-share-to-new]');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var isNew = !!b.getAttribute('data-share-to-new');
        var key = b.getAttribute('data-share-to-member') || b.getAttribute('data-share-to-new');
        if (scope === 'list') {
          var list = findNamedListById(listId || state.activeNamedListId);
          if (!list || !isNamedListOwner(list)) {
            appToast('Only the list creator can add members');
            return;
          }
          addListMemberFromPick(list, key, isNew);
          search.value = '';
          state.membersAddOpenKey = state.membersDrawerKey;
          render();
          return;
        }
        if (scope === 'event') {
          addEventMemberFromPick(key, isNew);
          search.value = '';
          state.membersAddOpenKey = state.membersDrawerKey;
          render();
        }
      });
    }
    // If form is open, seed suggestions and restore focus after re-render
    var formOpen = search.closest && search.closest('.inline-add-members-form.is-open');
    if (formOpen) {
      try { fillMemberSharePick(pick, search.value); } catch (eF) {}
      if (state._keepMemberSearchFocus) {
        setTimeout(function () {
          try {
            search.focus();
            var v = search.value || '';
            search.setSelectionRange(v.length, v.length);
          } catch (e2) {}
          state._keepMemberSearchFocus = false;
        }, 20);
      }
    }
  }

  /** Actually remove (no confirm). opts.skipRender / opts.quiet */
  function removeEventMemberNow(memberId, opts) {
    opts = opts || {};
    var ev = activeEvent() || findEventById(state.activeEventId);
    if (!ev) return false;
    if (!isEventCreator(ev) && String(ev.owner_user_id) !== String(myId()) && myId()) {
      if (!opts.quiet) appToast('Only the host can remove members');
      return false;
    }
    if (String(memberId) === String(ev.owner_user_id) || String(memberId) === String(myId())) {
      if (!opts.quiet) appToast('Can’t remove the host');
      return false;
    }
    var mem = (state.members || []).find(function (m) { return String(m.user_id) === String(memberId); });
    var label = (mem && (mem.display_name || mem.username)) || 'member';
    markMemberRemoved(ev, memberId);
    state.members = (state.members || []).filter(function (m) { return String(m.user_id) !== String(memberId); });
    syncLocalMembersFromState(ev);
    try {
      var client = sb();
      if (client && isUuidLike(ev.id) && isUuidLike(memberId) && !ev._localOnly) {
        client.from('plan_event_members').delete()
          .eq('event_id', ev.id).eq('user_id', memberId).then(function () {}).catch(function () {});
      }
    } catch (eCloud) {}
    try {
      var linked = listsForEvent(ev.id);
      if (linked[0] && Array.isArray(linked[0].members)) {
        linked[0].members = linked[0].members.filter(function (m) {
          return String(m.user_id) !== String(memberId);
        });
        saveNamedList(linked[0]);
      }
    } catch (eL) {}
    try { saveActiveEvent(); } catch (eS) { persistLocal(); cloudSaveEvent(ev); }
    if (!opts.quiet) appToast('Removed ' + label);
    if (!opts.skipRender) {
      try { fillEditEventMembersPanel(); } catch (eP) {}
      try { render(); } catch (eR) {}
    }
    return true;
  }

  function removeListMemberNow(list, memberId, opts) {
    opts = opts || {};
    if (!list) return false;
    if (!isNamedListOwner(list)) {
      if (!opts.quiet) appToast('Only the list creator can remove members');
      return false;
    }
    if (String(memberId) === String(list.owner_id)) {
      if (!opts.quiet) appToast('Can’t remove the list owner');
      return false;
    }
    normalizeNamedList(list);
    var mem = (list.members || []).find(function (m) { return String(m.user_id) === String(memberId); });
    var label = (mem && (mem.display_name || mem.username)) || 'member';
    list.members = (list.members || []).filter(function (m) { return String(m.user_id) !== String(memberId); });
    saveNamedList(list);
    if (list.eventId) {
      try {
        var prevId = state.activeEventId;
        if (String(state.activeEventId) !== String(list.eventId)) {
          state.activeEventId = String(list.eventId);
        }
        removeEventMemberNow(memberId, { quiet: true, skipRender: true });
        if (prevId) state.activeEventId = prevId;
      } catch (eE) {}
    }
    if (!opts.quiet) appToast('Removed ' + label);
    if (!opts.skipRender) {
      try { fillEditListMembersPanel(list); } catch (eP) {}
      try { render(); } catch (eR) {}
    }
    return true;
  }

  /** Merge dropId into keepId (claims + drop member). scope: event | list */
  function mergeMembers(keepId, dropId, scope, listId) {
    keepId = String(keepId || '');
    dropId = String(dropId || '');
    if (!keepId || !dropId || keepId === dropId) {
      appToast('Pick two different people');
      return false;
    }
    function rekeyClaims(item) {
      if (!item || !item.claims || typeof item.claims !== 'object') return;
      var qDrop = Number(item.claims[dropId] || 0);
      if (qDrop <= 0) return;
      var qKeep = Number(item.claims[keepId] || 0);
      item.claims[keepId] = qKeep + qDrop;
      delete item.claims[dropId];
    }
    if (scope === 'list') {
      var list = findNamedListById(listId || state.activeNamedListId);
      if (!list) return false;
      sanitizeNamedList(list);
      (list.columns || []).forEach(function (c) {
        (c.items || []).forEach(rekeyClaims);
      });
      list.members = (list.members || []).filter(function (m) {
        return String(m.user_id) !== dropId;
      });
      saveNamedList(list);
      if (list.eventId) {
        var evL = findEventById(list.eventId);
        if (evL) {
          markMemberRemoved(evL, dropId);
          if (String(state.activeEventId) === String(list.eventId)) {
            state.members = (state.members || []).filter(function (m) {
              return String(m.user_id) !== dropId;
            });
            syncLocalMembersFromState(evL);
            try { saveActiveEvent(); } catch (e) { persistLocal(); }
          }
        }
      }
      appToast('Members merged');
      fillEditListMembersPanel(list);
      render();
      return true;
    }
    var ev = activeEvent();
    if (!ev) return false;
    // Rekey claims on linked list + event buckets
    try {
      var linked = listsForEvent(ev.id);
      if (linked[0]) {
        sanitizeNamedList(linked[0]);
        (linked[0].columns || []).forEach(function (c) {
          (c.items || []).forEach(rekeyClaims);
        });
        linked[0].members = (linked[0].members || []).filter(function (m) {
          return String(m.user_id) !== dropId;
        });
        saveNamedList(linked[0]);
      }
    } catch (eL) {}
    if (ev.state && ev.state.lists) {
      ['todo', 'buy', 'bring'].forEach(function (k) {
        try {
          ((ev.state.lists[k] && ev.state.lists[k].group) || []).forEach(rekeyClaims);
        } catch (e) {}
      });
    }
    markMemberRemoved(ev, dropId);
    unmarkMemberRemoved(ev, keepId);
    state.members = (state.members || []).filter(function (m) {
      return String(m.user_id) !== dropId;
    });
    syncLocalMembersFromState(ev);
    try {
      var client = sb();
      if (client && isUuidLike(ev.id) && isUuidLike(dropId) && !ev._localOnly) {
        client.from('plan_event_members').delete()
          .eq('event_id', ev.id).eq('user_id', dropId).then(function () {}).catch(function () {});
      }
    } catch (eC) {}
    try { saveActiveEvent(); } catch (eS) { persistLocal(); }
    appToast('Members merged');
    fillEditEventMembersPanel();
    render();
    return true;
  }

  function fillMergeSelects(keepSel, dropSel, members) {
    if (!keepSel || !dropSel) return;
    var opts = (members || []).filter(Boolean).map(function (m) {
      var id = m.user_id || m.display_name;
      return '<option value="' + esc(String(id)) + '">' + esc(m.display_name || m.username || 'Member') + '</option>';
    }).join('');
    keepSel.innerHTML = opts || '<option value="">—</option>';
    dropSel.innerHTML = opts || '<option value="">—</option>';
    if (dropSel.options.length > 1) dropSel.selectedIndex = 1;
  }

  function fillEditEventMembersPanel() {
    var box = $('edit-ev-members-list');
    if (!box) return;
    var ev = activeEvent();
    var canRm = ev && (isEventCreator(ev) || String(ev.owner_user_id) === String(myId()) || !myId());
    var mems = state.members || [];
    if (!mems.length) {
      box.innerHTML = '<p class="muted" style="font-size:12px;margin:0">Just you so far.</p>';
    } else {
      box.innerHTML = mems.map(function (m) {
        var mid = String(m.user_id || '');
        var isOwner = m.role === 'owner' || String(mid) === String(ev && ev.owner_user_id);
        var pending = state._editRmConfirm && state._editRmConfirm.scope === 'event' &&
          String(state._editRmConfirm.id) === mid;
        if (pending) {
          return '<div class="edit-member-confirm" data-emc-id="' + esc(mid) + '">' +
            '<div>Remove <strong>' + esc(m.display_name || 'Member') + '</strong> from this event?</div>' +
            '<div class="emc-actions">' +
              '<button type="button" class="btn btn-primary" data-emc-yes="' + esc(mid) + '" data-emc-scope="event">Remove</button>' +
              '<button type="button" class="btn" data-emc-no>Cancel</button>' +
            '</div></div>';
        }
        return '<div class="edit-member-row">' +
          '<span class="member-chip">' + esc(m.display_name || m.username || 'Member') +
          (isOwner ? ' · host' : '') + '</span>' +
          (canRm && !isOwner
            ? '<button type="button" class="btn btn-rm-mem" data-edit-rm-mem="' + esc(mid) +
              '" data-edit-rm-scope="event">Remove</button>'
            : '') +
          '</div>';
      }).join('');
    }
    fillMergeSelects($('edit-ev-merge-keep'), $('edit-ev-merge-drop'), mems);
  }

  function fillEditListMembersPanel(list) {
    var box = $('edit-list-members-list');
    if (!box) return;
    list = list || findNamedListById(state.activeNamedListId);
    if (!list) {
      box.innerHTML = '<p class="muted" style="font-size:12px;margin:0">No list open.</p>';
      return;
    }
    normalizeNamedList(list);
    var canRm = isNamedListOwner(list);
    var mems = list.members || [];
    if (!mems.length) {
      box.innerHTML = '<p class="muted" style="font-size:12px;margin:0">Just you so far.</p>';
    } else {
      box.innerHTML = mems.map(function (m) {
        var mid = String(m.user_id || '');
        var isOwner = m.role === 'owner' || String(mid) === String(list.owner_id);
        var pending = state._editRmConfirm && state._editRmConfirm.scope === 'list' &&
          String(state._editRmConfirm.id) === mid;
        if (pending) {
          return '<div class="edit-member-confirm" data-emc-id="' + esc(mid) + '">' +
            '<div>Remove <strong>' + esc(m.display_name || 'Member') + '</strong> from this list?</div>' +
            '<div class="emc-actions">' +
              '<button type="button" class="btn btn-primary" data-emc-yes="' + esc(mid) +
              '" data-emc-scope="list" data-emc-list="' + esc(list.id) + '">Remove</button>' +
              '<button type="button" class="btn" data-emc-no>Cancel</button>' +
            '</div></div>';
        }
        return '<div class="edit-member-row">' +
          '<span class="member-chip">' + esc(m.display_name || m.username || 'Member') +
          (isOwner ? ' · owner' : '') + '</span>' +
          (canRm && !isOwner
            ? '<button type="button" class="btn btn-rm-mem" data-edit-rm-mem="' + esc(mid) +
              '" data-edit-rm-scope="list" data-edit-rm-list="' + esc(list.id) + '">Remove</button>'
            : '') +
          '</div>';
      }).join('');
    }
    fillMergeSelects($('edit-list-merge-keep'), $('edit-list-merge-drop'), mems);
  }

  function addEventMemberFromPick(friendKey, isNewName) {
    var ev = activeEvent();
    if (!ev) { appToast('Open an event first'); return; }
    if (!isEventCreator(ev) && myId() && String(ev.owner_user_id) !== String(myId())) {
      appToast('Only the host/creator can add members');
      return;
    }
    var typed = ($('event-detail-member-search') && $('event-detail-member-search').value) ||
      ($('event-card-member-search') && $('event-card-member-search').value) || '';
    typed = autoCap(String(typed).trim());
    var f = searchFriends('', 80).find(function (x) {
      return String(x.user_id || '') === String(friendKey) ||
        String(x.username || '').toLowerCase() === String(friendKey).toLowerCase() ||
        String(x.display_name || '').toLowerCase() === String(friendKey).toLowerCase();
    });
    var name = isNewName ? autoCap(String(friendKey)) : (f ? (f.display_name || f.username) : autoCap(String(friendKey)));
    var uidM = (f && f.user_id) ? f.user_id : ('name_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    if (!Array.isArray(state.members)) state.members = [];
    if (state.members.some(function (m) {
      return String(m.user_id) === String(uidM) ||
        String(m.display_name || '').toLowerCase() === name.toLowerCase();
    })) {
      appToast('Already a member');
      return;
    }
    state.members.push({
      user_id: uidM,
      display_name: name,
      username: (f && f.username) || '',
      role: 'member',
      provisional: !(f && f.user_id),
      arrow_color: (f && f.arrow_color) || COLORS[state.members.length % COLORS.length]
    });
    if (isNewName || !f) {
      rememberFriend({
        user_id: f && f.user_id,
        display_name: name,
        username: (f && f.username) || '',
        provisional: !(f && f.user_id),
        nicknames: typed && typed.toLowerCase() !== name.toLowerCase() ? [typed] : []
      });
    } else {
      rememberFriend(f);
      if (typed) {
        var un = String(f.username || '').toLowerCase();
        var dn = String(f.display_name || '').toLowerCase();
        if (typed.toLowerCase() !== un && typed.toLowerCase() !== dn) {
          addNicknameToFriend(f.user_id || f.username || f.display_name, typed);
        }
      }
    }
    unmarkMemberRemoved(ev, uidM);
    syncLocalMembersFromState(ev);
    if (!ev._personalOnly) saveActiveEvent();
    else {
      var board = loadPersonalBoard();
      var idx = (board.events || []).findIndex(function (e) { return String(e.id) === String(ev.id); });
      if (idx >= 0) {
        board.events[idx].state = board.events[idx].state || {};
        board.events[idx].state.localMembers = ev.state.localMembers;
        board.events[idx].state.removedMemberIds = (ev.state.removedMemberIds || []).slice();
        savePersonalBoard(board);
      }
    }
    appToast('Added ' + name);
    try { fillEditEventMembersPanel(); } catch (eF) {}
  }

  /** Tesseract CDN base (#35 / #38) — explicit worker paths for mobile */
  var TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist';
  var TESSERACT_CORE_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js';
  var TESSERACT_LANG_CDN = 'https://tessdata.projectnaptha.com/4.0.0';

  /** Load Tesseract.js once (CDN) for photo → text */
  function loadTesseractLib() {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve(window.Tesseract);
      var existing = document.querySelector('script[data-tesseract]');
      if (existing) {
        var wait = 0;
        var t = setInterval(function () {
          wait += 100;
          if (window.Tesseract) {
            clearInterval(t);
            resolve(window.Tesseract);
          } else if (wait > 20000) {
            clearInterval(t);
            reject(new Error('OCR load timed out'));
          }
        }, 100);
        existing.addEventListener('error', function () {
          clearInterval(t);
          reject(new Error('OCR load failed'));
        });
        return;
      }
      var s = document.createElement('script');
      s.src = TESSERACT_CDN + '/tesseract.min.js';
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.setAttribute('data-tesseract', '1');
      s.onload = function () {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error('OCR not available after load'));
      };
      s.onerror = function () {
        reject(new Error('OCR library failed to load — need network once (cdn.jsdelivr.net)'));
      };
      document.head.appendChild(s);
    });
  }

  function ensureOcrFileInput() {
    var inp = $('list-ocr-file-input');
    if (inp) return inp;
    inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    try { inp.setAttribute('capture', 'environment'); } catch (eC) {}
    inp.id = 'list-ocr-file-input';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    return inp;
  }

  /**
   * Rasterize any camera/gallery file to JPEG data URL(s) for Tesseract.
   * Returns { mild, ink } data URLs for dual-pass OCR (#48).
   * Fixes HEIC/HEIF phones where raw File often fails OCR (#38).
   */
  function fileToOcrJpegDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('No photo selected'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width || 0;
          var h = img.naturalHeight || img.height || 0;
          if (!w || !h) {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image dimensions'));
            return;
          }
          var maxEdge = 1800;
          var scale = 1;
          if (Math.max(w, h) > maxEdge) scale = maxEdge / Math.max(w, h);
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          function makeVariant(mode) {
            var canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            var ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            try { enhanceCanvasForOcr(ctx, cw, ch, mode); } catch (eEn) {}
            return canvas.toDataURL('image/jpeg', 0.92);
          }
          var mild = makeVariant('mild');
          var ink = makeVariant('ink');
          URL.revokeObjectURL(url);
          if (!mild || mild.length < 100) {
            reject(new Error('Could not convert photo for OCR'));
            return;
          }
          resolve({ mild: mild, ink: ink || mild, primary: mild });
        } catch (eDraw) {
          try { URL.revokeObjectURL(url); } catch (eU) {}
          reject(eDraw || new Error('Image convert failed'));
        }
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (eU2) {}
        // Fallback: FileReader as data URL (some HEIC browsers still fail)
        try {
          var fr = new FileReader();
          fr.onload = function () {
            var raw = fr.result;
            if (typeof raw === 'string' && raw.indexOf('data:') === 0) {
              // Try loading again via Image from data URL
              var img2 = new Image();
              img2.onload = function () {
                try {
                  var w2 = img2.naturalWidth || img2.width;
                  var h2 = img2.naturalHeight || img2.height;
                  var maxE = 1800;
                  var sc = Math.max(w2, h2) > maxE ? maxE / Math.max(w2, h2) : 1;
                  function var2(mode) {
                    var c2 = document.createElement('canvas');
                    c2.width = Math.max(1, Math.round(w2 * sc));
                    c2.height = Math.max(1, Math.round(h2 * sc));
                    var x2 = c2.getContext('2d');
                    x2.fillStyle = '#fff';
                    x2.fillRect(0, 0, c2.width, c2.height);
                    x2.drawImage(img2, 0, 0, c2.width, c2.height);
                    try { enhanceCanvasForOcr(x2, c2.width, c2.height, mode); } catch (eEn2) {}
                    return c2.toDataURL('image/jpeg', 0.92);
                  }
                  var mild2 = var2('mild');
                  resolve({ mild: mild2, ink: var2('ink') || mild2, primary: mild2 });
                } catch (e2) {
                  reject(new Error('Phone photo format not supported — try Gallery JPG'));
                }
              };
              img2.onerror = function () {
                reject(new Error('Could not open photo (try Gallery, or retake as JPG)'));
              };
              img2.src = raw;
            } else {
              reject(new Error('Could not open photo'));
            }
          };
          fr.onerror = function () {
            reject(new Error('Could not open photo'));
          };
          fr.readAsDataURL(file);
        } catch (eFr) {
          reject(new Error('Could not open photo (HEIC?). Use gallery JPG if possible'));
        }
      };
      img.src = url;
    });
  }

  /**
   * Image prep for handwriting (#48).
   * mode: 'mild' = grayscale + gentle stretch (keeps faint pencil)
   *        'ink'  = stronger stretch (print / dark pen) — no hard wipe of mid grays
   */
  function enhanceCanvasForOcr(ctx, w, h, mode) {
    if (!ctx || !w || !h) return;
    mode = mode || 'mild';
    var imgData = ctx.getImageData(0, 0, w, h);
    var d = imgData.data;
    var i, min = 255, max = 0, g;
    for (i = 0; i < d.length; i += 4) {
      g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    var range = Math.max(1, max - min);
    for (i = 0; i < d.length; i += 4) {
      g = d[i];
      g = Math.round(((g - min) / range) * 255);
      if (mode === 'ink') {
        // Gentle S-curve — do NOT hard-threshold (that wiped pale handwriting → blank rows)
        if (g > 220) g = 255;
        else if (g < 40) g = 0;
        else g = Math.round(Math.pow(g / 255, 0.85) * 255);
      } else {
        // Mild: only stretch; leave midtones for pencil
        g = Math.min(255, Math.max(0, Math.round((g - 10) * (255 / 235))));
      }
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  /** True if line looks like real words (not OCR junk / empty / control chars). */
  function ocrLineLooksReal(line) {
    line = String(line || '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    if (line.length < 2) return false;
    if (line.length > 80) return false;
    // Must have visible non-space content
    if (!/\S/.test(line)) return false;
    // Mostly letters / numbers / basic punctuation
    var letters = (line.match(/[A-Za-z0-9]/g) || []).length;
    var alpha = (line.match(/[A-Za-z]/g) || []).length;
    var ratio = letters / line.length;
    if (ratio < 0.5) return false;
    // Prefer lines with at least 2 letters (handwritten list words)
    if (alpha < 2) return false;
    // Reject pure symbol noise
    if (/^[^\w\s]+$/.test(line)) return false;
    // Common Tesseract garbage / code-like
    if (/^[|Il1\-~_=+*#@%&\/\\{}[\]<>]+$/.test(line)) return false;
    if (/(.)\1{4,}/.test(line)) return false;
    if (/[{}[\]<>\\\/]{2,}/.test(line)) return false;
    if (/function|const |var |return |https?:|www\./i.test(line)) return false;
    // Single short tokens of only ambiguous OCR chars
    if (/^[ilIL|0Oo]{2,6}$/.test(line)) return false;
    // Blank-looking after stripping non-letters
    if (!(line.replace(/[^A-Za-z0-9]/g, '').length >= 2)) return false;
    return true;
  }

  /** Stronger lines default-checked; weak/junk start unchecked (#40). */
  function ocrLineIsStrong(line) {
    line = String(line || '').trim();
    if (!ocrLineLooksReal(line)) return false;
    var alpha = (line.match(/[A-Za-z]/g) || []).length;
    var words = line.split(/\s+/).filter(Boolean);
    if (alpha >= 3 && words.length <= 6) return true;
    if (words.length >= 2 && alpha >= 4) return true;
    return false;
  }

  function splitOcrToListItems(text) {
    text = String(text || '')
      .replace(/\r/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    var lines = text.split(/\n+/).map(function (l) {
      return l
        .replace(/^[\s•\-\*\u2022·▪◦\d\.\)\(]+/, '')
        .replace(/[|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }).filter(function (l) {
      return l && l.length >= 2 && /\S/.test(l);
    });
    var items = [];
    lines.forEach(function (line) {
      // Only split on clear separators — NOT every double-space (that made extra junk items)
      if (/;/.test(line) && line.split(';').length <= 8) {
        line.split(';').forEach(function (p) {
          p = String(p || '').trim();
          if (ocrLineLooksReal(p)) items.push(p);
        });
      } else if (ocrLineLooksReal(line)) {
        items.push(line);
      }
    });
    // Dedupe (case-insensitive) keep first
    var seen = {};
    var out = [];
    items.forEach(function (it) {
      var k = it.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    // Cap to avoid flood
    if (out.length > 40) out = out.slice(0, 40);
    return out;
  }

  function mergeOcrLineLists(a, b) {
    var seen = {};
    var out = [];
    (a || []).concat(b || []).forEach(function (it) {
      it = String(it || '').trim();
      if (!ocrLineLooksReal(it)) return;
      var k = it.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    return out;
  }

  var _ocrReviewCtx = null;
  var _ocrDictateRec = null;
  var _ocrDictateTimer = null;
  var _ocrDictateAbortTimer = null;
  var _ocrAutoFlushing = false;
  var OCR_PHOTO_DRAFT_KEY = 'ps_ocr_photo_draft_v1';
  var OCR_DICTATE_MAX_MS = 40000;

  function closeOcrReviewModal() {
    var modal = $('ocr-review-modal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    stopOcrDictate();
    _ocrReviewCtx = null;
  }

  function isOcrReviewOpen() {
    var modal = $('ocr-review-modal');
    return !!(modal && modal.classList.contains('is-open'));
  }

  function clearOcrPhotoDraft() {
    try { localStorage.removeItem(OCR_PHOTO_DRAFT_KEY); } catch (e) {}
  }

  function saveOcrPhotoDraftToStorage(items, ctx) {
    if (!items || !items.length) return;
    ctx = ctx || _ocrReviewCtx || {};
    var payload = {
      v: 1,
      at: Date.now(),
      items: items.slice(0, 200),
      mode: ctx.mode || 'items',
      colId: ctx.colId || null,
      isEvent: !!ctx.isEvent,
      listId: null,
      eventId: null
    };
    try {
      if (state.activeNamedListId) payload.listId = state.activeNamedListId;
    } catch (eL) {}
    try {
      var ev = activeEvent();
      if (ev && ev.id) payload.eventId = ev.id;
    } catch (eE) {}
    try {
      localStorage.setItem(OCR_PHOTO_DRAFT_KEY, JSON.stringify(payload));
    } catch (eS) {}
  }

  /**
   * Tab close / hide: auto-apply OCR draft into list, or park in localStorage.
   * Skips empty reviews. Used by pagehide / visibilitychange / beforeunload.
   */
  function flushOcrReviewOnLeave() {
    if (_ocrAutoFlushing) return;
    if (!isOcrReviewOpen()) return;
    var items = collectOcrReviewSelected();
    if (!items.length) return;
    var ctx = _ocrReviewCtx || {};
    _ocrAutoFlushing = true;
    try {
      stopOcrDictate();
      // Prefer apply (same path as Add to list) when we have a target
      var canApply = false;
      try {
        if ((ctx.mode || 'items') === 'note') {
          canApply = !!(document.querySelector('.list-item.is-expanded .li-detail textarea[data-f="note_text"]') ||
            document.querySelector('.li-detail textarea[data-f="note_text"]'));
        } else {
          canApply = !!(resolveOcrTargetList() || (ctx.colId && activeEvent()));
        }
      } catch (eC) { canApply = false; }
      if (canApply) {
        applyOcrLines(items, ctx);
        clearOcrPhotoDraft();
      } else {
        saveOcrPhotoDraftToStorage(items, ctx);
      }
    } catch (eF) {
      try { saveOcrPhotoDraftToStorage(items, ctx); } catch (e2) {}
    }
    _ocrAutoFlushing = false;
  }

  function tryRestoreOcrPhotoDraft() {
    var raw = null;
    try { raw = localStorage.getItem(OCR_PHOTO_DRAFT_KEY); } catch (e) { return; }
    if (!raw) return;
    var draft = null;
    try { draft = JSON.parse(raw); } catch (eP) { clearOcrPhotoDraft(); return; }
    if (!draft || !Array.isArray(draft.items) || !draft.items.length) {
      clearOcrPhotoDraft();
      return;
    }
    // Stale after 7 days
    if (draft.at && (Date.now() - Number(draft.at)) > 7 * 24 * 3600 * 1000) {
      clearOcrPhotoDraft();
      return;
    }
    clearOcrPhotoDraft();
    var ctx = {
      mode: draft.mode || 'items',
      colId: draft.colId || null,
      isEvent: !!draft.isEvent,
      status: 'Recovered photo items from last session — review then Add, or they stay as listed.'
    };
    // Prefer auto-apply into current list if available
    var canApply = false;
    try {
      if ((ctx.mode || 'items') === 'note') canApply = false;
      else canApply = !!(resolveOcrTargetList() || (ctx.colId && activeEvent()));
    } catch (eA) { canApply = false; }
    if (canApply) {
      try {
        applyOcrLines(draft.items, ctx);
        appToast('Saved photo items from last session', 4000);
        return;
      } catch (eApply) {}
    }
    openOcrReviewModal(draft.items, ctx);
    appToast('Saved photo items from last session', 4000);
  }

  function setOcrStatus(msg) {
    var el = $('ocr-review-status');
    if (el) el.textContent = msg || '';
  }

  function setOcrPreview(dataUrl) {
    var wrap = $('ocr-preview-wrap');
    var img = $('ocr-preview-img');
    if (!wrap || !img) return;
    if (dataUrl) {
      img.src = dataUrl;
      wrap.style.display = '';
    } else {
      img.removeAttribute('src');
      wrap.style.display = 'none';
    }
  }

  /**
   * Review UI: one textarea, one item per line (no empty checkbox junk).
   * lines: string[]  preview: optional data URL
   */
  function openOcrReviewModal(lines, ctx) {
    _ocrReviewCtx = ctx || {};
    var modal = $('ocr-review-modal');
    var ta = $('ocr-review-text');
    if (!modal) {
      if (lines && lines.length) applyOcrLines(lines, _ocrReviewCtx);
      else appToast('Could not open review');
      return;
    }
    lines = (lines || []).map(function (l) {
      return String(l || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
    }).filter(function (l) {
      return l.length >= 1 && /[A-Za-z0-9]/.test(l);
    });
    if (ta) ta.value = lines.join('\n');
    setOcrPreview(ctx && ctx.previewUrl ? ctx.previewUrl : null);
    if ($('ocr-review-sub')) {
      $('ocr-review-sub').textContent =
        (ctx && ctx.mode === 'note')
          ? 'Edit lines, then Add to append to the note.'
          : 'One item per line. Fix any mistakes, then Add to list.';
    }
    if (ctx && ctx.status) setOcrStatus(ctx.status);
    else if (lines.length) setOcrStatus(lines.length + ' line' + (lines.length === 1 ? '' : 's') + ' ready — edit if needed.');
    else setOcrStatus('No auto-read yet — type or use Dictate, then Add.');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    try { if (ta) ta.focus(); } catch (eF) {}
  }

  function collectOcrReviewSelected() {
    var ta = $('ocr-review-text');
    if (ta && ta.value != null) {
      return String(ta.value || '')
        .replace(/\r/g, '\n')
        .split(/\n+/)
        .map(function (l) { return l.replace(/^[\s•\-\*\u2022·▪◦\d\.\)\(]+/, '').trim(); })
        .filter(function (l) {
          return l.length >= 1 && l.length <= 80 && /[A-Za-z0-9]/.test(l);
        });
    }
    // legacy checkbox path
    var listEl = $('ocr-review-list');
    if (!listEl) return [];
    var out = [];
    listEl.querySelectorAll('.ocr-review-row').forEach(function (row) {
      var ck = row.querySelector('.ocr-ck');
      var txt = row.querySelector('.ocr-txt');
      if (ck && !ck.checked) return;
      var v = txt ? String(txt.value || '').trim() : '';
      if (v.length >= 1 && /[A-Za-z0-9]/.test(v)) out.push(v);
    });
    return out;
  }

  function clearOcrDictateTimers() {
    if (_ocrDictateTimer) {
      try { clearTimeout(_ocrDictateTimer); } catch (eT) {}
      _ocrDictateTimer = null;
    }
    if (_ocrDictateAbortTimer) {
      try { clearTimeout(_ocrDictateAbortTimer); } catch (eA) {}
      _ocrDictateAbortTimer = null;
    }
  }

  function setOcrDictateBtnIdle() {
    var b = $('ocr-review-dictate');
    if (b) {
      b.textContent = 'Dictate';
      b.setAttribute('aria-pressed', 'false');
      b.title = 'Speak list items';
    }
  }

  function setOcrDictateBtnListening() {
    var b = $('ocr-review-dictate');
    if (b) {
      b.textContent = 'Stop listening';
      b.setAttribute('aria-pressed', 'true');
      b.title = 'Stop microphone';
    }
  }

  function stopOcrDictate(opts) {
    opts = opts || {};
    clearOcrDictateTimers();
    var rec = _ocrDictateRec;
    _ocrDictateRec = null;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
      } catch (e0) {}
      try { rec.stop(); } catch (e1) {}
      // Hard-stop if stop() hangs (common on mobile)
      try {
        _ocrDictateAbortTimer = setTimeout(function () {
          _ocrDictateAbortTimer = null;
          try { if (rec && typeof rec.abort === 'function') rec.abort(); } catch (eA) {}
        }, 400);
      } catch (e2) {
        try { if (typeof rec.abort === 'function') rec.abort(); } catch (e3) {}
      }
    }
    setOcrDictateBtnIdle();
    if (opts.timeout) {
      setOcrStatus('Dictate timed out — tap Dictate to try again');
      try { appToast('Listening stopped (timeout)', 2800); } catch (eT) {}
    }
  }

  function ocrDictateErrorMessage(err) {
    var code = '';
    try { code = String((err && (err.error || err.message)) || ''); } catch (e) {}
    code = code.toLowerCase();
    if (code.indexOf('not-allowed') >= 0 || code.indexOf('denied') >= 0 || code.indexOf('service-not-allowed') >= 0) {
      return 'Microphone blocked — allow mic access or type instead';
    }
    if (code.indexOf('no-speech') >= 0) return 'No speech heard — tap Dictate and try again';
    if (code.indexOf('network') >= 0) return 'Dictate needs network on this browser';
    if (code.indexOf('aborted') >= 0) return '';
    if (code) return 'Dictate stopped (' + code + ')';
    return 'Dictate stopped';
  }

  function startOcrDictate() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      appToast('Dictate not supported on this browser — type instead');
      return;
    }
    stopOcrDictate();
    var rec = new SR();
    _ocrDictateRec = rec;
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    setOcrDictateBtnListening();
    setOcrStatus('Listening — speak list items, pause between each. Tap Stop listening when done.');
    rec.onresult = function (ev) {
      var ta = $('ocr-review-text');
      if (!ta) return;
      var chunk = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) chunk += (ev.results[i][0].transcript || '') + '\n';
      }
      chunk = chunk.trim();
      if (!chunk) return;
      // Split spoken "chips, soda and ice" into lines
      var bits = chunk.split(/[,;]|\band\b/i).map(function (s) { return s.trim(); }).filter(Boolean);
      var cur = ta.value ? ta.value.replace(/\s+$/, '') + '\n' : '';
      ta.value = cur + bits.join('\n');
      setOcrStatus('Added speech — keep talking or tap Stop listening, then Add to list');
    };
    rec.onerror = function (ev) {
      var msg = ocrDictateErrorMessage(ev);
      stopOcrDictate();
      if (msg) {
        setOcrStatus(msg);
        try { appToast(msg, 3200); } catch (eT) {}
      } else {
        setOcrStatus('Dictate stopped');
      }
    };
    rec.onend = function () {
      // Continuous mode sometimes ends between phrases — only idle UI if we still own this rec
      if (_ocrDictateRec === rec) {
        _ocrDictateRec = null;
        clearOcrDictateTimers();
        setOcrDictateBtnIdle();
        setOcrStatus('Listening ended — tap Dictate to continue or Add to list');
      }
    };
    try {
      rec.start();
      _ocrDictateTimer = setTimeout(function () {
        _ocrDictateTimer = null;
        if (_ocrDictateRec === rec) stopOcrDictate({ timeout: true });
      }, OCR_DICTATE_MAX_MS);
    } catch (eS) {
      stopOcrDictate();
      appToast('Could not start microphone');
      setOcrStatus('Could not start microphone');
    }
  }

  /** Call server vision OCR (xAI). Returns { lines, engine } or throws. */
  function ocrViaVisionApi(dataUrl) {
    return fetch('/api/ocr-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok || !j || !j.ok) {
          var err = new Error((j && j.error) || ('OCR API ' + res.status));
          err.code = j && j.code;
          throw err;
        }
        return j;
      });
    });
  }

  function applyOcrLines(items, ctx) {
    ctx = ctx || _ocrReviewCtx || {};
    var mode = ctx.mode || 'items';
    var colId = ctx.colId || null;
    var isEvent = !!ctx.isEvent;
    if (!items || !items.length) {
      appToast('Nothing selected to add');
      return;
    }
    if (mode === 'note') {
      var ta = document.querySelector('.list-item.is-expanded .li-detail textarea[data-f="note_text"]') ||
        document.querySelector('.li-detail textarea[data-f="note_text"]');
      if (!ta) {
        appToast('Open an item’s note first');
        return;
      }
      var chunk = items.join('\n');
      var cur = ta.value || '';
      ta.value = cur ? (cur.replace(/\s+$/, '') + '\n' + chunk) : chunk;
      try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (eI) {}
      try {
        var row = ta.closest('.list-item');
        if (row) {
          var id = row.getAttribute('data-item-id');
          var kind = row.getAttribute('data-kind');
          var scope = row.getAttribute('data-scope') || 'free-list';
          var item = findItemFromRow(row);
          if (item) {
            applyNoteFromDetail(item, ta.value);
            persistItemByMeta(kind, scope, id, row);
          }
        }
      } catch (eP) {}
      appToast('Note updated from photo');
      closeOcrReviewModal();
      return;
    }
    var added = 0;
    var list = resolveOcrTargetList();
    var ev = activeEvent();
    items.forEach(function (title) {
      title = autoCap(String(title || '').trim());
      if (!title || title.length < 2) return;
      if (list && colId) {
        if (addItemToListColumn(list, colId, title)) {
          added++;
          try { list = resolveOcrTargetList() || list; } catch (eL2) {}
        }
      } else if (colId && ev) {
        try {
          var bucket = getListBucket(ev, colId, 'group');
          if (bucket) {
            bucket.push(newItem(title));
            added++;
          }
        } catch (eA) {}
      }
    });
    if (list) {
      try { saveNamedList(resolveOcrTargetList() || list); } catch (eS) {}
    } else if (ev && added) {
      try { saveActiveEvent(); } catch (eS2) {}
    }
    try { render(); } catch (eR) {}
    closeOcrReviewModal();
    if (added) {
      appToast('Added ' + added + ' item' + (added === 1 ? '' : 's') + ' from photo', 4000);
    } else if (!list && !ev) {
      appToast('Open a list first, then try the camera again');
    } else {
      appToast('Could not add items — try again on an open list');
    }
  }

  function wireOcrReviewModal() {
    if (document._psOcrReviewWired) return;
    document._psOcrReviewWired = true;
    function bind(id, fn) {
      var el = $(id);
      if (el) el.addEventListener('click', fn);
    }
    bind('ocr-review-cancel', function () {
      clearOcrPhotoDraft();
      closeOcrReviewModal();
    });
    bind('ocr-review-add', function () {
      var selected = collectOcrReviewSelected();
      clearOcrPhotoDraft();
      applyOcrLines(selected, _ocrReviewCtx);
    });
    bind('ocr-review-dictate', function () {
      if (_ocrDictateRec) {
        stopOcrDictate();
        setOcrStatus('Stopped listening — edit lines or tap Add to list');
      } else {
        startOcrDictate();
      }
    });
    bind('ocr-review-retake', function () {
      var ctx = _ocrReviewCtx || {};
      clearOcrPhotoDraft();
      closeOcrReviewModal();
      setTimeout(function () {
        runListPhotoOcr({ mode: ctx.mode || 'items', colId: ctx.colId, isEvent: ctx.isEvent });
      }, 80);
    });
    var modal = $('ocr-review-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          clearOcrPhotoDraft();
          closeOcrReviewModal();
        }
      });
    }
    // Auto-save photo OCR draft if the tab is closed/hidden before Add (#52)
    if (!document._psOcrFlushWired) {
      document._psOcrFlushWired = true;
      window.addEventListener('pagehide', function () { flushOcrReviewOnLeave(); });
      window.addEventListener('beforeunload', function () { flushOcrReviewOnLeave(); });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushOcrReviewOnLeave();
      });
    }
  }

  function resolveOcrTargetList() {
    var list = null;
    try {
      if (state.activeNamedListId) list = findNamedListById(state.activeNamedListId);
    } catch (e0) {}
    if (!list) {
      try {
        var triad = document.getElementById('list-triad');
        if (triad && triad.getAttribute('data-list-id')) {
          list = findNamedListById(triad.getAttribute('data-list-id'));
        }
      } catch (e1) {}
    }
    if (!list) {
      try {
        var open = resolveOpenNamedList(document.getElementById('ev-list') || document.body);
        if (open) list = open;
      } catch (e2) {}
    }
    if (!list) {
      try {
        var ev = activeEvent();
        if (ev) {
          var linked = listsForEvent(ev.id);
          if (linked && linked.length) list = findNamedListById(linked[0].id) || linked[0];
        }
      } catch (e3) {}
    }
    return list || null;
  }

  function runListPhotoOcr(opts) {
    opts = opts || {};
    var mode = opts.mode || 'items'; // items | note
    var colId = opts.colId || null;
    var isEvent = !!opts.isEvent;
    if (mode === 'items' && !colId) {
      appToast('Open a list section first');
      return;
    }
    if (mode === 'items' && !isEvent) {
      var preList = resolveOcrTargetList();
      if (!preList && !activeEvent()) {
        appToast('Open a list first, then use the camera');
        return;
      }
    }
    var inp = ensureOcrFileInput();
    // Avoid stacking handlers if user taps camera twice
    inp.onchange = null;
    inp.onchange = function () {
      var file = inp.files && inp.files[0];
      // Do not clear value until we hold the File (some mobile browsers)
      if (!file) {
        try { inp.value = ''; } catch (eV0) {}
        return;
      }
      appToast('Preparing photo…');
      var held = file;
      try { inp.value = ''; } catch (eV) {}

      fileToOcrJpegDataUrl(held).then(function (urls) {
        var mildUrl = (urls && urls.mild) || (urls && urls.primary) || urls;
        var inkUrl = (urls && urls.ink) || mildUrl;
        if (typeof mildUrl !== 'string') mildUrl = urls && urls.primary;
        var preview = mildUrl;
        appToast('Reading handwriting…');
        wireOcrReviewModal();

        // 1) Primary: xAI vision (actually reads handwriting)
        return ocrViaVisionApi(mildUrl).then(function (j) {
          var items = (j.lines || []).slice(0, 40);
          return {
            items: items,
            engine: j.engine || 'xai',
            previewUrl: preview,
            status: items.length
              ? ('Read ' + items.length + ' item' + (items.length === 1 ? '' : 's') + ' with AI — edit if needed.')
              : 'AI saw no clear items — type or Dictate below.'
          };
        }).catch(function (apiErr) {
          console.warn('Vision OCR', apiErr);
          // 2) Fallback: Tesseract (print only; weak on handwriting)
          setOcrStatus('AI OCR unavailable — trying basic reader…');
          return loadTesseractLib().then(function (T) {
            function ocrOne(dataUrl) {
              if (T.createWorker) {
                return T.createWorker('eng', 1, {
                  workerPath: TESSERACT_CDN + '/worker.min.js',
                  corePath: TESSERACT_CORE_CDN,
                  langPath: TESSERACT_LANG_CDN,
                  logger: function () {}
                }).then(function (worker) {
                  return worker.setParameters({
                    tessedit_pageseg_mode: '6',
                    preserve_interword_spaces: '1'
                  }).then(function () {
                    return worker.recognize(dataUrl).then(function (result) {
                      return worker.terminate().then(function () { return result; }, function () { return result; });
                    });
                  });
                });
              }
              return T.recognize(dataUrl, 'eng', {
                workerPath: TESSERACT_CDN + '/worker.min.js',
                corePath: TESSERACT_CORE_CDN,
                langPath: TESSERACT_LANG_CDN,
                logger: function () {}
              });
            }
            return ocrOne(mildUrl).then(function (r1) {
              var t1 = (r1 && r1.data && r1.data.text) || '';
              var firstItems = splitOcrToListItems(t1);
              if (firstItems.length >= 2) {
                return {
                  items: firstItems,
                  engine: 'tesseract',
                  previewUrl: preview,
                  status: 'Basic OCR (best for print). For handwriting set XAI_API_KEY on Vercel. Edit or Dictate.'
                };
              }
              return ocrOne(inkUrl).then(function (r2) {
                var t2 = (r2 && r2.data && r2.data.text) || '';
                var merged = mergeOcrLineLists(firstItems, splitOcrToListItems(t2));
                return {
                  items: merged,
                  engine: 'tesseract',
                  previewUrl: preview,
                  status: merged.length
                    ? 'Basic OCR result — fix lines or use Dictate (handwriting needs AI key).'
                    : 'Could not read handwriting. Type lines or tap Dictate. (Deploy with XAI_API_KEY for AI read.)'
                };
              });
            });
          }).catch(function () {
            return {
              items: [],
              engine: 'none',
              previewUrl: preview,
              status: 'Could not read photo. Type items or use Dictate.'
            };
          });
        });
      }).then(function (pack) {
        if (!pack) return;
        var items = pack.items || [];
        if (items.length > 20) items = items.slice(0, 20);
        try {
          console.info('[PlanSlayer OCR]', pack.engine, 'lines=', items.length);
        } catch (eLog) {}
        openOcrReviewModal(items, {
          mode: mode,
          colId: colId,
          isEvent: isEvent,
          previewUrl: pack.previewUrl,
          status: pack.status
        });
        if (items.length) {
          appToast('Review ' + items.length + ' line' + (items.length === 1 ? '' : 's'));
        } else {
          appToast('Type or Dictate your list items');
        }
      }).catch(function (err) {
        console.warn('OCR', err);
        var msg = (err && err.message) ? String(err.message) : 'Could not read photo';
        if (/network|load|cdn|Failed to fetch|CORS/i.test(msg)) {
          msg = 'Need network to read photo. Check connection and retry.';
        }
        appToast(msg, 5000);
        // Still open empty review so user can dictate/type
        wireOcrReviewModal();
        openOcrReviewModal([], {
          mode: mode,
          colId: colId,
          isEvent: isEvent,
          status: msg
        });
      });
    };
    try {
      inp.click();
    } catch (eClick) {
      appToast('Camera / file picker not available');
    }
  }

  function wireListColumnUi(list) {
    var root = $('list-triad');
    if (!root || !list) return;
    // Column drag reorder — only the ⋮⋮ handle is draggable (whole-column drag ate Add clicks)
    var dragId = null;
    root.querySelectorAll('.list-col[data-col-kind]').forEach(function (colEl) {
      var handle = colEl.querySelector('[data-col-drag]');
      if (handle) {
        handle.addEventListener('dragstart', function (e) {
          if (!isNamedListOwner(list)) { e.preventDefault(); return; }
          dragId = colEl.getAttribute('data-col-kind');
          try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
          colEl.classList.add('is-dragging-col');
          e.stopPropagation();
        });
        handle.addEventListener('dragend', function () {
          colEl.classList.remove('is-dragging-col');
          dragId = null;
          root.querySelectorAll('.list-col').forEach(function (c) { c.classList.remove('drag-over-col'); });
        });
      }
      colEl.addEventListener('dragover', function (e) {
        if (!dragId) return;
        e.preventDefault();
        colEl.classList.add('drag-over-col');
      });
      colEl.addEventListener('dragleave', function () { colEl.classList.remove('drag-over-col'); });
      colEl.addEventListener('drop', function (e) {
        e.preventDefault();
        colEl.classList.remove('drag-over-col');
        var toId = colEl.getAttribute('data-col-kind');
        var fromId = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        if (!fromId || !toId || fromId === toId) return;
        var live = findNamedListById(list.id);
        if (!live) return;
        reorderListColumn(live, fromId, toId);
        saveNamedList(live);
        render();
      });
    });
  }
  function closeListInviteModal() {
    if ($('list-invite-modal')) {
      $('list-invite-modal').classList.remove('is-open');
      $('list-invite-modal').setAttribute('aria-hidden', 'true');
    }
  }

  function openDatePick(field) {
    state.datePick.field = field; // start | end
    var now = new Date();
    var ev = activeEvent();
    var existing = ev && (field === 'end' ? ev.end_at : ev.start_at);
    if (existing) {
      var d = new Date(existing);
      state.datePick.y = d.getFullYear();
      state.datePick.m = d.getMonth();
      state.datePick.selected = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      if ($('dp-time')) {
        $('dp-time').value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
    } else {
      state.datePick.y = now.getFullYear();
      state.datePick.m = now.getMonth();
      state.datePick.selected = null;
      if ($('dp-time')) $('dp-time').value = field === 'end' ? '17:00' : '09:00';
    }
    if ($('dp-clear')) $('dp-clear').checked = false;
    if ($('date-pick-title')) $('date-pick-title').textContent = field === 'end' ? 'Select end date' : 'Select start date';
    renderDatePickGrid();
    if ($('date-pick-modal')) {
      // Always above Edit event / Create event modals
      $('date-pick-modal').style.zIndex = '31000';
      $('date-pick-modal').classList.add('is-open');
      $('date-pick-modal').setAttribute('aria-hidden', 'false');
    }
  }
  function closeDatePick() {
    if ($('date-pick-modal')) {
      $('date-pick-modal').classList.remove('is-open');
      $('date-pick-modal').setAttribute('aria-hidden', 'true');
    }
    state.datePick.field = null;
  }
  function renderDatePickGrid() {
    var y = state.datePick.y, m = state.datePick.m;
    if ($('dp-label')) {
      $('dp-label').textContent = new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }
    var grid = $('dp-grid');
    if (!grid) return;
    var first = new Date(y, m, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) {
      return '<div class="dow">' + d + '</div>';
    }).join('');
    for (var i = 0; i < startPad; i++) html += '<button type="button" class="cal-day-btn" disabled></button>';
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var sel = state.datePick.selected === iso;
      html += '<button type="button" class="cal-day-btn' + (sel ? ' is-selected' : '') +
        '" data-dp-day="' + iso + '">' + d + '</button>';
    }
    grid.innerHTML = html;
  }

  function applyDatePickSave() {
    var ev = activeEvent();
    if (!ev || !state.datePick.field) return;
    if ($('dp-clear') && $('dp-clear').checked) {
      if (state.datePick.field === 'end') ev.end_at = null;
      else ev.start_at = null;
    } else if (state.datePick.selected) {
      var t = ($('dp-time') && $('dp-time').value) || '09:00';
      var iso = new Date(state.datePick.selected + 'T' + t + ':00').toISOString();
      if (state.datePick.field === 'end') ev.end_at = iso;
      else ev.start_at = iso;
    } else {
      appToast('Pick a day or check Clear date.');
      return;
    }
    if (ev._personalOnly) {
      var board = loadPersonalBoard();
      var idx = (board.events || []).findIndex(function (e) { return String(e.id) === String(ev.id); });
      if (idx >= 0) {
        board.events[idx].start_at = ev.start_at;
        board.events[idx].end_at = ev.end_at;
        savePersonalBoard(board);
      }
    } else {
      saveActiveEvent();
    }
    closeDatePick();
    render();
  }
  function renderCalGrid() {
    var y = state.createCal.y, m = state.createCal.m;
    var label = new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    if ($('cal-label')) $('cal-label').textContent = label;
    var first = new Date(y, m, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) {
      return '<div class="dow">' + d + '</div>';
    }).join('');
    var today = new Date();
    var startIso = state.createCal.selected;
    var endIso = state.createCal.endSelected;
    // Normalize range so start <= end for highlight
    var rangeA = startIso, rangeB = endIso;
    if (rangeA && rangeB && rangeB < rangeA) {
      var tmp = rangeA; rangeA = rangeB; rangeB = tmp;
    }
    for (var i = 0; i < startPad; i++) html += '<button type="button" class="cal-day-btn" disabled></button>';
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isStart = startIso === iso;
      var isEnd = endIso === iso;
      var inRange = !!(rangeA && rangeB && iso >= rangeA && iso <= rangeB);
      var isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
      var cls = 'cal-day-btn';
      if (isStart || isEnd) cls += ' is-selected';
      else if (inRange) cls += ' is-in-range';
      if (isToday) cls += ' is-today';
      html += '<button type="button" class="' + cls + '" data-cal-day="' + iso + '">' + d + '</button>';
    }
    if ($('cal-grid')) $('cal-grid').innerHTML = html;
  }

  function addItemFromInputs() {
    var title = autoCap(($('add-item-input').value || '').trim());
    if (!title) return;
    var qty = Math.max(1, parseInt($('add-item-qty').value, 10) || 1);
    var kind = state.listTab;
    var cur = currentListBucket();
    if (cur.scope === 'group' && cur.ev) {
      getListBucket(cur.ev, kind, 'group').push(newItem(title, { qty: qty }));
      saveActiveEvent();
    } else if (cur.scope === 'free-list' && cur.free && cur.free.named) {
      // Always push into the named list column for current listTab (todo/buy/bring/…)
      if (!addItemToListColumn(cur.free.named, kind, title, { qty: qty })) {
        appToast('Could not add to that section');
        return;
      }
    } else {
      appToast('Open or create a list first');
      return;
    }
    if ($('add-item-input')) $('add-item-input').value = '';
    if ($('add-item-qty')) $('add-item-qty').value = '1';
    if ($('add-suggest')) {
      $('add-suggest').classList.remove('is-open');
      $('add-suggest').innerHTML = '';
    }
    render();
  }

  function applyNoteFromDetail(item, text) {
    text = String(text || '').trim();
    var notes = normalizeNotes(item);
    if (!text) {
      // clear latest note if emptied
      if (notes.length) notes.pop();
      item.notes = '';
      item.notesList = notes;
      return;
    }
    var mineId = myId();
    // edit my most recent note if last note is mine; otherwise append
    var last = notes.length ? notes[notes.length - 1] : null;
    if (last && String(last.by) === String(mineId)) {
      last.text = text;
      last.at = new Date().toISOString();
      last.byName = myName();
    } else {
      notes.push({
        id: uid(),
        text: text,
        by: mineId,
        byName: myName(),
        at: new Date().toISOString()
      });
    }
    item.notesList = notes;
    item.notes = text; // keep legacy field in sync
  }

  /** Snapshot item options when expanding — Cancel restores this. */
  function snapshotItemDetail(item) {
    if (!item) return null;
    var notes = [];
    try { notes = JSON.parse(JSON.stringify(normalizeNotes(item))); } catch (e) {
      notes = (normalizeNotes(item) || []).slice();
    }
    return {
      title: item.title,
      qty: item.qty,
      qualifier: item.qualifier,
      priority: item.priority,
      highlight: !!item.highlight,
      highlight_color: item.highlight_color || 'red',
      creator_only_edit: !!item.creator_only_edit,
      require_all: !!item.require_all,
      due_mode: item.due_mode || 'anytime_before',
      due_days: item.due_days || 0,
      notes: item.notes,
      notesList: notes,
      expense_share_with: (item.expense_share_with || []).slice(),
      expense_amount: item.expense_amount,
      shared_expense: !!item.shared_expense
    };
  }
  function restoreItemDetail(item, snap) {
    if (!item || !snap) return;
    item.title = snap.title;
    item.qty = snap.qty;
    item.qualifier = snap.qualifier;
    item.priority = snap.priority;
    item.highlight = !!snap.highlight;
    item.highlight_color = snap.highlight_color || 'red';
    item.creator_only_edit = !!snap.creator_only_edit;
    item.require_all = !!snap.require_all;
    item.due_mode = snap.due_mode || 'anytime_before';
    item.due_days = snap.due_days || 0;
    item.notes = snap.notes;
    item.notesList = Array.isArray(snap.notesList) ? snap.notesList.slice() : [];
    item.expense_share_with = (snap.expense_share_with || []).slice();
    item.expense_amount = snap.expense_amount;
    item.shared_expense = !!snap.shared_expense;
  }
  /**
   * Read expanded .li-detail fields into item.
   * @returns {'ok'|'add-category'|'locked'}
   */
  function applyItemDetailFromRow(row, item) {
    if (!row || !item) return 'ok';
    var get = function (f) { return row.querySelector('[data-f="' + f + '"]'); };
    var allowSettings = true;
    try { allowSettings = canEditItemSettings(item); } catch (e) { allowSettings = true; }
    if (get('note_text')) applyNoteFromDetail(item, get('note_text').value);
    if (get('expense_amount')) item.expense_amount = Math.max(0, parseFloat(get('expense_amount').value) || 0);
    if (!allowSettings) return 'locked';
    if (get('title')) item.title = autoCap(get('title').value.trim()) || item.title;
    // #94 / #115: never snap qty to 1 on empty/partial spinner values
    if (get('qty')) {
      var qRaw = String(get('qty').value != null ? get('qty').value : '').trim();
      if (qRaw !== '') {
        var qn = parseInt(qRaw, 10);
        if (!isNaN(qn) && qn >= 1) {
          item.qty = qn;
        }
        // invalid partial (e.g. "-") — leave prior item.qty untouched
      }
      // empty while focused: leave prior item.qty (do not force 1)
    }
    if (get('priority')) item.priority = parseInt(get('priority').value, 10) || 0;
    var qVal = get('qualifier') ? get('qualifier').value : (item.qualifier || 'other');
    if (qVal === '__add_category__') return 'add-category';
    var prevQ = item.qualifier || 'other';
    item.qualifier = qVal || 'other';
    if (String(item.qualifier) !== String(prevQ)) {
      try {
        var freeOpenQ = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null;
        var evQ = activeEvent();
        recordCategoryUse(item.qualifier, evQ, freeOpenQ);
        // #92: do NOT auto-switch category filter chips — that hid other items on collapse
      } catch (eCat) {}
    }
    if (get('highlight')) item.highlight = !!get('highlight').checked;
    var hlPick = row.querySelector('[data-f-hl-color].is-on');
    if (hlPick) {
      item.highlight_color = hlPick.getAttribute('data-f-hl-color') || 'red';
    } else if (item.highlight && !item.highlight_color) {
      item.highlight_color = 'red';
    }
    if (!item.highlight && !item.highlight_color) item.highlight_color = 'red';
    if (get('creator_only_edit')) item.creator_only_edit = !!get('creator_only_edit').checked;
    if (get('require_all')) item.require_all = !!get('require_all').checked;
    if (get('due_mode')) item.due_mode = get('due_mode').value;
    if (get('due_days')) item.due_days = Math.max(0, parseInt(get('due_days').value, 10) || 0);
    // Chore schedule → calendar
    // Never wipe an existing chore_at just because hidden fields are empty
    // (that used to clear chores after Choose when if DOM fields were stale).
    try {
      var cDateEl = get('chore_date');
      var cTimeEl = get('chore_time');
      var cEndEl = get('chore_end_time');
      var cColEl = get('chore_color');
      var cShowEl = get('chore_show_on_calendar');
      var cDate = cDateEl ? String(cDateEl.value || '').trim() : '';
      var cTime = cTimeEl ? String(cTimeEl.value || '').trim() : '';
      var cEnd = cEndEl ? String(cEndEl.value || '').trim() : '';
      var cCol = cColEl ? String(cColEl.value || '').trim() : '';
      if (cCol) item.chore_color = cCol;
      if (cShowEl) {
        item.chore_show_on_calendar = cShowEl.type === 'checkbox'
          ? !!cShowEl.checked
          : (cShowEl.value !== '0' && cShowEl.value !== 'false');
      }
      if (cDate) {
        item.chore_at = combineChoreDateTime(cDate, cTime || null);
        if (!cTime) item.chore_at = combineChoreDateTime(cDate, '12:00');
        item.chore_end_at = cEnd ? combineChoreDateTime(cDate, cEnd) : null;
        if (item.chore_show_on_calendar == null) item.chore_show_on_calendar = true;
      }
      // Empty hidden date: leave existing chore_at alone (clear only via Clear chore)
    } catch (eCh) {}
    var shares = [];
    row.querySelectorAll('[data-share-id]').forEach(function (cb) {
      if (cb.checked) shares.push(cb.getAttribute('data-share-id'));
    });
    if (shares.length || row.querySelector('[data-share-id]')) item.expense_share_with = shares;
    if (item.shared_expense && !item.created_by) item.created_by = myId();
    return 'ok';
  }
  /** Persist item after in-place mutation (named list / personal / event). */
  function persistItemByMeta(kind, scope, id, fromEl) {
    scope = scope || 'free-list';
    if (scope === 'personal-board' || scope === 'free-list') {
      var namedList = resolveOpenNamedList(fromEl) || findNamedListById(state.activeNamedListId);
      if (namedList) {
        var hit = resolveNamedListItemHit(namedList, kind, id);
        if (hit) {
          saveNamedListItemHit(hit);
          return true;
        }
      }
      var free = getActiveFreeBucket(kind);
      if (free && free.bucket) {
        var idx = free.bucket.findIndex(function (x) { return String(x.id) === String(id); });
        if (idx >= 0) {
          if (free.named) saveNamedList(free.named);
          else saveFreeListsStore(free.store);
          return true;
        }
      }
      try {
        var board = loadPersonalBoard();
        var arr = board[kind] || [];
        if (arr.some(function (x) { return String(x.id) === String(id); })) {
          savePersonalBoard(board);
          return true;
        }
      } catch (eB) {}
      return false;
    }
    saveActiveEvent();
    return true;
  }
  function findItemFromRow(row) {
    if (!row) return null;
    var id = row.getAttribute('data-item-id');
    var kind = row.getAttribute('data-kind');
    var scope = row.getAttribute('data-scope') || 'free-list';
    if (!id) return null;
    if (scope === 'personal-board' || scope === 'free-list') {
      var namedList = resolveOpenNamedList(row) || findNamedListById(state.activeNamedListId);
      if (namedList) {
        var hit = resolveNamedListItemHit(namedList, kind, id);
        if (hit) {
          return {
            item: hit.item,
            kind: hit.colId || kind,
            scope: scope,
            id: id,
            list: hit.list,
            bucket: hit.bucket,
            isChecklist: !!hit.isChecklist || !!hit.isPrivateOnly
          };
        }
      }
      var free = getActiveFreeBucket(kind);
      if (free && free.bucket) {
        var it = free.bucket.find(function (x) { return String(x.id) === String(id); });
        if (it) return { item: it, kind: kind, scope: scope, id: id, free: free, bucket: free.bucket };
      }
      try {
        var board = loadPersonalBoard();
        var arr = board[kind] || [];
        var it2 = arr.find(function (x) { return String(x.id) === String(id); });
        if (it2) return { item: it2, kind: kind, scope: 'personal-board', id: id, board: board, bucket: arr };
      } catch (e) {}
      return null;
    }
    var ev = activeEvent();
    if (!ev) return null;
    var found = findItem(ev, kind, scope, id);
    if (!found.item) return null;
    return { item: found.item, kind: kind, scope: scope, id: id, bucket: found.bucket, event: ev };
  }
  /**
   * Apply expanded options from DOM and persist (no re-render).
   * @returns {boolean|string} true if saved, false if nothing, 'add-category' if picker needed
   */
  function commitExpandedItemDetail(row) {
    if (!row) return false;
    var meta = findItemFromRow(row);
    if (!meta || !meta.item) return false;
    var result = applyItemDetailFromRow(row, meta.item);
    if (result === 'add-category') return 'add-category';
    persistItemByMeta(meta.kind, meta.scope, meta.id, row);
    return true;
  }
  function clearItemDetailEditState() {
    state.itemDetailSnapshot = null;
    state.itemDetailMeta = null;
  }

  function findItem(ev, kind, scope, id) {
    var bucket = getListBucket(ev, kind, scope);
    return { bucket: bucket, item: bucket.find(function (x) { return x.id === id; }), index: bucket.findIndex(function (x) { return x.id === id; }) };
  }

  function wireOtherWaysToSlay() {
    var btn = $('brand-other-slay-btn');
    var overlay = $('other-slay-overlay');
    var list = $('other-slay-list');
    var cancel = $('other-slay-cancel');
    if (!btn || !overlay || !list || btn._psOtherSlayWired) return;
    btn._psOtherSlayWired = true;
    var ALL = [
      { id: 'hunt', name: 'Hunt Slayer', url: 'https://www.huntslayer.com', blurb: 'Hunt maps, zones & regs' },
      { id: 'reg', name: 'Reg Slayer', url: 'https://www.regslayer.com', blurb: 'Reg-first defaults · same maps' },
      { id: 'plan', name: 'Plan Slayer', url: 'https://www.planslayer.com', blurb: 'Lists, events & packing' }
    ];
    var me = 'plan';
    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    function open() {
      list.innerHTML = ALL.filter(function (s) { return s.id !== me; }).map(function (s) {
        return '<button type="button" class="btn btn-primary" data-slay-go="' + s.url + '" style="width:100%;text-align:left;padding:12px 14px">' +
          '<strong style="display:block;font-size:14px">' + s.name + '</strong>' +
          '<span style="font-size:11px;opacity:0.85;font-weight:600">' + s.blurb + '</span></button>';
      }).join('');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    btn.addEventListener('click', function (ev) { ev.preventDefault(); open(); });
    if (cancel) cancel.addEventListener('click', function (ev) { ev.preventDefault(); close(); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });
    list.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest('[data-slay-go]');
      if (!b) return;
      ev.preventDefault();
      close();
      window.location.href = b.getAttribute('data-slay-go');
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });
  }

  function wireReportIssueUi() {
    var btn = $('brand-report-issue-btn');
    var overlay = $('report-issue-overlay');
    var cancel = $('report-issue-cancel');
    var submit = $('report-issue-submit');
    var msgEl = $('report-issue-msg');
    var titleEl = $('report-issue-title-in');
    var contactEl = $('report-issue-contact');
    var statusEl = $('report-issue-status');
    if (!btn || !overlay || btn._psReportWired) return;
    btn._psReportWired = true;

    function setStatus(text, kind) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.classList.remove('is-err', 'is-ok');
      if (kind === 'err') statusEl.classList.add('is-err');
      if (kind === 'ok') statusEl.classList.add('is-ok');
    }
    function openReport() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      setStatus('');
      try { if (msgEl) msgEl.focus(); } catch (eF) {}
    }
    function closeReport() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      if (submit) submit.disabled = false;
    }
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      openReport();
    });
    if (cancel) cancel.addEventListener('click', function (ev) {
      ev.preventDefault();
      closeReport();
    });
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) closeReport();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && overlay.classList.contains('is-open')) closeReport();
    });
    if (submit) submit.addEventListener('click', function (ev) {
      ev.preventDefault();
      var message = msgEl ? String(msgEl.value || '').trim() : '';
      if (message.length < 8) {
        setStatus('Please write a short description of the issue.', 'err');
        return;
      }
      submit.disabled = true;
      setStatus('Sending…', '');
      var payload = {
        message: message,
        title: titleEl ? String(titleEl.value || '').trim() : '',
        contact: contactEl ? String(contactEl.value || '').trim() : '',
        site: 'plan',
        appVersion: APP_VERSION
      };
      fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        }).catch(function () {
          return { res: res, data: null };
        });
      }).then(function (r) {
        if (r.res.ok && r.data && r.data.ok) {
          var okMsg = 'Thanks — filed on Hunt-Slayer' +
            (r.data.number ? (' (#' + r.data.number + ')') : '') +
            ' · from-planslayer';
          if (r.data.emailSent) okMsg += ' · confirmation emailed';
          else if (r.data.emailNote) okMsg += r.data.emailNote;
          setStatus(okMsg, 'ok');
          if (msgEl) msgEl.value = '';
          if (titleEl) titleEl.value = '';
          setTimeout(closeReport, 2200);
        } else {
          var err = (r.data && r.data.error) ? r.data.error : 'Could not send report. Try again later.';
          // Local static serve has no /api — give a clear hint
          if (r.res.status === 404 || r.res.status === 405) {
            err = 'Report API not available on this host. Deploy to Vercel (with GITHUB_ISSUE_TOKEN) or file on GitHub.';
          } else if (r.res.status === 503 || /GITHUB_ISSUE_TOKEN|not configured/i.test(err)) {
            err = 'Server missing GITHUB_ISSUE_TOKEN. On Vercel → PlanSlayer → Env: add a GitHub PAT with issues:write on Hunt-Slayer, then Redeploy.';
          }
          setStatus(err, 'err');
          submit.disabled = false;
        }
      }).catch(function () {
        setStatus('Network error — check connection and try again.', 'err');
        submit.disabled = false;
      });
    });
  }

  function wireHomescreenUi() {
    var btn = $('brand-homescreen-btn');
    var overlay = $('homescreen-overlay');
    var closeBtn = $('homescreen-close');
    var installBtn = $('homescreen-install');
    var bodyEl = $('homescreen-body');
    var titleEl = $('homescreen-title');
    if (!btn || !overlay || btn._psHomescreenWired) return;
    btn._psHomescreenWired = true;

    var deferredPrompt = null;
    var appName = 'Plan Slayer';

    function isStandalone() {
      try {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.navigator && window.navigator.standalone === true) return true;
      } catch (e) {}
      return false;
    }
    function isIos() {
      var ua = (navigator.userAgent || '');
      return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    function isAndroid() {
      return /Android/i.test(navigator.userAgent || '');
    }
    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    function open() {
      if (titleEl) titleEl.textContent = 'Share to home screen';
      if (installBtn) installBtn.style.display = 'none';
      if (isStandalone()) {
        if (bodyEl) {
          bodyEl.innerHTML = '<strong>' + appName + '</strong> is already running as an installed app on this device. ' +
            'If you do not see the icon, check your home screen folders or app library.';
        }
      } else if (deferredPrompt && installBtn) {
        if (bodyEl) {
          bodyEl.innerHTML = 'Install <strong>' + appName + '</strong> on this device. ' +
            'The home-screen icon uses the official Plan Slayer artwork.';
        }
        installBtn.style.display = '';
        installBtn.textContent = 'Install ' + appName;
      } else if (isIos()) {
        if (bodyEl) {
          bodyEl.innerHTML =
            'On <strong>iPhone / iPad</strong>, Safari cannot add apps automatically. Do this:<br><br>' +
            '1. Tap the <strong>Share</strong> button (square with ↑) at the bottom of Safari<br>' +
            '2. Scroll and tap <strong>Add to Home Screen</strong><br>' +
            '3. Confirm — the icon will show the Plan Slayer logo<br><br>' +
            '<span style="opacity:0.85">Use Safari (not Chrome/in-app browsers) for the best result.</span>';
        }
      } else if (isAndroid()) {
        if (bodyEl) {
          bodyEl.innerHTML =
            'On <strong>Android Chrome</strong>:<br><br>' +
            '1. Tap the browser menu (⋮)<br>' +
            '2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong><br>' +
            '3. Confirm — the icon uses the Plan Slayer logo<br><br>' +
            '<span style="opacity:0.85">If Install is missing, the site may need a moment online, or you already installed it.</span>';
        }
      } else {
        if (bodyEl) {
          bodyEl.innerHTML =
            'On desktop Chrome/Edge: open the address-bar install icon, or use the browser menu → ' +
            '<strong>Install ' + appName + '</strong>.';
        }
      }
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      try { e.preventDefault(); } catch (err) {}
      deferredPrompt = e;
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      appToast('Added to home screen');
      close();
    });

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      open();
    });
    if (installBtn) {
      installBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (!deferredPrompt) { open(); return; }
        var p = deferredPrompt;
        deferredPrompt = null;
        try {
          p.prompt();
          p.userChoice.then(function () { close(); }).catch(function () { close(); });
        } catch (eP) {
          open();
        }
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', function (ev) { ev.preventDefault(); close(); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });

    if (isStandalone()) {
      btn.title = appName + ' is already on your home screen';
      btn.textContent = 'On home screen';
    }
  }

  function wire() {
    function on(id, ev, fn) {
      var el = $(id);
      if (el) el.addEventListener(ev, fn);
    }
    function click(id, fn) { on(id, 'click', fn); }

    wireOtherWaysToSlay();
    wireReportIssueUi();
    wireHomescreenUi();
    try { wireOcrReviewModal(); } catch (eOcrW) {}

    click('btn-create-event', openCreateModal);
    click('add-event-tab-btn', function () {
      if (state.calListMode === 'chores') {
        openScheduleChoreBuilder();
        return;
      }
      openCreateModal();
    });
    click('create-cancel', closeCreateModal);
    // Do NOT close create-event by clicking the overlay — Cancel only
    click('btn-create-list', openListModal);
    click('btn-sync-hunt', function () {
      appToast('Syncing…');
      resyncHuntEventsNow({ quiet: false }).then(function () {
        return loadEvents();
      }).then(function () {
        render();
        if (state.mobileSheetOpen) {
          try { renderMobileListSheet(); } catch (eM) {}
        }
      }).catch(function () {
        appToast('Sync failed — stay logged in on Plan and Hunt');
      });
    });

    // My lists only (events are under the calendar like Hunt)
    document.querySelectorAll('[data-left-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.leftTab = 'lists';
        render();
      });
    });
    click('list-modal-cancel', closeListModal);
    // Do NOT close list modal via overlay either
    click('list-modal-save', function () {
      var name = autoCap(($('list-name') && $('list-name').value || '').trim());
      if (!name) { appToast('Enter a list name'); return; }
      var linkEv = ($('list-link-event') && $('list-link-event').value) || '';
      // Explicit create linked to event — allow packing pack again
      if (linkEv) clearTombstone('eventList', linkEv);
      var store = loadFreeListsStore();
      // Every pack automatically includes To do, To buy, and To bring columns
      // Invite code is generated later when user taps Share list
      var nl = normalizeNamedList({
        id: uid(),
        name: name,
        kind: 'todo',
        items: [],
        buckets: { todo: [], buy: [], bring: [] },
        columnOrder: ['todo', 'buy', 'bring'],
        eventId: linkEv || null,
        owner_id: myId() || 'local',
        creators: [],
        members: [{
          user_id: myId() || 'local',
          display_name: myName(),
          role: 'owner'
        }],
        invite_code: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      store.named.push(nl);
      saveFreeListsStore(store);
      state.activeNamedListId = nl.id;
      state.listTab = 'todo';
      // New personal lists stay on My lists; event-linked can stay on My lists too (Event lists section)
      state.leftTab = 'lists';
      if (nl.eventId) {
        state.activeEventId = String(nl.eventId);
        state.view = 'event';
      } else {
        state.view = 'home';
      }
      closeListModal();
      openNamedListById(nl.id);
      appToast(nl.eventId ? 'List created and linked to event' : 'Personal list created · To do, To buy, To bring ready');
    });
    click('btn-lists-back', function () {
      state.activeNamedListId = null;
      render();
    });
    // Section / item share modal
    click('sec-share-cancel', closeSecShareModal);
    on('sec-share-modal', 'click', function (e) {
      if (e.target === $('sec-share-modal')) closeSecShareModal();
    });
    click('sec-share-copy', function () {
      var text = copySharePayload();
      if (!text) { appToast('Nothing to copy'); return; }
      copyText(text).then(function (ok) {
        appToast(ok ? 'Copied' : 'Could not copy');
        closeSecShareModal();
      });
    });
    on('sec-share-member-search', 'input', function () {
      fillMemberSharePick($('sec-share-member-pick'), this.value);
    });
    on('sec-share-member-pick', 'click', function (e) {
      var b = e.target.closest('[data-share-to-member], [data-share-to-new]');
      if (!b) return;
      var key = b.getAttribute('data-share-to-member') || b.getAttribute('data-share-to-new');
      var list = findNamedListById(_shareCtx.listId);
      var items = [];
      if (_shareCtx.mode === 'item' && _shareCtx.item) {
        items = [_shareCtx.item];
      } else if (list) {
        normalizeNamedList(list);
        var col = getListColumn(list, _shareCtx.colId);
        items = (col && col.items) ? col.items.slice() : [];
      }
      pushItemsToMemberList(key, items, _shareCtx.mode === 'item' ? 'Item' : 'Section');
      closeSecShareModal();
      render();
    });

    // Category pick for item designator chip
    click('item-cat-cancel', closeItemCatModal);
    on('item-cat-modal', 'click', function (e) {
      if (e.target === $('item-cat-modal')) closeItemCatModal();
    });
    on('item-cat-list', 'click', function (e) {
      var b = e.target.closest('[data-pick-cat]');
      if (!b) return;
      applyItemCategory(b.getAttribute('data-pick-cat'));
    });
    click('item-cat-add', function () {
      closeItemCatModal();
      openAddCategoryModal(function (newId) {
        if (newId) applyItemCategory(newId);
      });
    });

    // List members (creator)
    function closeListMembersModal() {
      if ($('list-members-modal')) {
        $('list-members-modal').classList.remove('is-open');
        $('list-members-modal').setAttribute('aria-hidden', 'true');
      }
    }
    click('list-members-close', closeListMembersModal);
    click('list-members-cancel', closeListMembersModal);
    on('list-members-modal', 'click', function (e) {
      if (e.target === $('list-members-modal')) closeListMembersModal();
    });
    click('list-members-invite-code', function () {
      var list = findNamedListById(_shareCtx.listId || state.activeNamedListId);
      if (list) openListInviteModal(list);
    });
    on('list-member-search', 'input', function () {
      fillMemberSharePick($('list-member-add-pick'), this.value);
    });
    on('list-member-add-pick', 'click', function (e) {
      var b = e.target.closest('[data-share-to-member], [data-share-to-new]');
      if (!b) return;
      var list = findNamedListById(_shareCtx.listId || state.activeNamedListId);
      if (!list || !isNamedListOwner(list)) { appToast('Only the list creator can add members'); return; }
      var isNew = !!b.getAttribute('data-share-to-new');
      var key = b.getAttribute('data-share-to-member') || b.getAttribute('data-share-to-new');
      addListMemberFromPick(list, key, isNew);
      if ($('list-member-search')) $('list-member-search').value = '';
    });

    // Claim provisional member name
    on('claim-member-list', 'click', function (e) {
      if (e.target && e.target.id === 'claim-none-of-these') {
        if ($('claim-member-modal')) {
          $('claim-member-modal').classList.remove('is-open');
          $('claim-member-modal').setAttribute('aria-hidden', 'true');
        }
        return;
      }
      var b = e.target.closest('[data-claim-member]');
      if (!b) return;
      var list = findNamedListById(state.activeNamedListId);
      if (!list) return;
      normalizeNamedList(list);
      var mid = b.getAttribute('data-claim-member');
      var m = (list.members || []).find(function (x) { return String(x.user_id) === String(mid); });
      if (m) {
        m.claimed_by = myId() || 'local';
        m.provisional = false;
        m.user_id = myId() || m.user_id;
        m.display_name = myName() || m.display_name;
        m.username = (state.profile && state.profile.username) || m.username || '';
        saveNamedList(list);
        rememberFriend({ user_id: myId(), display_name: myName(), username: m.username });
        appToast('You’re on the list as ' + (m.display_name || 'member'));
      }
      if ($('claim-member-modal')) {
        $('claim-member-modal').classList.remove('is-open');
        $('claim-member-modal').setAttribute('aria-hidden', 'true');
      }
      render();
    });

    click('btn-list-invite', function () {
      var list = findNamedListById(state.activeNamedListId);
      if (!list) return;
      if (isNamedListOwner(list)) openListMembersModal(list);
      else openListInviteModal(list);
    });
    click('list-invite-done', closeListInviteModal);
    click('list-invite-copy', function () {
      var code = ($('list-invite-code-input') && $('list-invite-code-input').value) || '';
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { appToast('Invite code copied'); })
          .catch(function () { appToast(code); });
      } else {
        appToast(code);
      }
    });

    // TBD date pickers
    click('ev-start-tbd', function () { openDatePick('start'); });
    click('ev-end-tbd', function () { openDatePick('end'); });
    click('edit-ev-start-btn', function () { openDatePick('start'); });
    click('edit-ev-end-btn', function () { openDatePick('end'); });
    click('dp-cancel', closeDatePick);
    click('dp-save', applyDatePickSave);
    click('dp-prev', function () {
      state.datePick.m--;
      if (state.datePick.m < 0) { state.datePick.m = 11; state.datePick.y--; }
      renderDatePickGrid();
    });
    click('dp-next', function () {
      state.datePick.m++;
      if (state.datePick.m > 11) { state.datePick.m = 0; state.datePick.y++; }
      renderDatePickGrid();
    });
    on('dp-grid', 'click', function (e) {
      var b = e.target.closest('[data-dp-day]');
      if (!b) return;
      state.datePick.selected = b.getAttribute('data-dp-day');
      renderDatePickGrid();
    });

    click('ev-edit', function () {
      var ev = activeEvent();
      if (ev) openEditEventModal(ev);
    });
    click('edit-ev-cancel', function () {
      if ($('edit-event-modal')) {
        $('edit-event-modal').classList.remove('is-open');
        $('edit-event-modal').setAttribute('aria-hidden', 'true');
      }
    });
    click('edit-ev-delete', function () {
      // Close edit modal first so the confirm dialog is visible (no Save needed)
      if ($('edit-event-modal')) {
        $('edit-event-modal').classList.remove('is-open');
        $('edit-event-modal').setAttribute('aria-hidden', 'true');
      }
      deleteActiveEvent();
    });
    click('edit-list-cancel', closeEditListModal);
    click('edit-list-share', function () {
      var list = findNamedListById(state.activeNamedListId) || resolveOpenNamedList(null);
      // Prefer list being edited if id is on modal context
      if (!list && state.activeNamedListId) list = findNamedListById(state.activeNamedListId);
      if (!list) { appToast('No list to share'); return; }
      // Close edit first so share sits on top
      try { closeEditListModal(); } catch (e) {}
      openSharePeopleChooser('list', list.id);
    });
    click('edit-ev-share', function () {
      var ev = activeEvent();
      if (!ev && state.activeEventId) ev = findEventById(state.activeEventId);
      if (!ev) { appToast('No event to share'); return; }
      try {
        if ($('edit-event-modal')) {
          $('edit-event-modal').classList.remove('is-open');
          $('edit-event-modal').setAttribute('aria-hidden', 'true');
        }
      } catch (e) {}
      openSharePeopleChooser('event', ev.id);
    });
    click('edit-list-add-people', function () {
      var list = findNamedListById(state.activeNamedListId);
      if (!list) return;
      openSharePeopleChooser('list', list.id);
    });
    click('edit-ev-add-people', function () {
      var ev = activeEvent();
      if (!ev) return;
      openSharePeopleChooser('event', ev.id);
    });
    // Edit modal: remove member (in-place confirm) + merge
    on('edit-ev-members-list', 'click', function (e) {
      var yes = e.target.closest && e.target.closest('[data-emc-yes]');
      if (yes) {
        e.preventDefault();
        removeEventMemberNow(yes.getAttribute('data-emc-yes'));
        state._editRmConfirm = null;
        fillEditEventMembersPanel();
        return;
      }
      if (e.target.closest && e.target.closest('[data-emc-no]')) {
        state._editRmConfirm = null;
        fillEditEventMembersPanel();
        return;
      }
      var rm = e.target.closest && e.target.closest('[data-edit-rm-mem]');
      if (rm) {
        e.preventDefault();
        state._editRmConfirm = { scope: 'event', id: rm.getAttribute('data-edit-rm-mem') };
        fillEditEventMembersPanel();
      }
    });
    on('edit-list-members-list', 'click', function (e) {
      var yes = e.target.closest && e.target.closest('[data-emc-yes]');
      if (yes) {
        e.preventDefault();
        var lid = yes.getAttribute('data-emc-list');
        removeListMemberNow(findNamedListById(lid), yes.getAttribute('data-emc-yes'));
        state._editRmConfirm = null;
        fillEditListMembersPanel(findNamedListById(lid));
        return;
      }
      if (e.target.closest && e.target.closest('[data-emc-no]')) {
        state._editRmConfirm = null;
        fillEditListMembersPanel(findNamedListById(state.activeNamedListId));
        return;
      }
      var rm = e.target.closest && e.target.closest('[data-edit-rm-mem]');
      if (rm) {
        e.preventDefault();
        state._editRmConfirm = { scope: 'list', id: rm.getAttribute('data-edit-rm-mem') };
        fillEditListMembersPanel(findNamedListById(rm.getAttribute('data-edit-rm-list') || state.activeNamedListId));
      }
    });
    click('edit-ev-merge-go', function () {
      var keep = $('edit-ev-merge-keep') && $('edit-ev-merge-keep').value;
      var drop = $('edit-ev-merge-drop') && $('edit-ev-merge-drop').value;
      mergeMembers(keep, drop, 'event', null);
    });
    click('edit-list-merge-go', function () {
      var keep = $('edit-list-merge-keep') && $('edit-list-merge-keep').value;
      var drop = $('edit-list-merge-drop') && $('edit-list-merge-drop').value;
      mergeMembers(keep, drop, 'list', state.activeNamedListId);
    });
    function toggleMergeBox(boxId, btnId) {
      var box = $(boxId);
      var btn = $(btnId);
      if (!box) return;
      var open = box.classList.contains('is-collapsed');
      box.classList.toggle('is-collapsed', !open);
      if (btn) btn.textContent = open ? 'Hide merge' : 'Merge members';
    }
    click('edit-ev-merge-toggle', function () { toggleMergeBox('edit-ev-merge-box', 'edit-ev-merge-toggle'); });
    click('edit-list-merge-toggle', function () { toggleMergeBox('edit-list-merge-box', 'edit-list-merge-toggle'); });
    // Events / Chores switch (buttons re-order; use delegation)
    on('plan-cal-events-header', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-cal-mode]');
      if (!b) return;
      var mode = b.getAttribute('data-cal-mode');
      if (mode !== 'events' && mode !== 'chores') return;
      state.calListMode = mode;
      renderSideCalendar();
      renderCalendarEventsList();
    });
    // Chore options — single screen: day + start/end + Save/Cancel (Clear only when editing)
    click('chore-when-cancel', closeChoreWhenPicker);
    on('chore-when-modal', 'click', function (e) {
      if (e.target === $('chore-when-modal')) closeChoreWhenPicker();
    });
    click('chore-when-prev', function () {
      state.choreWhen.m--;
      if (state.choreWhen.m < 0) { state.choreWhen.m = 11; state.choreWhen.y--; }
      renderChoreWhenGrid();
    });
    click('chore-when-next', function () {
      state.choreWhen.m++;
      if (state.choreWhen.m > 11) { state.choreWhen.m = 0; state.choreWhen.y++; }
      renderChoreWhenGrid();
    });
    on('chore-when-grid', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-chore-day]');
      if (!b) return;
      state.choreWhen.date = b.getAttribute('data-chore-day');
      renderChoreWhenGrid();
      syncChoreWhenSaveEnabled();
    });
    on('chore-when-start', 'input', function () {
      if (state.choreWhen) state.choreWhen.start = this.value || '';
      updateChoreWhenSummary();
    });
    on('chore-when-end', 'input', function () {
      if (state.choreWhen) state.choreWhen.end = this.value || '';
      updateChoreWhenSummary();
    });
    function finishChoreWhenSave(clear) {
      if (saveChoreFromModal(!!clear)) {
        closeChoreWhenPicker();
        if (!clear) {
          state.calListMode = 'chores';
          state.sideCal.selectedDay = null;
        }
        appToast(clear ? 'Chore deleted' : 'Chore saved');
        render();
      } else if (!clear) {
        // saveChoreFromModal already toasts specific errors
      } else {
        appToast('Could not delete chore');
      }
    }
    click('chore-when-save', function () {
      finishChoreWhenSave(false);
    });
    click('chore-when-clear', function () {
      // Only available when editing an existing chore (Chores list / re-edit)
      if (!(state.choreWhen && state.choreWhen.hasExistingSchedule)) return;
      finishChoreWhenSave(true);
    });
    on('chore-when-colors', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-chore-when-color]');
      if (!b) return;
      state.choreWhen.color = b.getAttribute('data-chore-when-color') || DEFAULT_CHORE_COLOR;
      renderChoreColorPickers(state.choreWhen.color);
    });
    on('edit-list-chore-colors', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-list-chore-color]');
      if (!b) return;
      var c = b.getAttribute('data-list-chore-color') || DEFAULT_CHORE_COLOR;
      if ($('edit-list-chore-color')) $('edit-list-chore-color').value = c;
      if ($('edit-list-chore-colors')) {
        $('edit-list-chore-colors').innerHTML = choreColorSwatchesHtml(c, 'data-list-chore-color');
      }
    });
    // Item detail: pick chore color without full re-render
    document.body.addEventListener('click', function (e) {
      var sw = e.target.closest && e.target.closest('[data-item-chore-color]');
      if (!sw) return;
      var row = sw.closest('.list-item');
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      var color = sw.getAttribute('data-item-chore-color') || DEFAULT_CHORE_COLOR;
      var hid = row.querySelector('[data-f="chore_color"]');
      if (hid) hid.value = color;
      var wrap = row.querySelector('[data-item-chore-colors]');
      if (wrap) wrap.innerHTML = choreColorSwatchesHtml(color, 'data-item-chore-color');
      // Persist on live item if possible
      try {
        var id = row.getAttribute('data-item-id');
        var kind = row.getAttribute('data-kind');
        var scope = row.getAttribute('data-scope') || 'free-list';
        var found = findItemAny(kind, scope, id);
        if (found && found.item) {
          found.item.chore_color = color;
          if (found.list) saveNamedList(found.list);
          else if (scope === 'group') saveActiveEvent();
          try { renderSideCalendar(); renderCalendarEventsList(); } catch (eCal) {}
        }
      } catch (eS) {}
    }, true);
    // Item detail: Show on calendar checkbox — persist immediately
    document.body.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.getAttribute('data-f') !== 'chore_show_on_calendar') return;
      var row = t.closest && t.closest('.list-item');
      if (!row) return;
      try {
        var id = row.getAttribute('data-item-id');
        var kind = row.getAttribute('data-kind');
        var scope = row.getAttribute('data-scope') || 'free-list';
        var found = findItemAny(kind, scope, id);
        if (found && found.item) {
          found.item.chore_show_on_calendar = !!t.checked;
          if (found.list) saveNamedList(found.list);
          else if (scope === 'group') saveActiveEvent();
          else persistItemByMeta(kind, scope, id, row);
          try { renderSideCalendar(); renderCalendarEventsList(); } catch (eCal2) {}
          appToast(t.checked ? 'Chore shows on calendar' : 'Chore hidden from calendar');
        }
      } catch (eShow) {}
    }, true);
    click('share-people-chooser-cancel', closeSharePeopleChooser);
    on('share-people-chooser', 'click', function (e) {
      if (e.target === $('share-people-chooser')) closeSharePeopleChooser();
    });
    click('share-people-copy', function () {
      copyShareCodeForCtx();
      closeSharePeopleChooser();
    });
    click('share-people-add', function () {
      openSharePeopleMembers();
    });
    click('share-people-members-cancel', function () {
      closeSharePeopleMembers(false);
    });
    click('share-people-members-add', function () {
      commitSharePeopleSelected();
      closeSharePeopleMembers(false);
    });
    on('share-people-members', 'click', function (e) {
      // Tap outside the card = add selected + close
      if (e.target === $('share-people-members')) {
        if (_sharePeopleSelected.length) commitSharePeopleSelected();
        closeSharePeopleMembers(false);
      }
    });
    on('share-people-search', 'input', function () {
      fillSharePeoplePick(this.value);
    });
    // pointerup for mobile reliability; suppress the ghost click that would toggle twice
    var _sharePickArmed = false;
    function onSharePersonPick(e) {
      var b = e.target && e.target.closest && e.target.closest('[data-share-person]');
      if (!b) return;
      if (e.type === 'click' && _sharePickArmed) {
        _sharePickArmed = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.type === 'pointerup') {
        // Only primary button / touch
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        _sharePickArmed = true;
        setTimeout(function () { _sharePickArmed = false; }, 400);
      }
      e.preventDefault();
      e.stopPropagation();
      toggleSharePerson(b.getAttribute('data-share-person'), b.getAttribute('data-share-person-name'));
    }
    on('share-people-pick', 'click', onSharePersonPick);
    on('share-people-pick', 'pointerup', onSharePersonPick);
    click('edit-list-save', function () {
      var list = findNamedListById(state.activeNamedListId);
      if (!list) { closeEditListModal(); return; }
      var name = autoCap(($('edit-list-name') && $('edit-list-name').value || '').trim());
      if (!name) { appToast('Enter a list name'); return; }
      list.name = name;
      var linkEv = ($('edit-list-link-event') && $('edit-list-link-event').value) || '';
      list.eventId = linkEv || null;
      // Explicit true only when creator checks the box (#59)
      list.showExpense = !!( $('edit-list-show-expense') && $('edit-list-show-expense').checked );
      list.choreColor = ($('edit-list-chore-color') && $('edit-list-chore-color').value) || DEFAULT_CHORE_COLOR;
      // Explicit re-link means user wants a pack for this event again
      if (linkEv) {
        clearTombstone('eventList', linkEv);
        clearTombstone('list', list.id);
      }
      saveNamedList(list);
      closeEditListModal();
      appToast('List saved');
      openNamedListById(list.id);
    });
    // Delete list: immediate confirm — no Save required; stay deleted (no event pack recreate)
    click('edit-list-delete', async function () {
      var list = findNamedListById(state.activeNamedListId);
      if (!list) { closeEditListModal(); return; }
      var linkedNote = list.eventId
        ? ' It will not come back when the linked event reloads.'
        : '';
      var ok = await appConfirm(
        'Delete list “' + (list.name || 'List') + '”? This cannot be undone.' + linkedNote,
        'Delete list'
      );
      if (!ok) return;
      var lid = String(list.id);
      var eid = list.eventId ? String(list.eventId) : null;
      permanentlyDeleteNamedList(list, { stripEventPacks: true });
      if (String(state.activeNamedListId) === lid) {
        state.activeNamedListId = null;
        state.mobileSheetOpen = false;
        setRightPanelMode('empty');
      }
      closeEditListModal();
      broadcastSync({ type: 'delete-list', id: lid, eventId: eid });
      appToast('List deleted');
      render();
      closeMobileListSheet(true);
    });
    // User settings (click username)
    click('user-chip-btn', function () { openUserSettingsModal(); });
    // Close OR Save (same button — turns into Save after a color pick)
    click('user-settings-cancel', function () {
      var btn = $('user-settings-cancel');
      if (btn && btn.getAttribute('data-mode') === 'save') {
        saveUserSettingsFromModal();
        return;
      }
      closeUserSettingsModal();
    });
    on('user-settings-modal', 'click', function (e) {
      if (e.target === $('user-settings-modal')) closeUserSettingsModal();
    });
    // Nickname edits also enable Save (same Close→Save control)
    on('user-settings-nick', 'input', function () {
      _userSettingsDirty = true;
      syncUserSettingsCloseSaveBtn();
    });
    // My Color — regular palette; apply only on Save
    click('user-color-open', function () {
      var panel = $('user-color-panel');
      if (!panel) return;
      var open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : '';
      if (!open) renderMyColorPicker(_userSettingsPendingColor || myColor());
    });
    on('user-color-swatches', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-my-color]');
      if (!b) return;
      setUserSettingsPendingColor(b.getAttribute('data-my-color'));
    });
    click('user-color-wheel-btn', function () {
      var w = $('user-color-wheel');
      if (w) try { w.click(); } catch (e) {}
    });
    on('user-color-wheel', 'input', function () {
      setUserSettingsPendingColor(this.value);
    });
    on('user-color-wheel', 'change', function () {
      setUserSettingsPendingColor(this.value);
    });
    click('user-settings-signout', function () {
      closeUserSettingsModal();
      var so = window.PlanSlayerAuth && window.PlanSlayerAuth.signOut;
      var confirmFn = window.PlanSlayerApp && window.PlanSlayerApp.confirm;
      if (typeof confirmFn === 'function') {
        confirmFn('Sign out on this device?', 'Sign out').then(function (ok) {
          if (ok && so) so().catch(function () {});
        });
      } else if (so) {
        so().catch(function () {});
      }
    });
    // Delegate modal
    click('delegate-cancel', closeDelegateModal);
    on('delegate-modal', 'click', function (e) {
      if (e.target === $('delegate-modal')) closeDelegateModal();
    });
    on('delegate-member-list', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-delegate-to]');
      if (!b) return;
      applyDelegateToMember(b.getAttribute('data-delegate-to'), b.getAttribute('data-delegate-name'));
    });
    click('edit-ev-save', function () {
      var ev = activeEvent();
      if (!ev) return;
      if ($('edit-ev-name')) ev.name = autoCap(($('edit-ev-name').value || '').trim()) || ev.name;
      if ($('edit-ev-type')) ev.event_type = ($('edit-ev-type').value || '').trim() || ev.event_type;
      if (!ev.state) ev.state = {};
      // Explicit true only when creator checks the box (#59)
      ev.state.showExpense = !!( $('edit-ev-show-expense') && $('edit-ev-show-expense').checked );
      // Mirror onto linked packing list so $ button matches
      try {
        var linkedEx = listsForEvent(ev.id);
        if (linkedEx[0]) {
          linkedEx[0].showExpense = ev.state.showExpense;
          saveNamedList(linkedEx[0]);
        }
      } catch (eL) {}
      if (ev._personalOnly) {
        var board = loadPersonalBoard();
        var idx = (board.events || []).findIndex(function (e) { return String(e.id) === String(ev.id); });
        if (idx >= 0) {
          board.events[idx].name = ev.name;
          board.events[idx].event_type = ev.event_type;
          board.events[idx].start_at = ev.start_at;
          board.events[idx].end_at = ev.end_at;
          board.events[idx].state = board.events[idx].state || {};
          board.events[idx].state.showExpense = ev.state.showExpense;
          savePersonalBoard(board);
        }
      } else {
        saveActiveEvent();
      }
      if ($('edit-event-modal')) {
        $('edit-event-modal').classList.remove('is-open');
        $('edit-event-modal').setAttribute('aria-hidden', 'true');
      }
      render();
    });

    on('named-list-tabs', 'click', function (e) {
      var b = e.target.closest('[data-named-list]');
      if (!b) return;
      var id = b.getAttribute('data-named-list');
      state.activeNamedListId = state.activeNamedListId === id ? null : id;
      render();
    });
    /**
     * Column head actions (Settings ⚙ / Share / Minimize / Restore / Rename).
     * Must work for desktop #ev-list AND mobile #mobile-list-sheet / #mls-body.
     * Returns true if handled.
     */
    function handleListColHeadAction(e) {
      var t = e.target;
      if (!t || !t.closest) return false;
      // Only inside a list triad host
      var inList = t.closest('#ev-list, #lists-active, #mobile-list-sheet, #mls-body, .list-triad');
      if (!inList) return false;
      var list = resolveOpenNamedList(t);
      if (!list) {
        // Mobile sheet always has an active list id when open
        try {
          if (state.activeNamedListId) list = findNamedListById(state.activeNamedListId);
        } catch (eL) {}
      }
      // Minimize
      var mini = t.closest('[data-col-minimize]');
      if (mini) {
        if (!list) return true;
        e.preventDefault(); e.stopPropagation();
        var liveMini = findNamedListById(list.id) || list;
        var mc = getListColumn(liveMini, mini.getAttribute('data-col-minimize'));
        if (mc) {
          mc.minimized = true;
          saveNamedList(liveMini);
          render();
          if (state.mobileSheetOpen) {
            try { renderMobileListSheet(); } catch (eM) {}
          }
        }
        return true;
      }
      // Restore minimized column
      var restore = t.closest('[data-col-restore]');
      if (restore) {
        if (!list) return true;
        e.preventDefault(); e.stopPropagation();
        var liveRest = findNamedListById(list.id) || list;
        var rc = getListColumn(liveRest, restore.getAttribute('data-col-restore'));
        if (rc) {
          rc.minimized = false;
          saveNamedList(liveRest);
          render();
          if (state.mobileSheetOpen) {
            try { renderMobileListSheet(); } catch (eM2) {}
          }
        }
        return true;
      }
      // Settings / options
      var opt = t.closest('[data-col-options]');
      if (opt) {
        if (!list) { appToast('Open a list first'); return true; }
        e.preventDefault(); e.stopPropagation();
        openColOptionsModal(list, opt.getAttribute('data-col-options'));
        return true;
      }
      // Share this section
      var sh = t.closest('[data-col-share]');
      if (sh) {
        if (!list) { appToast('Open a list first'); return true; }
        e.preventDefault(); e.stopPropagation();
        var sc = getListColumn(list, sh.getAttribute('data-col-share'));
        if (sc) openSectionShareModal(list, sc);
        return true;
      }
      // Rename section title (creator)
      var ren = t.closest('[data-col-rename]');
      if (ren && list && isNamedListOwner(list)) {
        e.preventDefault(); e.stopPropagation();
        var rid = ren.getAttribute('data-col-rename');
        var liveRen = findNamedListById(list.id) || list;
        var rcol = getListColumn(liveRen, rid);
        if (!rcol) return true;
        appPrompt('Rename this section', rcol.name || 'New list', 'Rename').then(function (name) {
          if (!name) return;
          rcol.name = autoCap(String(name).trim()) || rcol.name;
          saveNamedList(liveRen);
          render();
          if (state.mobileSheetOpen) {
            try { renderMobileListSheet(); } catch (eM3) {}
          }
        });
        return true;
      }
      return false;
    }

    // Capture-phase so mobile sheet never loses ⚙ / Share / Minimize taps
    if (!document._psColHeadWired) {
      document._psColHeadWired = true;
      document.addEventListener('click', function (e) {
        try {
          if (handleListColHeadAction(e)) return;
        } catch (eH) { console.warn('list col head', eH); }
      }, true);
    }

    // RIGHT panel: per-column list pack controls
    on('ev-list', 'click', function (e) {
      var list = resolveOpenNamedList(e.target);

      // Column head actions handled by document capture (mobile + desktop)
      if (e.target && e.target.closest &&
          e.target.closest('[data-col-minimize],[data-col-restore],[data-col-options],[data-col-share],[data-col-rename]')) {
        return;
      }

      // Click empty area of a column body → focus that column’s add input
      var focusBody = e.target.closest && e.target.closest('[data-col-focus-add]');
      if (focusBody && !e.target.closest('.list-item, button, a, input, select, textarea, label')) {
        var fid = focusBody.getAttribute('data-col-focus-add');
        var finp = focusBody.parentElement && focusBody.parentElement.querySelector('[data-col-add-input="' + fid + '"], [data-event-col-add-input="' + fid + '"]');
        if (!finp && $('ev-list')) {
          finp = $('ev-list').querySelector('[data-col-add-input="' + fid + '"], [data-event-col-add-input="' + fid + '"]');
        }
        if (finp) {
          e.preventDefault();
          try { finp.focus(); finp.select && finp.select(); } catch (eF) {}
          return;
        }
      }

      // Photo OCR → list items / note (#35)
      var ocrList = e.target.closest && e.target.closest('[data-ocr-list]');
      if (ocrList) {
        e.preventDefault(); e.stopPropagation();
        runListPhotoOcr({
          mode: 'items',
          colId: ocrList.getAttribute('data-ocr-list'),
          isEvent: ocrList.getAttribute('data-ocr-event') === '1'
        });
        return;
      }
      var ocrNote = e.target.closest && e.target.closest('[data-ocr-note]');
      if (ocrNote) {
        e.preventDefault(); e.stopPropagation();
        runListPhotoOcr({ mode: 'note' });
        return;
      }
      // Add item (button) — shared submit path
      var addBtn = e.target.closest && e.target.closest('[data-col-add], [data-event-col-add]');
      if (addBtn) {
        e.preventDefault(); e.stopPropagation();
        submitColumnAddFromUi(addBtn);
        return;
      }
      // (Add section is handled on #qualifier-filters — far-left chip)
      var openL = e.target.closest && e.target.closest('[data-open-list]');
      if (openL) {
        state.activeNamedListId = openL.getAttribute('data-open-list');
        state.activeEventId = null;
        state.view = 'home';
        var nl0 = findNamedListById(state.activeNamedListId);
        if (nl0) {
          normalizeNamedList(nl0);
          state.listTab = (nl0.columns[0] && nl0.columns[0].id) || 'todo';
        }
        render();
      }
    });
    on('ev-list', 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      var inp = e.target.closest && e.target.closest('[data-col-add-input], [data-event-col-add-input]');
      if (!inp) return;
      e.preventDefault();
      e.stopPropagation();
      submitColumnAddFromUi(inp);
    });

    // Document-level capture: never miss Enter/Add even if #ev-list re-renders oddly
    if (!document._psColAddWired) {
      document._psColAddWired = true;
      document.addEventListener('click', function (e) {
        var ocrBtn = e.target && e.target.closest && e.target.closest('[data-ocr-list], [data-ocr-note]');
        if (ocrBtn) {
          if (!ocrBtn.closest('#ev-list') && !ocrBtn.closest('#lists-active') && !ocrBtn.closest('#mobile-list-sheet') &&
              !ocrBtn.closest('.li-detail')) return;
          e.preventDefault();
          e.stopPropagation();
          if (ocrBtn.getAttribute('data-ocr-note')) {
            runListPhotoOcr({ mode: 'note' });
          } else {
            runListPhotoOcr({
              mode: 'items',
              colId: ocrBtn.getAttribute('data-ocr-list'),
              isEvent: ocrBtn.getAttribute('data-ocr-event') === '1'
            });
          }
          return;
        }
        var addBtn = e.target && e.target.closest && e.target.closest('[data-col-add], [data-event-col-add]');
        if (!addBtn) return;
        if (!addBtn.closest('#ev-list') && !addBtn.closest('#lists-active') && !addBtn.closest('#mobile-list-sheet')) return;
        e.preventDefault();
        e.stopPropagation();
        submitColumnAddFromUi(addBtn);
      }, true);
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var inp = e.target && e.target.closest && e.target.closest('[data-col-add-input], [data-event-col-add-input]');
        if (!inp) return;
        if (!inp.closest('#ev-list') && !inp.closest('#lists-active') && !inp.closest('#mobile-list-sheet')) return;
        e.preventDefault();
        e.stopPropagation();
        submitColumnAddFromUi(inp);
      }, true);
      // Collapse expanded item when clicking outside its options — click-away SAVES changes
      // (must not run on the same click that opens expand — re-render detaches e.target)
      document.addEventListener('click', function (e) {
        if (!state.expandedItemId) return;
        if (state._skipExpandCollapseOnce) {
          state._skipExpandCollapseOnce = false;
          return;
        }
        if (e.target.closest && e.target.closest('.modal-overlay.is-open, .modal-overlay[aria-hidden="false"]')) return;
        // Clicks on any list item are owned by the item handler (toggle expand / cancel / etc.)
        if (e.target.closest && e.target.closest('.list-item')) return;
        // Don't collapse when using add inputs / filters
        if (e.target.closest && e.target.closest('.list-col-add, #qualifier-filters, .list-col-head')) return;
        // Auto-save detail before closing
        var expandedRow = document.querySelector('.list-item.is-expanded');
        if (expandedRow) {
          try { commitExpandedItemDetail(expandedRow); } catch (eSave) {}
        }
        state.expandedItemId = null;
        state.noteItemId = null;
        clearItemDetailEditState();
        render();
      }, false);
      // Click away from an open event/list card → collapse members names drawer
      document.addEventListener('click', function (e) {
        if (state._skipMembersCollapseOnce) {
          state._skipMembersCollapseOnce = false;
          return;
        }
        if (state.membersDrawerKey === '') return;
        if (!state.activeEventId && !state.activeNamedListId) return;
        // Never steal focus from member typeahead / pick list
        if (e.target.closest && e.target.closest(
          '.event-card-wrap.is-active, .member-pop, .modal-overlay.is-open, [data-member-chip], [data-inline-add-toggle],' +
          '.inline-members-block, .inline-add-members-form, .inline-member-search, .inline-member-pick,' +
          '#edit-event-modal, #edit-list-modal, #share-people-chooser, #share-people-members,' +
          '.share-person-btn, [data-share-to-member], [data-share-to-new]'
        )) return;
        // If add-members form is open, only collapse when clicking well outside the card
        if (state.membersAddOpenKey) return;
        state.membersDrawerKey = '';
        state.membersAddOpenKey = null;
        render();
      }, false);
      // Paste shared item into a column add box
      document.addEventListener('paste', function (e) {
        var inp = e.target && e.target.closest && e.target.closest('[data-col-add-input], [data-event-col-add-input]');
        if (!inp) return;
        var clip = '';
        try {
          clip = (e.clipboardData && e.clipboardData.getData('text')) || '';
        } catch (eC) { clip = ''; }
        if (!clip || clip.indexOf('[[PSITEM]]') !== 0) return;
        e.preventDefault();
        inp.value = clip;
        submitColumnAddFromUi(inp);
      }, true);
      // Live auto-save when changing options inside an expanded item (no Save required)
      document.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var detail = t.closest('.li-detail');
        if (!detail) return;
        var rowCh = detail.closest('.list-item.is-expanded');
        if (!rowCh) return;
        if (!t.matches || !t.matches('[data-f], [data-share-id]')) return;
        // #102: qty commits on blur only (avoid spinner intermediate → 1)
        if (t.getAttribute('data-f') === 'qty') return;
        // __add_category__ opens a modal — don't commit yet
        if (t.getAttribute('data-f') === 'qualifier' && t.value === '__add_category__') {
          var metaAdd = findItemFromRow(rowCh);
          if (metaAdd && metaAdd.item) {
            openAddCategoryModal(function (newId) {
              if (newId) {
                metaAdd.item.qualifier = newId;
                try {
                  var freeOpenA = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null;
                  recordCategoryUse(newId, activeEvent(), freeOpenA);
                  // #92: do not auto-filter list to this category
                } catch (eRa) {}
                persistItemByMeta(metaAdd.kind, metaAdd.scope, metaAdd.id, rowCh);
              }
              render();
            });
          }
          return;
        }
        try { commitExpandedItemDetail(rowCh); } catch (eC) {}
        // Live highlight preview
        if (t.getAttribute('data-f') === 'highlight') {
          var pick = rowCh.querySelector('[data-hl-color-pick]');
          if (pick) pick.classList.toggle('is-open', !!t.checked);
          rowCh.classList.remove('is-highlight', 'hl-red', 'hl-yellow', 'hl-green');
          if (t.checked) {
            var on = rowCh.querySelector('[data-f-hl-color].is-on');
            var col = (on && on.getAttribute('data-f-hl-color')) || 'red';
            rowCh.classList.add('is-highlight', 'hl-' + col);
          }
        }
      }, true);
      document.addEventListener('focusout', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (!t.matches || !t.matches('.li-detail input, .li-detail textarea, .li-detail select')) return;
        var row = t.closest('.list-item.is-expanded');
        if (!row) return;
        // Related target still inside same detail → skip
        var rt = e.relatedTarget;
        if (rt && row.contains(rt)) return;
        // #115: qty — if empty on blur, restore committed value in the field before save
        try {
          if (t.getAttribute('data-f') === 'qty') {
            var qRawB = String(t.value != null ? t.value : '').trim();
            var qnB = parseInt(qRawB, 10);
            if (qRawB === '' || isNaN(qnB) || qnB < 1) {
              var metaB = findItemFromRow(row);
              var keep = (metaB && metaB.item && metaB.item.qty != null) ? metaB.item.qty : 1;
              t.value = String(keep);
            } else {
              t.value = String(qnB);
            }
          }
        } catch (eQty) {}
        try { commitExpandedItemDetail(row); } catch (eF) {}
      }, true);
      // #115: commit qty on Enter without full page churn mid-type
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var t = e.target;
        if (!t || !t.getAttribute || t.getAttribute('data-f') !== 'qty') return;
        e.preventDefault();
        try { t.blur(); } catch (eB) {}
      }, true);
      // Item name template suggestions while typing in column add fields
      document.addEventListener('input', function (e) {
        var inp = e.target && e.target.closest && e.target.closest('[data-col-add-input], [data-event-col-add-input]');
        if (!inp) return;
        var box = inp.parentElement && inp.parentElement.querySelector('.item-tpl-suggest');
        if (!box) {
          box = document.createElement('div');
          box.className = 'item-tpl-suggest';
          inp.parentElement.style.position = 'relative';
          inp.parentElement.appendChild(box);
        }
        var hits = matchItemTemplates(inp.value);
        if (!hits.length) { box.innerHTML = ''; box.classList.remove('is-open'); return; }
        box.classList.add('is-open');
        box.innerHTML = hits.map(function (t) {
          return '<button type="button" class="item-tpl-hit" data-item-tpl="' + esc(t.id) + '">' +
            '<strong>' + esc(t.title) + '</strong>' +
            '<span class="muted"> · used before</span></button>';
        }).join('');
      }, true);
      document.addEventListener('click', function (e) {
        var hit = e.target && e.target.closest && e.target.closest('[data-item-tpl]');
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        var tid = hit.getAttribute('data-item-tpl');
        var tpl = loadItemTemplates().find(function (t) { return String(t.id) === String(tid); });
        var wrap = hit.closest('.list-col-add');
        var inp = wrap && wrap.querySelector('input');
        var colEl = hit.closest('.list-col');
        var colId = (inp && (inp.getAttribute('data-col-add-input') || inp.getAttribute('data-event-col-add-input'))) ||
          (colEl && colEl.getAttribute('data-col-kind'));
        if (!tpl || !colId) return;
        var list = resolveOpenNamedList(hit) || findNamedListById(state.activeNamedListId);
        if (!list) { appToast('Open a list first'); return; }
        if (addItemToListColumn(list, colId, tpl.title, {
          qty: tpl.qty,
          priority: tpl.priority,
          qualifier: tpl.qualifier,
          highlight: tpl.highlight,
          due_mode: tpl.due_mode,
          due_days: tpl.due_days,
          creator_only_edit: tpl.creator_only_edit,
          require_all: tpl.require_all
        })) {
          render();
          appToast('Added from template');
        }
      }, true);
    }
    // Highlight color swatches — live preview + auto-save (desktop triad + mobile sheet)
    document.addEventListener('click', function (e) {
      var sw = e.target.closest && e.target.closest('[data-f-hl-color]');
      if (!sw || sw.disabled) return;
      if (!sw.closest('#ev-list, #lists-active, #mobile-list-sheet, .list-col-body')) return;
      e.preventDefault();
      e.stopPropagation();
      var row = sw.closest('.list-item');
      if (!row) return;
      row.querySelectorAll('[data-f-hl-color]').forEach(function (b) {
        b.classList.toggle('is-on', b === sw);
      });
      var col = sw.getAttribute('data-f-hl-color') || 'red';
      row.classList.remove('hl-red', 'hl-yellow', 'hl-green');
      var hlCb = row.querySelector('[data-f="highlight"]');
      if (hlCb && hlCb.checked) {
        row.classList.add('is-highlight', 'hl-' + col);
      }
      // Auto-save highlight color
      try { commitExpandedItemDetail(row); } catch (eHl) {}
    }, true);
    on('ev-list', 'change', function (e) {
      if (!e.target || e.target.id !== 'list-detail-event-link') return;
      var list = findNamedListById(state.activeNamedListId);
      if (!list) return;
      var v = e.target.value || null;
      list.eventId = v;
      if (v) {
        clearTombstone('eventList', v);
        clearTombstone('list', list.id);
      }
      saveNamedList(list);
      state.leftTab = v ? 'events' : 'lists';
      appToast(v ? 'List linked to event' : 'List is personal again');
      render();
    });
    // Column options modal
    click('col-opt-close', closeColOptionsModal);
    click('col-opt-delete', function () {
      var list = findNamedListById(_colOpts.listId);
      if (!list || !isNamedListOwner(list)) return;
      if (String(_colOpts.colId) === 'personal') {
        appToast('Personal (claimed items) can’t be deleted');
        return;
      }
      appConfirm('Delete this section and all of its items?', 'Delete section').then(function (ok) {
        if (!ok) return;
        if (!deleteListColumn(list, _colOpts.colId)) {
          appToast('Keep at least one section');
          return;
        }
        saveNamedList(list);
        closeColOptionsModal();
        render();
        appToast('Section deleted');
      });
    });
    click('col-opt-save-name', function () {
      var list = findNamedListById(_colOpts.listId);
      var col = getListColumn(list, _colOpts.colId);
      if (!list || !col || !isNamedListOwner(list)) return;
      var name = ($('col-opt-name') && $('col-opt-name').value.trim()) || col.name;
      col.name = autoCap(name);
      saveNamedList(list);
      closeColOptionsModal();
      render();
    });
    click('col-opt-save-template', function () {
      var list = findNamedListById(_colOpts.listId);
      if (!list || !isNamedListOwner(list)) return;
      saveSectionAsTemplate(list, _colOpts.colId);
      closeColOptionsModal();
    });
    document.querySelectorAll('[data-col-color-slot]').forEach(function (b) {
      b.addEventListener('click', function () {
        _colOpts.slot = b.getAttribute('data-col-color-slot') || 'tab';
        document.querySelectorAll('[data-col-color-slot]').forEach(function (x) {
          x.classList.toggle('is-active', x === b);
        });
        var list = findNamedListById(_colOpts.listId);
        var col = getListColumn(list, _colOpts.colId);
        if (col && col.colors) renderColColorSwatches(col.colors[_colOpts.slot] || '#e59a18');
      });
    });
    on('col-opt-swatches', 'click', function (e) {
      var s = e.target.closest && e.target.closest('[data-col-swatch]');
      if (!s) return;
      applyColColor(s.getAttribute('data-col-swatch'));
    });
    on('col-opt-wheel', 'input', function () {
      if (this.value) applyColColor(this.value);
    });

    on('my-lists-home', 'click', function (e) {
      var b = e.target.closest('[data-open-list]');
      if (!b) return;
      openNamedListById(b.getAttribute('data-open-list'));
    });
    // Open list / event / edit from left home (single reliable path)
    on('view-home-list', 'click', function (e) {
      var editListB = e.target.closest && e.target.closest('[data-edit-list]');
      if (editListB) {
        e.preventDefault();
        e.stopPropagation();
        var lid = editListB.getAttribute('data-edit-list');
        var listEdit = findNamedListById(lid);
        if (listEdit) openEditListModal(listEdit);
        else appToast('List not found');
        return;
      }
      var editB = e.target.closest && e.target.closest('[data-edit-event]');
      if (editB) {
        e.preventDefault();
        e.stopPropagation();
        var eid = editB.getAttribute('data-edit-event');
        var evEdit = allEventsCombined().find(function (x) { return String(x.id) === String(eid); });
        if (evEdit) {
          state.activeEventId = eid;
          state.view = 'event';
          openEditEventModal(evEdit);
        }
        return;
      }
      var openEv = e.target.closest && e.target.closest('[data-open-event]');
      if (openEv) {
        e.preventDefault();
        e.stopPropagation();
        openEvent(openEv.getAttribute('data-open-event'));
        return;
      }
      var doneCh = e.target.closest && e.target.closest('[data-chore-done]');
      if (doneCh) {
        e.preventDefault();
        e.stopPropagation();
        var did = doneCh.getAttribute('data-chore-done');
        if (did && markChoreDone(did, true)) {
          appToast('Chore done!');
          state.calListMode = 'chores';
          render();
        } else {
          appToast('Could not mark done');
        }
        return;
      }
      var openChId = e.target.closest && e.target.closest('[data-open-chore-id]');
      if (openChId) {
        e.preventDefault();
        e.stopPropagation();
        // Don't open editor when pressing Done! (handled above)
        if (e.target.closest && e.target.closest('[data-chore-done]')) return;
        var cidOpen = openChId.getAttribute('data-open-chore-id');
        if (cidOpen) openScheduleChoreBuilder({ choreId: cidOpen, fromChoresList: true });
        return;
      }
      // legacy attrs
      var openStand = e.target.closest && e.target.closest('[data-open-standalone-chore]');
      if (openStand) {
        e.preventDefault();
        e.stopPropagation();
        var sid = openStand.getAttribute('data-open-standalone-chore');
        if (sid) openScheduleChoreBuilder({ choreId: sid, fromChoresList: true });
        return;
      }
      var b = e.target.closest && e.target.closest('[data-open-list]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      // Stay on current left tab (My lists or My events) — both open the pack on the right
      openNamedListById(b.getAttribute('data-open-list'));
    });
    click('cal-prev', function () {
      state.createCal.m--;
      if (state.createCal.m < 0) { state.createCal.m = 11; state.createCal.y--; }
      renderCalGrid();
    });
    click('cal-next', function () {
      state.createCal.m++;
      if (state.createCal.m > 11) { state.createCal.m = 0; state.createCal.y++; }
      renderCalGrid();
    });
    on('cal-grid', 'click', function (e) {
      var b = e.target.closest('[data-cal-day]');
      if (!b) return;
      var day = b.getAttribute('data-cal-day');
      // First tap = start; second tap = end (or reset start if same day twice) (#37)
      if (!state.createCal.selected || (state.createCal.selected && state.createCal.endSelected)) {
        state.createCal.selected = day;
        state.createCal.endSelected = null;
      } else if (day === state.createCal.selected) {
        state.createCal.endSelected = null;
      } else {
        state.createCal.endSelected = day;
        // Keep chronological start/end
        if (state.createCal.endSelected < state.createCal.selected) {
          var sw = state.createCal.selected;
          state.createCal.selected = state.createCal.endSelected;
          state.createCal.endSelected = sw;
        }
      }
      updateCreateCalSelectedLabel();
      renderCalGrid();
    });
    click('create-submit', function () {
      var name = autoCap(($('create-name').value || '').trim());
      if (!name) { appToast('Enter an event name'); return; }
      var type = ($('create-type').value || 'general').trim() || 'general';
      var personalOnly = $('create-personal-only') && $('create-personal-only').checked;
      var startAt = null;
      var endAt = null;
      if (state.createCal.selected) {
        var t = ($('create-time') && $('create-time').value) || '09:00';
        var d = new Date(state.createCal.selected + 'T' + t + ':00');
        if (!isNaN(d.getTime())) startAt = d.toISOString();
        var et = ($('create-end-time') && $('create-end-time').value) || '17:00';
        var endDate = state.createCal.endSelected || state.createCal.selected;
        if (!state.createCal.endSelected && $('create-end-next-day') && $('create-end-next-day').checked) {
          var nd = new Date(state.createCal.selected + 'T12:00:00');
          nd.setDate(nd.getDate() + 1);
          endDate = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0') + '-' +
            String(nd.getDate()).padStart(2, '0');
        }
        var de = new Date(endDate + 'T' + et + ':00');
        if (!isNaN(de.getTime())) endAt = de.toISOString();
      }
      var useTpl = $('create-template') && $('create-template').checked;
      var mapLink = parseCreateMapSelectValue($('create-select-map') && $('create-select-map').value);
      closeCreateModal();
      if (personalOnly) {
        var board = loadPersonalBoard();
        var pev = normalizeEvent({
          id: uid(),
          owner_user_id: myId(),
          name: name,
          event_type: type,
          start_at: startAt,
          end_at: endAt,
          invite_code: null,
          state: { lists: emptyLists(), expenses: [], mapPins: [] },
          updated_at: new Date().toISOString(),
          _personalOnly: true,
          _localOnly: true
        });
        applyMapLinkToEvent(pev, mapLink);
        if (useTpl) applyTemplateToEvent(pev, type);
        board.events = board.events || [];
        board.events.unshift(pev);
        savePersonalBoard(board);
        state.mode = 'personal';
        openEvent(pev.id);
        return;
      }
      createEvent(name, type, startAt, useTpl).then(function (ev) {
        if (!ev) return;
        if (endAt) ev.end_at = endAt;
        applyMapLinkToEvent(ev, mapLink);
        saveActiveEvent();
        render();
      }).catch(function (e) { appAlert(e.message || String(e), 'Could not create'); });
    });

    click('btn-join-event', function () {
      appPrompt('Enter the 6-digit invite code (event or list)', '', 'Join').then(function (code) {
        if (!code) return;
        var digits = String(code).replace(/\D/g, '').slice(0, 6);
        if (digits.length !== 6) { appAlert('Enter a 6-digit code', 'Join'); return; }
        // Try list first (local My lists invite codes)
        var store = loadFreeListsStore();
        var found = (store.named || []).find(function (n) { return String(n.invite_code) === digits; });
        if (found) {
          // Already have it — open it
          state.activeNamedListId = found.id;
          if (found.kind) state.listTab = found.kind;
          appToast('Opened list “' + (found.name || '') + '”');
          render();
          return;
        }
        // Local join: if we don't own the list, store a joined stub is N/A without cloud;
        // still try event join on server
        joinEvent(digits).catch(function (e) {
          // Allow joining a list shared via code that was added to localStorage by host export later
          appAlert(e.message || 'No event or list found for that code.', 'Join failed');
        });
      });
    });

    // Side calendar (Hunt: double-tap lock on month nav)
    // Calendar minimize / expand
    try {
      state.calCollapsed = localStorage.getItem(LOCAL_CAL_COLLAPSED_KEY) === '1';
    } catch (eC0) { state.calCollapsed = false; }
    // Keep Back visibility in sync when calendar min/max changes
    function refreshBackAfterLayout() {
      try { updateBackButtonsVisibility(); } catch (e) {}
    }
    click('side-cal-collapse', function () {
      state.calCollapsed = true;
      try { localStorage.setItem(LOCAL_CAL_COLLAPSED_KEY, '1'); } catch (e) {}
      render();
    });
    click('cal-collapsed-btn', function () {
      state.calCollapsed = false;
      try { localStorage.setItem(LOCAL_CAL_COLLAPSED_KEY, '0'); } catch (e) {}
      render();
    });
    // Mobile list sheet
    click('mls-close', function () { closeMobileListSheet(true); });
    click('mls-share', function () {
      var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
      if (!list) { appToast('Open a list first'); return; }
      openShareScopeModal(list, state.listTab || 'todo');
    });
    click('share-scope-cancel', closeShareScopeModal);
    on('share-scope-modal', 'click', function (e) {
      if (e.target === $('share-scope-modal')) closeShareScopeModal();
    });
    click('share-scope-section', function () {
      var list = findNamedListById(_shareScopeCtx.listId);
      if (!list) { appToast('List not found'); return; }
      var colId = _shareScopeCtx.colId || state.listTab || 'todo';
      var text = listSectionAsText(list, colId);
      var col = getListColumn(list, colId);
      var title = (list.name || 'List') + ' · ' + ((col && col.name) || listKindLabel(colId));
      closeShareScopeModal();
      shareOrCopyText(text, title).then(function (ok) {
        appToast(ok ? ('Shared “' + ((col && col.name) || listKindLabel(colId)) + '”') : 'Could not share');
      });
    });
    click('share-scope-all', function () {
      var list = findNamedListById(_shareScopeCtx.listId);
      if (!list) { appToast('List not found'); return; }
      var text = fullListAsText(list);
      closeShareScopeModal();
      shareOrCopyText(text, list.name || 'List').then(function (ok) {
        appToast(ok ? 'Shared all sections' : 'Could not share');
      });
    });
    click('share-scope-invite', function () {
      var list = findNamedListById(_shareScopeCtx.listId);
      closeShareScopeModal();
      if (!list) { appToast('List not found'); return; }
      openSharePeopleChooser('list', list.id);
    });
    on('mls-tabs', 'click', function (e) {
      var t = e.target.closest && e.target.closest('[data-mls-tab]');
      if (!t) return;
      // Save open item options before switching section
      if (state.expandedItemId) {
        var er = document.querySelector('.list-item.is-expanded');
        if (er) { try { commitExpandedItemDetail(er); } catch (eTab) {} }
      }
      state.listTab = t.getAttribute('data-mls-tab');
      state._scrollListTabOnce = true;
      state.expandedItemId = null;
      clearItemDetailEditState();
      renderMobileListSheet();
      // Also refresh desktop triad if present
      try { render(); } catch (eR) { renderMobileListSheet(); }
    });
    on('mobile-list-sheet', 'click', function (e) {
      // Add via same path as desktop
      var addBtn = e.target.closest && e.target.closest('[data-col-add]');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        submitColumnAddFromUi(addBtn);
        return;
      }
    });
    on('mobile-list-sheet', 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      var inp = e.target.closest && e.target.closest('[data-col-add-input]');
      if (!inp) return;
      e.preventDefault();
      submitColumnAddFromUi(inp);
    });

    click('side-cal-prev', function () {
      var now = Date.now();
      if (now < _sideCalNavLockUntil) return;
      _sideCalNavLockUntil = now + 180;
      state.sideCal.m--;
      if (state.sideCal.m < 0) { state.sideCal.m = 11; state.sideCal.y--; }
      state.sideCal.selectedDay = null;
      render();
    });
    click('side-cal-next', function () {
      var now = Date.now();
      if (now < _sideCalNavLockUntil) return;
      _sideCalNavLockUntil = now + 180;
      state.sideCal.m++;
      if (state.sideCal.m > 11) { state.sideCal.m = 0; state.sideCal.y++; }
      state.sideCal.selectedDay = null;
      render();
    });
    on('side-cal-grid', 'click', function (e) {
      var b = e.target.closest('[data-side-day]');
      if (!b) return;
      var day = b.getAttribute('data-side-day');
      state.sideCal.selectedDay = state.sideCal.selectedDay === day ? null : day;
      render();
    });
    click('btn-events-all', function () {
      state.eventsScope = 'all';
      state.sideCal.selectedDay = null;
      render();
    });
    click('btn-events-month', function () {
      state.eventsScope = 'month';
      state.sideCal.selectedDay = null;
      render();
    });
    click('ev-back', function () {
      state.view = 'home';
      state.activeEventId = null;
      state.moveItemId = null;
      state.expandedItemId = null;
      render();
    });

    on('sort-select', 'change', function () { state.sort = this.value; render(); });
    on('search-input', 'input', function () { state.search = this.value; render(); });
    on('friends-search', 'input', function () { state.friendsSearch = this.value; renderFriends(); });

    // Map: Hunt engine (plan-map.js) owns tools; app owns mode + settings only
    configurePlanMap();
    click('btn-toggle-map', function () { setMapMode('mini'); });
    click('map-maximize-btn', function () { setMapMode('max'); });
    // Hunt-style “which map am I viewing” chip (center above toolbar)
    click('map-viewing-chip', function (e) {
      try { if (e) { e.preventDefault(); e.stopPropagation(); } } catch (eS) {}
      openMapViewingSwitcher();
    });
    on('map-viewing-dropdown', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-view-mode]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      selectMapViewing(
        b.getAttribute('data-view-mode'),
        b.getAttribute('data-view-id') || null,
        b.getAttribute('data-view-name') || ''
      );
    });
    click('map-minimize-btn', function () { setMapMode('mini'); });
    click('map-min-hide', function () {
      setMapMode('button');
      if (window.PlanMap) window.PlanMap.cancelDraw();
    });
    click('btn-map-pin-filter', function () { toggleEventPinsOnly(); });
    click('mbb-context', function () {
      if (window.PlanMap) window.PlanMap.homeView();
    });
    click('map-settings-btn', function () {
      var s = loadMapSettings();
      if ($('ms-default-basemap')) $('ms-default-basemap').value = s.defaultBasemap || 'topo';
      if ($('ms-labels')) $('ms-labels').checked = !!s.labelsDefault;
      if ($('ms-coord-hud')) $('ms-coord-hud').checked = s.showCoordHud === true || s.coordHud === true;
      if ($('ms-soft-bounds')) $('ms-soft-bounds').checked = s.softBounds !== false;
      try {
        if (window.PlanMap && typeof window.PlanMap.fillShareIconSettingsGrid === 'function') {
          window.PlanMap.fillShareIconSettingsGrid();
        }
      } catch (eMs) {}
      if ($('map-settings-modal')) {
        $('map-settings-modal').classList.add('is-open');
        $('map-settings-modal').setAttribute('aria-hidden', 'false');
      }
    });
    click('ms-cancel', function () {
      if ($('map-settings-modal')) {
        $('map-settings-modal').classList.remove('is-open');
        $('map-settings-modal').setAttribute('aria-hidden', 'true');
      }
    });
    click('ms-save', function () {
      var hudChecked = !!( $('ms-coord-hud') && $('ms-coord-hud').checked );
      var s = {
        defaultBasemap: ($('ms-default-basemap') && $('ms-default-basemap').value) || 'topo',
        labelsDefault: !!( $('ms-labels') && $('ms-labels').checked ),
        // New key only — old coordHud ignored so prior default-on does not stick
        showCoordHud: hudChecked,
        coordHud: hudChecked,
        softBounds: !!( $('ms-soft-bounds') && $('ms-soft-bounds').checked )
      };
      saveMapSettings(s);
      if ($('map-settings-modal')) $('map-settings-modal').classList.remove('is-open');
      if (window.PlanMap) {
        window.PlanMap.ensure();
        var bm = s.defaultBasemap === 'street' ? 'streets' : s.defaultBasemap;
        window.PlanMap.setBasemap(bm);
        window.PlanMap.setLabels(!!s.labelsDefault);
      }
      applyCoordHudVisibility(hudChecked);
      appToast('Map settings saved');
    });

    // In-app dialog buttons
    click('app-alert-ok', function () { closeAppAlert(); });
    click('app-confirm-ok', function () { closeAppConfirm(true); });
    click('app-confirm-cancel', function () { closeAppConfirm(false); });
    click('app-prompt-ok', function () { closeAppPrompt(true); });
    click('app-prompt-cancel', function () { closeAppPrompt(false); });
    on('app-prompt-input', 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); closeAppPrompt(true); }
      if (e.key === 'Escape') { e.preventDefault(); closeAppPrompt(false); }
    });
    // Quick Load (Hunt calendar kit — never browser prompt)
    click('ql-btn-pins', function () { runQuickLoadChoice('pins'); });
    click('ql-btn-load', function () { runQuickLoadChoice('load'); });
    click('ql-btn-both', function () { runQuickLoadChoice('both'); });
    click('ql-btn-open', function () { runQuickLoadChoice('open'); });
    click('ql-btn-cancel', function () { closeQuickLoadModal(); });
    var qlModal = $('quick-load-modal');
    if (qlModal) {
      qlModal.addEventListener('click', function (e) {
        if (e.target === qlModal) closeQuickLoadModal();
      });
    }

    // Per-item share → other list or saved list
    function openItemShareModal(item, kind, scope) {
      state.itemShare = { item: item, kind: kind, scope: scope, id: item.id };
      if ($('item-share-label')) {
        $('item-share-label').textContent = 'Share “' + (item.title || 'item') + '”';
      }
      if ($('item-share-list')) {
        $('item-share-list').value = kind === 'todo' ? 'buy' : 'todo';
      }
      if ($('item-share-move')) $('item-share-move').checked = false;
      var sel = $('item-share-saved');
      if (sel) {
        var saved = loadJson(LOCAL_SAVED_KEY, []) || [];
        sel.innerHTML = '<option value="">— Select saved list —</option>' +
          saved.map(function (s) {
            return '<option value="' + esc(s.id) + '">' + esc(s.name || s.list_kind || 'Saved') +
              (s.list_kind ? ' (' + s.list_kind + ')' : '') + '</option>';
          }).join('') +
          '<option value="__new__">+ New saved list…</option>';
      }
      if ($('item-share-modal')) {
        $('item-share-modal').classList.add('is-open');
        $('item-share-modal').setAttribute('aria-hidden', 'false');
      }
    }
    click('item-share-cancel', function () {
      state.itemShare = null;
      if ($('item-share-modal')) {
        $('item-share-modal').classList.remove('is-open');
        $('item-share-modal').setAttribute('aria-hidden', 'true');
      }
    });
    on('item-share-modal', 'click', function (e) {
      if (e.target === $('item-share-modal')) {
        state.itemShare = null;
        $('item-share-modal').classList.remove('is-open');
      }
    });
    click('item-share-ok', function () {
      if (!state.itemShare || !state.itemShare.item) return;
      var meta = state.itemShare;
      var item = meta.item;
      var move = $('item-share-move') && $('item-share-move').checked;
      var destList = $('item-share-list') && $('item-share-list').value;
      var savedId = $('item-share-saved') && $('item-share-saved').value;
      var copy = newItem(item.title, {
        qty: item.qty || 1,
        notes: item.notes || '',
        notesList: (item.notesList || []).slice(),
        qualifier: item.qualifier || 'other',
        priority: item.priority || 0,
        highlight: !!item.highlight
      });

      if (savedId) {
        var saved = loadJson(LOCAL_SAVED_KEY, []) || [];
        if (savedId === '__new__') {
          appPrompt('Name for new saved list', (item.title || 'List') + ' pack', 'New saved list').then(function (nm) {
            if (!nm) return;
            saved.push({
              id: uid(),
              name: autoCap(nm),
              event_type: 'personal',
              list_kind: destList || meta.kind || 'todo',
              items: [{ title: copy.title, qty: copy.qty, notes: copy.notes, priority: copy.priority, qualifier: copy.qualifier }],
              created_at: new Date().toISOString()
            });
            saveJson(LOCAL_SAVED_KEY, saved);
            finishItemShareCopy(meta, item, copy, destList, move, false);
          });
          return;
        }
        var pack = saved.find(function (s) { return s.id === savedId; });
        if (pack) {
          if (!Array.isArray(pack.items)) pack.items = [];
          pack.items.push({
            title: copy.title, qty: copy.qty, notes: copy.notes,
            priority: copy.priority, qualifier: copy.qualifier
          });
        }
        saveJson(LOCAL_SAVED_KEY, saved);
      }

      finishItemShareCopy(meta, item, copy, destList, move, !!savedId);
    });

    function finishItemShareCopy(meta, item, copy, destList, move, hadSaved) {
      if (destList && destList !== meta.kind) {
        if (meta.scope === 'personal-board' || meta.scope === 'free-list') {
          var free = getActiveFreeBucket();
          // destination free list by kind
          var store = loadFreeListsStore();
          var sc = freeScope();
          if (!store[sc][destList]) store[sc][destList] = [];
          store[sc][destList].push(copy);
          if (move) {
            var src = store[sc][meta.kind] || [];
            store[sc][meta.kind] = src.filter(function (x) { return x.id !== meta.id; });
          }
          saveFreeListsStore(store);
        } else {
          var ev = activeEvent();
          if (ev) {
            getListBucket(ev, destList, 'group').push(copy);
            if (move) {
              var found = findItem(ev, meta.kind, 'group', meta.id);
              if (found.index >= 0) found.bucket.splice(found.index, 1);
            }
            saveActiveEvent();
          }
        }
      }
      state.itemShare = null;
      if ($('item-share-modal')) $('item-share-modal').classList.remove('is-open');
      appToast(hadSaved || (destList && destList !== meta.kind) ? 'Item shared' : 'Done');
      render();
    }

    // Copy / share list
    click('btn-copy-list', function () {
      var cur = currentListBucket();
      if (!cur.bucket) { appToast('Nothing to copy yet.'); return; }
      copyText(listAsText(cur.bucket, state.listTab)).then(function (ok) {
        appToast(ok ? 'List copied to clipboard' : 'Could not copy');
      });
    });
    // Edit list or linked event (header only — not on the left card under the name)
    click('btn-edit-list-or-event', function () {
      var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
      if (list && list.eventId) {
        var evL = findEventById(list.eventId);
        if (evL) {
          openEditEventModal(evL);
          return;
        }
      }
      if (list) {
        openEditListModal(list);
        return;
      }
      var ev = activeEvent();
      if (ev) {
        openEditEventModal(ev);
        return;
      }
      appToast('Open a list or event first');
    });
    // Share list = generate (or reuse) invite code so others can join
    click('btn-share-list', function () {
      var list = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
      if (!list) { appToast('Open a list first'); return; }
      openListInviteModal(list); // creates invite_code if missing, reuses if present
    });
    click('share-list-cancel', function () {
      if ($('share-list-modal')) {
        $('share-list-modal').classList.remove('is-open');
        $('share-list-modal').setAttribute('aria-hidden', 'true');
      }
    });
    click('share-copy-only', function () {
      var cur = currentListBucket();
      copyText(listAsText(cur.bucket || [], state.listTab)).then(function (ok) {
        appToast(ok ? 'List copied' : 'Could not copy');
        if ($('share-list-modal')) $('share-list-modal').classList.remove('is-open');
      });
    });
    click('share-to-member', function () {
      loadFriends();
      var sel = $('share-member-select');
      if (!sel) return;
      var friends = state.friends || [];
      // also current event members
      (state.members || []).forEach(function (m) { rememberFriend(m); });
      friends = loadJson(LOCAL_FRIENDS_KEY, []) || [];
      if (!friends.length) {
        appAlert('No friends yet. Join events with others first.', 'Friends');
        return;
      }
      sel.innerHTML = friends.map(function (f) {
        return '<option value="' + esc(f.user_id) + '">' + esc(f.display_name || f.username || 'Friend') + '</option>';
      }).join('');
      if ($('share-member-pick')) $('share-member-pick').style.display = '';
    });
    click('share-member-confirm', function () {
      var sel = $('share-member-select');
      if (!sel || !sel.value) return;
      var cur = currentListBucket();
      if (!cur.bucket || !cur.bucket.length) return;
      var pack = {
        fromId: myId(),
        fromName: myName(),
        kind: state.listTab,
        at: new Date().toISOString(),
        items: cur.bucket.map(function (it) {
          return {
            title: it.title, qty: it.qty, notes: it.notes, notesList: it.notesList,
            qualifier: it.qualifier, priority: it.priority
          };
        })
      };
      var inbox = loadInboxFor(sel.value);
      inbox.push(pack);
      saveInboxFor(sel.value, inbox);
      // If sharing to self (testing), merge now
      if (String(sel.value) === String(myId())) mergeInboxIntoPersonal();
      if ($('share-list-modal')) $('share-list-modal').classList.remove('is-open');
      appToast('Shared ' + pack.items.length + ' items to their personal list');
    });
    on('share-list-modal', 'click', function (e) {
      if (e.target === $('share-list-modal')) {
        $('share-list-modal').classList.remove('is-open');
      }
    });

    // Expense modal: Shared → Split with members · click-off saves · Cancel discards
    function closeExpense(discard) {
      if (!discard && state.expenseItem && state.expenseDraft && state.expenseDraft.dirty) {
        commitExpenseDraft();
      }
      state.expenseItem = null;
      state.expenseMeta = null;
      state.expenseDraft = null;
      if ($('expense-modal')) {
        $('expense-modal').classList.remove('is-open');
        $('expense-modal').setAttribute('aria-hidden', 'true');
      }
    }
    function expenseReadAmount() {
      return Math.max(0, parseFloat($('expense-amount-input') && $('expense-amount-input').value) || 0);
    }
    function expenseSelectedShareIds() {
      var ids = [];
      document.querySelectorAll('#expense-split-list [data-exp-share].is-on').forEach(function (b) {
        ids.push(b.getAttribute('data-exp-share'));
      });
      return ids;
    }
    function showExpenseStep(step) {
      if (!state.expenseDraft) state.expenseDraft = { step: 'main', dirty: false, shared: false, shareWith: [] };
      state.expenseDraft.step = step;
      var main = $('expense-step-main');
      var split = $('expense-step-split');
      if (main) main.style.display = step === 'main' ? '' : 'none';
      if (split) split.style.display = step === 'split' ? '' : 'none';
      if (step === 'split') {
        var mems = membersForSplitPick();
        var box = $('expense-split-list');
        var selected = state.expenseDraft.shareWith || [];
        if (box) {
          box.innerHTML = mems.map(function (m) {
            var id = String(m.user_id || m.id || '');
            var label = m.display_name || m.username || 'Member';
            var on = !selected.length || selected.indexOf(id) >= 0 || selected.indexOf(String(id)) >= 0;
            // If we already have an explicit selection list, only highlight those
            if (selected.length) {
              on = selected.some(function (s) { return String(s) === id; });
            }
            return '<button type="button" class="btn expense-share-chip' + (on ? ' is-on' : '') +
              '" data-exp-share="' + esc(id) + '">' + esc(label) + '</button>';
          }).join('') || '<p class="muted">No members yet.</p>';
        }
      }
    }
    function openExpenseFlow(item, kind, scope, id) {
      state.expenseItem = item;
      state.expenseMeta = { kind: kind, scope: scope, id: id };
      var existing = (item.expense_share_with || []).map(String);
      // Empty share list historically means "everyone"
      if (item.shared_expense && !existing.length) {
        existing = membersForSplitPick().map(function (m) {
          return String(m.user_id || m.id || '');
        });
      }
      state.expenseDraft = {
        step: 'main',
        dirty: false,
        shared: !!item.shared_expense,
        shareWith: existing.slice(),
        amount: Number(item.expense_amount) || 0,
        snapshotShared: !!item.shared_expense,
        snapshotAmount: Number(item.expense_amount) || 0,
        snapshotShare: existing.slice()
      };
      if ($('expense-label')) $('expense-label').textContent = '“' + (item.title || 'Item') + '”';
      if ($('expense-amount-input')) {
        // Empty field with $ prefix — no leading zero
        var existingAmt = Number(item.expense_amount) || 0;
        $('expense-amount-input').value = existingAmt > 0 ? String(existingAmt) : '';
        $('expense-amount-input').placeholder = '0.00';
      }
      showExpenseStep('main');
      if ($('expense-modal')) {
        $('expense-modal').classList.add('is-open');
        $('expense-modal').setAttribute('aria-hidden', 'false');
      }
    }
    function commitExpenseDraft() {
      var meta = state.expenseMeta || {};
      var found = findItemAny(meta.kind, meta.scope, meta.id);
      if (!found.item) return;
      var d = state.expenseDraft || {};
      var shared = !!d.shared;
      var amt = expenseReadAmount();
      var shares = d.step === 'split' ? expenseSelectedShareIds() : (d.shareWith || []);
      if (shared && d.step === 'split') {
        shares = expenseSelectedShareIds();
      }
      found.item.shared_expense = shared;
      found.item.expense_amount = shared ? amt : 0;
      found.item.expense_share_with = shared ? shares : [];
      if (!found.item.created_by) found.item.created_by = myId();
      if (meta.scope === 'personal-board' && found.board) {
        found.board[meta.kind] = found.bucket;
        savePersonalBoard(found.board);
      } else if (meta.scope === 'free-list' && found.list) {
        saveNamedList(found.list);
      } else {
        saveActiveEvent();
      }
    }
    window._psOpenExpenseFlow = openExpenseFlow;
    click('expense-shared', function () {
      if (!state.expenseDraft) return;
      state.expenseDraft.shared = true;
      state.expenseDraft.dirty = true;
      state.expenseDraft.amount = expenseReadAmount();
      // Start with all selected when entering split
      if (!(state.expenseDraft.shareWith && state.expenseDraft.shareWith.length)) {
        state.expenseDraft.shareWith = membersForSplitPick().map(function (m) {
          return String(m.user_id || m.id || '');
        });
      }
      showExpenseStep('split');
    });
    click('expense-not-shared', function () {
      if (!state.expenseDraft) return closeExpense(true);
      state.expenseDraft.shared = false;
      state.expenseDraft.dirty = true;
      state.expenseDraft.shareWith = [];
      commitExpenseDraft();
      closeExpense(true);
      render();
      appToast('Not a shared expense');
    });
    click('expense-split-all', function () {
      document.querySelectorAll('#expense-split-list [data-exp-share]').forEach(function (b) {
        b.classList.add('is-on');
      });
      if (state.expenseDraft) {
        state.expenseDraft.dirty = true;
        state.expenseDraft.shareWith = expenseSelectedShareIds();
      }
    });
    on('expense-split-list', 'click', function (e) {
      var b = e.target.closest && e.target.closest('[data-exp-share]');
      if (!b) return;
      b.classList.toggle('is-on');
      if (state.expenseDraft) {
        state.expenseDraft.dirty = true;
        state.expenseDraft.shareWith = expenseSelectedShareIds();
      }
    });
    click('expense-cancel', function () {
      // Discard — restore snapshot
      var meta = state.expenseMeta || {};
      var found = findItemAny(meta.kind, meta.scope, meta.id);
      var d = state.expenseDraft;
      if (found.item && d) {
        found.item.shared_expense = !!d.snapshotShared;
        found.item.expense_amount = d.snapshotAmount || 0;
        found.item.expense_share_with = (d.snapshotShare || []).slice();
      }
      closeExpense(true);
      render();
    });
    on('expense-modal', 'click', function (e) {
      if (e.target !== $('expense-modal')) return;
      // Click off = save what you've done
      if (state.expenseDraft) {
        if (state.expenseDraft.step === 'split') state.expenseDraft.shared = true;
        state.expenseDraft.dirty = true;
        state.expenseDraft.amount = expenseReadAmount();
        state.expenseDraft.shareWith = expenseSelectedShareIds();
      }
      closeExpense(false);
      render();
    });
    click('expense-split-done', function () {
      if (state.expenseDraft) {
        state.expenseDraft.shared = true;
        state.expenseDraft.dirty = true;
        state.expenseDraft.amount = expenseReadAmount();
        state.expenseDraft.shareWith = expenseSelectedShareIds();
      }
      commitExpenseDraft();
      closeExpense(true);
      render();
      appToast('Shared expense saved');
    });

    click('qty-dec', function () {
      var el = $('add-item-qty');
      if (el) el.value = Math.max(1, (parseInt(el.value, 10) || 1) - 1);
    });
    click('qty-inc', function () {
      var el = $('add-item-qty');
      if (el) el.value = Math.max(1, (parseInt(el.value, 10) || 1) + 1);
    });
    click('btn-add-from-input', addItemFromInputs);
    on('add-item-input', 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addItemFromInputs(); }
    });
    on('add-item-input', 'input', function () {
      var ev = activeEvent();
      var box = $('add-suggest');
      if (!ev || !box) return;
      var q = this.value.trim().toLowerCase();
      if (q.length < 2) { box.classList.remove('is-open'); box.innerHTML = ''; return; }
      var hits = allTitlesForSuggest(ev).filter(function (m) {
        return m.title.toLowerCase().indexOf(q) >= 0;
      }).slice(0, 8);
      if (!hits.length) { box.classList.remove('is-open'); box.innerHTML = ''; return; }
      box.innerHTML = hits.map(function (h) {
        return '<button type="button" class="suggest-item" data-suggest="' + esc(h.title) + '">' +
          esc(h.title) + ' <span class="muted">(' + h.kind + ')</span></button>';
      }).join('');
      box.classList.add('is-open');
    });

    // Qualifier filter chips + sort by type
    on('qualifier-filters', 'click', function (e) {
      var b = e.target.closest('[data-filter-q]');
      if (!b) return;
      var q = b.getAttribute('data-filter-q');
      if (q === '__sort') {
        state.sortByType = !state.sortByType;
      } else {
        state.filterQualifier = q;
      }
      render();
    });

    // Add category / qualifier (from item detail "Add…" or legacy button if present)
    var _catAddCallback = null;
    function openAddCategoryModal(cb) {
      _catAddCallback = typeof cb === 'function' ? cb : null;
      if ($('cat-name')) $('cat-name').value = '';
      if ($('cat-color')) $('cat-color').value = '#8a7340';
      if ($('category-modal')) {
        $('category-modal').classList.add('is-open');
        $('category-modal').setAttribute('aria-hidden', 'false');
      }
    }
    click('btn-add-category', function () { openAddCategoryModal(null); });
    click('cat-cancel', function () {
      _catAddCallback = null;
      if ($('category-modal')) {
        $('category-modal').classList.remove('is-open');
        $('category-modal').setAttribute('aria-hidden', 'true');
      }
    });
    on('category-modal', 'click', function (e) {
      if (e.target === $('category-modal')) {
        _catAddCallback = null;
        $('category-modal').classList.remove('is-open');
        $('category-modal').setAttribute('aria-hidden', 'true');
      }
    });
    click('cat-save', function () {
      var name = autoCap(($('cat-name') && $('cat-name').value || '').trim());
      if (!name) { appToast('Enter a category name'); return; }
      var color = ($('cat-color') && $('cat-color').value) || '#8a7340';
      var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid();
      var newId = id;
      // Prefer active event qualifiers, else free-list global categories, else personal board
      var ev = activeEvent();
      var freeOpen = state.activeNamedListId && findNamedListById(state.activeNamedListId);
      if (ev && !ev._personalOnly && !freeOpen) {
        var qs = ensureQualifiers(ev);
        if (qs.some(function (q) { return q.id === id; })) newId = id + '_' + Date.now().toString(36).slice(-3);
        qs.push({ id: newId, name: name, color: color });
        // Keep "other" at end
        ev.state.qualifiers = qs.filter(function (q) { return q.id !== 'other'; })
          .concat(qs.filter(function (q) { return q.id === 'other'; }));
        saveActiveEvent();
      } else if (freeOpen || !ev || ev._personalOnly) {
        var fqs = freeListQualifiers();
        if (fqs.some(function (q) { return q.id === id; })) newId = id + '_' + Date.now().toString(36).slice(-3);
        fqs.push({ id: newId, name: name, color: color });
        fqs = fqs.filter(function (q) { return q.id !== 'other'; })
          .concat(fqs.filter(function (q) { return q.id === 'other'; }));
        saveFreeListQualifiers(fqs);
      } else {
        var board = loadPersonalBoard();
        if (!board.qualifiers) board.qualifiers = DEFAULT_QUALIFIERS.map(function (q) { return Object.assign({}, q); });
        if (board.qualifiers.some(function (q) { return q.id === id; })) newId = id + '_' + Date.now().toString(36).slice(-3);
        board.qualifiers.push({ id: newId, name: name, color: color });
        board.qualifiers = board.qualifiers.filter(function (q) { return q.id !== 'other'; })
          .concat(board.qualifiers.filter(function (q) { return q.id === 'other'; }));
        savePersonalBoard(board);
      }
      if ($('category-modal')) {
        $('category-modal').classList.remove('is-open');
        $('category-modal').setAttribute('aria-hidden', 'true');
      }
      try {
        var freeOpenCat = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null;
        recordCategoryUse(newId, activeEvent(), freeOpenCat);
        state.filterQualifier = newId;
      } catch (eCu) {}
      var cb = _catAddCallback;
      _catAddCallback = null;
      if (cb) cb(newId);
      else render();
    });
    // Category select: choosing "+ Add category…" opens modal
    document.body.addEventListener('change', function (e) {
      var sel = e.target && e.target.closest && e.target.closest('[data-cat-select]');
      if (!sel) return;
      if (sel.value !== '__add_category__') return;
      var prev = sel.getAttribute('data-prev') || 'other';
      sel.value = prev;
      var row = sel.closest('.list-item');
      var itemId = row && row.getAttribute('data-item-id');
      openAddCategoryModal(function (newId) {
        if (!newId || !itemId) { render(); return; }
        // Apply new category to the item
        var found = null;
        var cur = currentListBucket();
        if (cur.bucket) found = cur.bucket.find(function (x) { return x.id === itemId; });
        if (found) {
          found.qualifier = newId;
          try {
            var freeOpenN = state.activeNamedListId ? findNamedListById(state.activeNamedListId) : null;
            recordCategoryUse(newId, activeEvent(), freeOpenN || (cur.free && cur.free.named) || null);
            state.filterQualifier = newId;
          } catch (eRec) {}
          if (cur.scope === 'group' && cur.ev) saveActiveEvent();
          else if (cur.free) {
            if (cur.free.named) {
              cur.free.named.updated_at = new Date().toISOString();
              saveNamedList(cur.free.named);
            } else saveFreeListsStore(cur.free.store);
          } else if (cur.named) {
            saveNamedList(cur.named);
          }
        }
        render();
      });
    });
    document.body.addEventListener('focusin', function (e) {
      var sel = e.target && e.target.closest && e.target.closest('[data-cat-select]');
      if (sel) sel.setAttribute('data-prev', sel.value);
    });

    document.querySelectorAll('[data-list-tab]').forEach(function (b) {
      b.onclick = function () {
        state.listTab = b.getAttribute('data-list-tab');
        state.activeNamedListId = null;
        state.expandedItemId = null;
        state.moveItemId = null;
        render();
      };
    });
    click('btn-save-list', function () {
      var cur = currentListBucket();
      if (!cur.bucket) { appToast('Nothing to save.'); return; }
      var kind = state.listTab;
      var ev = activeEvent();
      var name = ((ev && ev.event_type) || (state.mode === 'personal' ? 'personal' : 'list')) + ' ' + kind;
      var saved = loadJson(LOCAL_SAVED_KEY, []);
      saved.push({
        id: uid(), name: name, event_type: (ev && ev.event_type) || 'personal', list_kind: kind,
        items: cur.bucket.map(function (it) {
          return {
            title: it.title, qty: it.qty, notes: it.notes, priority: it.priority,
            qualifier: it.qualifier || 'other'
          };
        }),
        created_at: new Date().toISOString()
      });
      saveJson(LOCAL_SAVED_KEY, saved);
      var client = sb();
      if (client && myId() && cur.scope !== 'personal-board') {
        client.from('plan_saved_lists').insert({
          user_id: myId(), name: name, event_type: (ev && ev.event_type) || 'general',
          list_kind: kind, items: cur.bucket
        }).then(function () {});
      }
      appToast('List saved for future templates');
    });

    click('btn-copy-code', function () {
      var ev = activeEvent();
      if (!ev || !ev.invite_code) return;
      var url = location.origin + location.pathname + '?join=' + ev.invite_code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { appToast('Invite link copied'); });
      } else {
        appPrompt('Copy this invite link', url, 'Invite link');
      }
    });

    function closeGot() {
      state.gotItem = null;
      if ($('got-modal')) $('got-modal').classList.remove('is-open');
    }
    click('got-cancel', closeGot);
    click('got-dec', function () {
      var el = $('got-qty');
      if (el) el.value = Math.max(0, (parseInt(el.value, 10) || 0) - 1);
    });
    click('got-inc', function () {
      var el = $('got-qty');
      if (el) el.value = (parseInt(el.value, 10) || 0) + 1;
    });
    click('got-ok', function () {
      if (!state.gotItem) return closeGot();
      var n = parseInt($('got-qty').value, 10);
      if (isNaN(n) || n < 0) n = 0;
      var itemId = state.gotItem.id;
      var scope = state.gotScope;
      var kind = state.gotKind;
      if (scope === 'personal-board') {
        var board = loadPersonalBoard();
        var arr = board[kind] || [];
        var it = arr.find(function (x) { return x.id === itemId; });
        if (it) {
          if (!it.claims) it.claims = {};
          if (n === 0) delete it.claims[myId()];
          else it.claims[myId()] = n;
          board[kind] = arr;
          if (String(kind) === 'buy') {
            if (!Array.isArray(board.bring)) board.bring = [];
            syncBuyGotToBringOnBucket(board.buy, board.bring, it, n);
          }
          savePersonalBoard(board);
        }
      } else if (scope === 'free-list') {
        // Named list columns (todo / buy / bring / custom) — all save the same way
        var nList = resolveOpenNamedList(null) || findNamedListById(state.activeNamedListId);
        if (nList) {
          var hitG = findInNamedListColumn(nList, kind, itemId);
          if (!hitG) {
            (nList.columns || []).some(function (c) {
              var ix = (c.items || []).findIndex(function (x) { return String(x.id) === String(itemId); });
              if (ix >= 0) {
                hitG = { list: nList, item: c.items[ix], colId: c.id };
                return true;
              }
              return false;
            });
          }
          var target = (hitG && hitG.item) || state.gotItem;
          if (!target.claims) target.claims = {};
          if (n === 0) delete target.claims[myId()];
          else target.claims[myId()] = n;
          // To buy Got it → mirror into To bring; stay checked on buy (saves inside)
          if (!afterGotItClaim(target, kind, 'free-list', n)) {
            saveNamedList(nList);
          }
        } else {
          if (!state.gotItem.claims) state.gotItem.claims = {};
          if (n === 0) delete state.gotItem.claims[myId()];
          else state.gotItem.claims[myId()] = n;
        }
      } else {
        if (!state.gotItem.claims) state.gotItem.claims = {};
        if (n === 0) delete state.gotItem.claims[myId()];
        else state.gotItem.claims[myId()] = n;
        afterGotItClaim(state.gotItem, kind, scope, n);
        saveActiveEvent();
      }
      closeGot();
      render();
    });

    document.body.addEventListener('click', function (ev) {
      var s = ev.target.closest('[data-suggest]');
      if (s) {
        if ($('add-item-input')) $('add-item-input').value = s.getAttribute('data-suggest');
        if ($('add-suggest')) $('add-suggest').classList.remove('is-open');
        return;
      }

      var editEv = ev.target.closest('[data-edit-event]');
      if (editEv) {
        ev.preventDefault();
        ev.stopPropagation();
        var eid2 = editEv.getAttribute('data-edit-event');
        var ev2 = allEventsCombined().find(function (x) { return String(x.id) === String(eid2); });
        if (ev2) openEditEventModal(ev2);
        return;
      }
      var open = ev.target.closest('[data-open-event]');
      if (open) {
        // Open event + associated lists on the right — no popup, no auto-open map
        openEvent(open.getAttribute('data-open-event'));
        return;
      }
      var doneCh2 = ev.target.closest('[data-chore-done]');
      if (doneCh2) {
        ev.preventDefault();
        ev.stopPropagation();
        var did2 = doneCh2.getAttribute('data-chore-done');
        if (did2 && markChoreDone(did2, true)) {
          appToast('Chore done!');
          state.calListMode = 'chores';
          render();
        } else {
          appToast('Could not mark done');
        }
        return;
      }
      var openChId2 = ev.target.closest('[data-open-chore-id]');
      if (openChId2) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.target.closest && ev.target.closest('[data-chore-done]')) return;
        var cid2 = openChId2.getAttribute('data-open-chore-id');
        if (cid2) openScheduleChoreBuilder({ choreId: cid2, fromChoresList: true });
        return;
      }
      var openStand2 = ev.target.closest('[data-open-standalone-chore]');
      if (openStand2) {
        ev.preventDefault();
        ev.stopPropagation();
        var sid2 = openStand2.getAttribute('data-open-standalone-chore');
        if (sid2) openScheduleChoreBuilder({ choreId: sid2, fromChoresList: true });
        return;
      }
      var mctx = ev.target.closest('[data-map-ctx]');
      if (mctx) {
        state.mapContext = mctx.getAttribute('data-map-ctx') || 'auto';
        renderMapContextBar();
        if (window.PlanMap) {
          window.PlanMap.ensure();
          window.PlanMap.redraw();
        }
        appToast('Map: ' + (state.mapContext === 'auto' ? 'Auto' : state.mapContext === 'personal' ? 'Personal' : 'Event map'));
        return;
      }

      var memChip = ev.target.closest('[data-member-chip]');
      if (memChip) {
        var chipId = memChip.getAttribute('data-member-chip');
        var chipScope = memChip.getAttribute('data-member-scope') || 'event';
        var chipListId = memChip.getAttribute('data-member-list-id') || '';
        (function showChipMemberPop(mid, anchor, scope, listId) {
          var old = document.querySelector('.member-pop');
          if (old) old.remove();
          var items = [];
          try { items = itemsClaimedByMember(mid); } catch (eI) { items = []; }
          var pop = document.createElement('div');
          pop.className = 'member-pop';
          var mem = null;
          if (scope === 'list') {
            var lst = findNamedListById(listId);
            mem = ((lst && lst.members) || []).find(function (x) { return String(x.user_id) === String(mid); });
          } else {
            mem = (state.members || []).find(function (x) { return String(x.user_id) === String(mid); });
          }
          // Tap member chip: only what they agreed to bring (remove lives in Edit event/list)
          pop.innerHTML = '<h5 style="color:' + memberColor(mid) + '">' +
            esc(memberLabel(mid) || (mem && mem.display_name) || 'Member') + '</h5>' +
            '<p class="muted" style="margin:0 0 6px;font-size:11px">Bringing</p>' +
            (items.length
              ? '<ul>' + items.map(function (it) {
                return '<li>' + esc(it.title) + (it.qty > 1 ? ' ×' + it.qty : '') +
                  (it.kind ? (' <span class="muted">· ' + esc(it.kind) + '</span>') : '') + '</li>';
              }).join('') + '</ul>'
              : '<p class="muted">Nothing claimed yet.</p>');
          document.body.appendChild(pop);
          var r = anchor.getBoundingClientRect();
          pop.style.left = Math.min(window.innerWidth - 220, Math.max(8, r.left)) + 'px';
          pop.style.top = (r.bottom + 6 + window.scrollY) + 'px';
          setTimeout(function () {
            function closePop(ev2) {
              if (pop.contains(ev2.target)) return;
              pop.remove();
              document.removeEventListener('click', closePop, true);
            }
            document.addEventListener('click', closePop, true);
          }, 0);
        })(chipId, memChip, chipScope, chipListId);
        return;
      }

      var addToggle = ev.target.closest && ev.target.closest('[data-inline-add-toggle]');
      if (addToggle) {
        ev.preventDefault();
        ev.stopPropagation();
        var dk = addToggle.getAttribute('data-inline-add-toggle');
        if (state.membersAddOpenKey && String(state.membersAddOpenKey) === String(dk)) {
          state.membersAddOpenKey = null;
          state._keepMemberSearchFocus = false;
        } else {
          state.membersAddOpenKey = dk;
          state.membersDrawerKey = dk;
          state._keepMemberSearchFocus = true;
          state._skipMembersCollapseOnce = true;
          // Warm partners so typeahead has people
          try { refreshMapPartnersFromCloud(); } catch (eR) {}
        }
        render();
        return;
      }

      var row = ev.target.closest('.list-item');
      if (!row) return;
      if (state._suppressItemClick) return;
      // Don't treat typing in expanded detail as an item action
      if (ev.target.closest && ev.target.closest('.li-detail input, .li-detail select, .li-detail textarea, .li-detail label, .li-detail .check-row')) {
        return;
      }
      // Keep this click from the outside-click collapse listener (re-render detaches nodes)
      ev.stopPropagation();
      var actBtn = ev.target.closest('[data-act]');
      // Click anywhere on the item tile (any column) → expand/open options
      var action = 'expand';
      if (actBtn) {
        var a = actBtn.getAttribute('data-act');
        // Prefer explicit controls; face/main always expand
        if (a && a !== 'expand' && a !== 'face') action = a;
        else action = 'expand';
      }
      var id = row.getAttribute('data-item-id');
      var kind = row.getAttribute('data-kind');
      var scope = row.getAttribute('data-scope') || 'free-list';

      function showMemberPop(mid, anchor) {
        var old = document.querySelector('.member-pop');
        if (old) old.remove();
        var items = itemsClaimedByMember(mid);
        var pop = document.createElement('div');
        pop.className = 'member-pop';
        var ev = activeEvent();
        var mem = (state.members || []).find(function (x) { return String(x.user_id) === String(mid); });
        var isCreatorAlready = mem && (mem.role === 'owner' || mem.role === 'creator');
        var canGrant = ev && !ev._personalOnly && isEventCreator(ev) && String(mid) !== String(myId());
        var free = getActiveFreeBucket();
        var canGrantList = free && free.named && isListCreator(free.named) && String(mid) !== String(myId());
        var actions = '';
        if (canGrant) {
          if (isCreatorAlready && mem.role === 'creator') {
            actions += '<button type="button" class="btn" data-mem-act="revoke-creator" data-mid="' + esc(mid) + '" style="width:100%;margin-top:8px;font-size:11px">Remove creator privileges</button>';
          } else if (!isCreatorAlready) {
            actions += '<button type="button" class="btn btn-primary" data-mem-act="grant-creator" data-mid="' + esc(mid) + '" style="width:100%;margin-top:8px;font-size:11px">Grant creator privileges</button>';
          }
        }
        if (canGrantList) {
          var alreadyList = (free.named.creators || []).some(function (c) { return String(c) === String(mid); });
          if (!alreadyList) {
            actions += '<button type="button" class="btn btn-primary" data-mem-act="grant-list-creator" data-mid="' + esc(mid) + '" style="width:100%;margin-top:6px;font-size:11px">Grant list creator</button>';
          }
        }
        pop.innerHTML = '<h5 style="color:' + memberColor(mid) + '">' + esc(memberLabel(mid)) +
          (isCreatorAlready ? ' · creator' : '') + '</h5>' +
          '<p class="muted" style="margin:0 0 6px;font-size:11px">Claimed / bringing</p>' +
          (items.length
            ? '<ul>' + items.map(function (it) {
              return '<li>' + esc(it.title) + (it.qty > 1 ? ' ×' + it.qty : '') +
                ' <span class="muted">(' + esc(it.kind) + ')</span></li>';
            }).join('') + '</ul>'
            : '<p class="muted">Nothing claimed yet.</p>') +
          actions;
        document.body.appendChild(pop);
        var r = anchor.getBoundingClientRect();
        pop.style.left = Math.min(window.innerWidth - 220, Math.max(8, r.left)) + 'px';
        pop.style.top = (r.bottom + 6 + window.scrollY) + 'px';
        pop.querySelectorAll('[data-mem-act]').forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            var a = b.getAttribute('data-mem-act');
            var id = b.getAttribute('data-mid');
            pop.remove();
            if (a === 'grant-creator') grantEventCreatorRole(id);
            else if (a === 'revoke-creator') revokeEventCreatorRole(id);
            else if (a === 'grant-list-creator') grantListCreatorRole(id);
          });
        });
        setTimeout(function () {
          function closePop(ev2) {
            if (pop.contains(ev2.target)) return;
            pop.remove();
            document.removeEventListener('click', closePop, true);
          }
          document.addEventListener('click', closePop, true);
        }, 0);
      }

      function mutateBucket(bucket, item, index) {
        if (action === 'del') {
          // async confirm — handled below via abort-async-del
          return 'abort-async-del';
        } else if (action === 'minimize') {
          if (state.minimizedItems[id]) {
            delete state.minimizedItems[id];
          } else {
            // Save any open options first, then shrink to name+type only
            if (state.expandedItemId === id) {
              try { commitExpandedItemDetail(row); } catch (eMin) {}
              state.expandedItemId = null;
              clearItemDetailEditState();
            }
            state.minimizedItems[id] = true;
          }
          return 'rerender-only';
        } else if (action === 'expense') {
          if (!showExpenseEnabled(findNamedListById(state.activeNamedListId), activeEvent())) {
            appToast('$ is turned off for this list — enable it in Edit list/event');
            return 'abort';
          }
          openExpenseFlow(item, kind, scope, id);
          return 'abort-modal';
        } else if (action === 'cancel-detail') {
          // Discard option changes → restore snapshot
          if (state.itemDetailSnapshot && String(state.itemDetailMeta && state.itemDetailMeta.id) === String(id)) {
            restoreItemDetail(item, state.itemDetailSnapshot);
            try { persistItemByMeta(kind, scope, id, row); } catch (eR) {}
          }
          state.expandedItemId = null;
          state.noteItemId = null;
          clearItemDetailEditState();
          return 'rerender-only';
        } else if (action === 'delegate') {
          var mgrList = resolveOpenNamedList(row) || findNamedListById(state.activeNamedListId);
          if (!canManageList(mgrList) && !(activeEvent() && isEventCreator(activeEvent()))) {
            appToast('Only the creator/manager can delegate');
            return 'abort';
          }
          openDelegateModal(item, kind, scope);
          return 'abort-modal';
        } else if (action === 'share-item') {
          // Auto-copy full item settings to clipboard for paste into another list
          try { commitExpandedItemDetail(row); } catch (eSh) {}
          copyItemPayloadToClipboard(item).then(function (ok) {
            appToast(ok
              ? 'Shared to clipboard — paste in another list’s add box'
              : 'Could not copy');
          });
          return 'abort';
        } else if (action === 'make-chore-toggle' || action === 'choose-when') {
          try { commitExpandedItemDetail(row); } catch (eCw) {}
          openChoreWhenPicker(item, kind, scope);
          return 'abort-modal';
        } else if (action === 'clear-chore') {
          item.chore_at = null;
          item.chore_end_at = null;
          item.chore_show_on_calendar = true;
          try {
            var hd2 = row.querySelector('[data-f="chore_date"]');
            var ht2 = row.querySelector('[data-f="chore_time"]');
            var he2 = row.querySelector('[data-f="chore_end_time"]');
            var hs2 = row.querySelector('[data-f="chore_show_on_calendar"]');
            if (hd2) hd2.value = '';
            if (ht2) ht2.value = '';
            if (he2) he2.value = '';
            if (hs2 && hs2.type === 'checkbox') hs2.checked = true;
          } catch (eCl) {}
          try { persistItemByMeta(kind, scope, id, row); } catch (eP2) {}
          state.makeChoreOpenId = id;
          appToast('Chore schedule cleared');
          return 'rerender-only';
        } else if (action === 'category') {
          openItemCategoryModal(item, kind, scope);
          return 'abort-modal';
        } else if (action === 'save-item-template') {
          saveItemTemplate(item);
          appToast('Item template saved — it will suggest when you type this name');
          return 'abort';
        } else if (action === 'save-as-template') {
          // legacy: redirect to item template
          saveItemTemplate(item);
          appToast('Item template saved');
          return 'abort';
        } else if (action === 'expand' || action === 'face') {
          // #70 — item minimize removed; always toggle options
          // Clicking another item while one is open: save the previous first
          if (state.expandedItemId && String(state.expandedItemId) !== String(id)) {
            var prevRow = document.querySelector('.list-item.is-expanded');
            if (prevRow) {
              try { commitExpandedItemDetail(prevRow); } catch (ePrev) {}
            }
          }
          // Toggle options panel; snapshot for Cancel
          state._skipExpandCollapseOnce = true;
          if (String(state.expandedItemId || '') === String(id)) {
            // Closing via re-click on face → save
            try { commitExpandedItemDetail(row); } catch (eCl) {}
            state.expandedItemId = null;
            state.noteItemId = null;
            clearItemDetailEditState();
            // #92: keep category filter on "all" so items don't vanish after collapse
            if (state.filterQualifier && state.filterQualifier !== 'all') {
              /* keep user filter if they set it; only clear if we auto-set (disabled) */
            }
          } else {
            state.expandedItemId = id;
            state.noteItemId = id;
            state.itemDetailSnapshot = snapshotItemDetail(item);
            state.itemDetailMeta = { kind: kind, scope: scope, id: id };
          }
          state.moveItemId = null;
          return 'rerender-only';
        } else if (action === 'drag') {
          // Handled by drag listeners — ignore click
          return 'abort';
        } else if (action === 'move' || action === 'up' || action === 'down') {
          return 'abort';
        } else if (action === 'member') {
          var mid = actBtn.getAttribute('data-member-id');
          showMemberPop(mid, actBtn);
          return 'abort';
        } else if (action === 'drop') {
          // Fully gotten → Drop releases everything I claimed so it goes back on the list
          if (!item.claims) item.claims = {};
          if (myClaimQty(item) <= 0) {
            appToast('You have nothing claimed to drop');
            return 'abort';
          }
          clearMyClaimsOnItem(item);
          var savedDrop = afterGotItClaim(item, kind, scope, 0);
          try { appToast('Dropped — back on the list'); } catch (eTd) {}
          if (savedDrop && (scope === 'free-list' || scope === 'personal-board')) return 'rerender-only';
          // fall through to save for event/group scopes
        } else if (action === 'got') {
          var need = Math.max(1, Number(item.qty) || 1);
          if (!item.claims) item.claims = {};
          // If fully gotten and I still have a claim, treat as Drop (safety)
          if (isItemAccounted(item) && myClaimQty(item) > 0) {
            clearMyClaimsOnItem(item);
            var savedAsDrop = afterGotItClaim(item, kind, scope, 0);
            try { appToast('Dropped — back on the list'); } catch (eTd2) {}
            if (savedAsDrop && (scope === 'free-list' || scope === 'personal-board')) return 'rerender-only';
          } else if (need === 1) {
            var meG = myId();
            var nextQty = 0;
            if (myClaimQty(item) > 0) {
              clearMyClaimsOnItem(item);
              nextQty = 0;
            } else {
              item.claims[meG] = 1;
              nextQty = 1;
            }
            // To buy → also add/update To bring; leave claim checked on buy
            var savedGot = afterGotItClaim(item, kind, scope, nextQty);
            // free-list already saved claims+bring; skip second save of a stale clone
            if (savedGot && scope === 'free-list') return 'rerender-only';
            if (savedGot && scope === 'personal-board') return 'rerender-only';
          } else {
            state.gotItem = item;
            state.gotScope = scope;
            state.gotKind = kind;
            var already = myClaimQty(item);
            if ($('got-label')) $('got-label').textContent = 'How many of “' + item.title + '” (of ' + need + ')?';
            if ($('got-qty')) $('got-qty').value = String(already || 1);
            if ($('got-modal')) $('got-modal').classList.add('is-open');
            return 'abort-modal';
          }
        } else if (action === 'share-all') {
          item.expense_share_with = state.members.map(function (m) { return m.user_id; });
          row.querySelectorAll('[data-share-id]').forEach(function (cb) { cb.checked = true; });
          return 'abort';
        } else if (action === 'save-detail') {
          // Done — apply + close (same as click-away)
          var applied = applyItemDetailFromRow(row, item);
          if (applied === 'add-category') {
            openAddCategoryModal(function (newId) {
              if (newId) item.qualifier = newId;
              try { persistItemByMeta(kind, scope, id, row); } catch (eP) {}
              state.expandedItemId = null;
              clearItemDetailEditState();
              render();
            });
            return 'abort-modal';
          }
          state.expandedItemId = null;
          if (normalizeNotes(item).length) state.noteItemId = id;
          else state.noteItemId = null;
          clearItemDetailEditState();
          // fall through to save + re-render
        }
        return null;
      }

      function doDeleteAndSave(bucket, index, saveFn) {
        var title = bucket[index] && bucket[index].title;
        var delId = id;
        appConfirm('Delete “' + (title || 'item') + '”?', 'Delete item').then(function (ok) {
          if (!ok) return;
          // #93: re-resolve index by id (async confirm can race re-renders)
          var idx = -1;
          if (Array.isArray(bucket)) {
            idx = bucket.findIndex(function (x) { return x && String(x.id) === String(delId); });
            if (idx < 0 && index >= 0 && index < bucket.length) idx = index;
          }
          if (idx < 0) {
            appToast('Could not delete — item not found');
            return;
          }
          bucket.splice(idx, 1);
          if (state.moveItemId === delId) state.moveItemId = null;
          if (state.noteItemId === delId) state.noteItemId = null;
          if (state.expandedItemId === delId || String(state.expandedItemId) === String(delId)) {
            state.expandedItemId = null;
            clearItemDetailEditState();
          }
          try { delete state.minimizedItems[delId]; } catch (eM) {}
          try {
            if (saveFn) saveFn();
          } catch (eSv) {
            console.warn('delete save', eSv);
          }
          try { render(); } catch (eR) { console.warn(eR); }
          appToast('Deleted');
        });
      }

      if (scope === 'personal-board' || scope === 'free-list') {
        // Named list: look up by the row's column (data-kind) — works for todo/buy/bring/custom/My checklist
        var namedList = resolveOpenNamedList(row) || findNamedListById(state.activeNamedListId);
        if (namedList) {
          sanitizeNamedList(namedList);
          var hit = resolveNamedListItemHit(namedList, kind, id);
          if (hit) {
            // Keep listTab on classic columns; My checklist stays personal
            if (hit.colId && String(hit.colId) !== 'personal') state.listTab = hit.colId;
            else if (kind && String(kind) !== 'personal') state.listTab = kind;
            var rN = mutateBucket(hit.bucket, hit.item, hit.index);
            if (rN === 'abort-async-del') {
              doDeleteAndSave(hit.bucket, hit.index, function () {
                // Persist list after splice (bucket is live column.items)
                try { saveNamedList(hit.list); } catch (e1) {
                  try { saveNamedListItemHit(hit); } catch (e2) {}
                }
              });
              return;
            }
            if (rN === 'abort' || rN === 'abort-modal' || rN === 'abort-moved') return;
            if (rN === 'rerender-only') {
              // Expand/options for checklist still need private/personal mirrors saved when claims change
              if (hit.isChecklist || hit.isPrivateOnly || String(hit.colId) === 'personal') {
                try { saveNamedListItemHit(hit); } catch (eSv) {}
              }
              render();
              return;
            }
            saveNamedListItemHit(hit);
            render();
            return;
          }
        }
        var free = getActiveFreeBucket(kind);
        var arr = free.bucket || [];
        var idx = arr.findIndex(function (x) { return String(x.id) === String(id); });
        if (idx < 0) {
          var board = loadPersonalBoard();
          arr = board[kind] || [];
          idx = arr.findIndex(function (x) { return String(x.id) === String(id); });
          if (idx < 0) return;
          var r0 = mutateBucket(arr, arr[idx], idx);
          if (r0 === 'abort-async-del') {
            doDeleteAndSave(arr, idx, function () {
              board[kind] = arr;
              savePersonalBoard(board);
            });
            return;
          }
          if (r0 === 'abort' || r0 === 'abort-modal' || r0 === 'abort-moved') return;
          if (r0 === 'rerender-only') { render(); return; }
          board[kind] = arr;
          savePersonalBoard(board);
          render();
          return;
        }
        var r1 = mutateBucket(arr, arr[idx], idx);
        if (r1 === 'abort-async-del') {
          doDeleteAndSave(arr, idx, function () {
            if (free.named) saveNamedList(free.named);
            else saveFreeListsStore(free.store);
            if (state.mode === 'personal' && !state.activeNamedListId) {
              var pb = loadPersonalBoard();
              pb[kind] = free.store.personal && free.store.personal[kind] || arr;
              savePersonalBoard(pb);
            }
          });
          return;
        }
        if (r1 === 'abort' || r1 === 'abort-modal' || r1 === 'abort-moved') return;
        if (r1 === 'rerender-only') { render(); return; }
        if (free.named) saveNamedList(free.named);
        else saveFreeListsStore(free.store);
        if (state.mode === 'personal' && !state.activeNamedListId) {
          var pb2 = loadPersonalBoard();
          pb2[kind] = free.store.personal && free.store.personal[kind] || arr;
          savePersonalBoard(pb2);
        }
        render();
        return;
      }

      var event = activeEvent();
      if (!event) return;
      var found = findItem(event, kind, scope, id);
      if (!found.item) return;
      var r2 = mutateBucket(found.bucket, found.item, found.index);
      if (r2 === 'abort-async-del') {
        doDeleteAndSave(found.bucket, found.index, function () { saveActiveEvent(); });
        return;
      }
      if (r2 === 'abort' || r2 === 'abort-modal' || r2 === 'abort-moved') return;
      if (r2 === 'rerender-only') { render(); return; }
      saveActiveEvent();
      render();
    });
  }

  function consumeJoinQuery() {
    try {
      var u = new URL(location.href);
      var code = (u.searchParams.get('join') || '').replace(/\D/g, '').slice(0, 6);
      if (code.length === 6) {
        u.searchParams.delete('join');
        history.replaceState({}, '', u.pathname + (u.search || '') + (u.hash || ''));
        setTimeout(function () {
          joinEvent(code).catch(function (e) { appAlert(e.message || String(e), 'Join failed'); });
        }, 400);
      }
    } catch (e) {}
  }

  var prevPlan = window.PlanSlayerApp || {};
  window.PlanSlayerApp = {
    toast: appToast,
    alert: appAlert,
    confirm: appConfirm,
    prompt: appPrompt,
    onAuth: function (user, profile) {
      state.user = user;
      state.profile = profile;
      loadFriends();
      mergeInboxIntoPersonal();
      configurePlanMap();
      loadEvents().then(function () {
        setMapMode(state.mapMode || 'button');
        if (window.PlanMap) {
          window.PlanMap.ensure();
          window.PlanMap.redraw();
        }
        consumeJoinQuery();
      });
    },
    onSignOut: function () {
      state.user = null;
      state.events = [];
      state.activeEventId = null;
      state.view = 'home';
      setMapMode('button');
      render();
    },
    version: APP_VERSION,
    huntKitSource: HUNT_KIT_SOURCE,
    openQuickLoadMenu: openQuickLoadMenu,
    clearEventPinsFilter: clearEventPinsFilter,
    resyncHunt: function () { return resyncHuntEventsNow({ quiet: false }); }
  };

  function bootPlanSlayer() {
    maybeCleanSlateThisBuild();
    loadFriends();
    configurePlanMap();
    // Hide coords immediately (before map open) — only Map settings can re-enable
    try { applyCoordHudVisibility(false); } catch (eHud) {}
    try {
      if (loadMapSettings().coordHud) applyCoordHudVisibility(true);
    } catch (eHud2) {}
    wireCrossTabSync();
    wire();
    setMapMode('button'); // default: Map button (minimized), not open
    // Recover photo OCR items if the last tab closed mid-review (#52)
    setTimeout(function () {
      try { tryRestoreOcrPhotoDraft(); } catch (eR) {}
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPlanSlayer);
  } else {
    bootPlanSlayer();
  }
})();
