/* PlanSlayer V1.0 — event planning lists, invites, expenses, simple map */
(function () {
  'use strict';

  var APP_VERSION = '1.0.0';
  var LOCAL_EVENTS_KEY = 'plan_slayer_events_v1';
  var LOCAL_PERSONAL_KEY = 'plan_slayer_personal_v1';
  var LOCAL_SAVED_KEY = 'plan_slayer_saved_lists_v1';
  var COLORS = ['#e11d1d', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#0891b2', '#db2777'];

  var state = {
    user: null,
    profile: null,
    events: [],
    activeEventId: null,
    view: 'home', // home | event | personal | calendar
    sort: 'soonest', // soonest | furthest | alpha | search
    search: '',
    listTab: 'todo', // todo | buy | bring
    scopeTab: 'group', // group | personal
    members: [],
    map: null,
    mapMarker: null
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function uid() {
    return 'i_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
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
    var p = state.profile || (window.PlanSlayerAuth && window.PlanSlayerAuth.getProfile && window.PlanSlayerAuth.getProfile());
    if (p && (p.display_name || p.username)) return p.display_name || p.username;
    var u = me();
    return (u && u.email) ? String(u.email).split('@')[0] : 'You';
  }
  function myColor() {
    var p = state.profile;
    return (p && p.arrow_color) || '#e11d1d';
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
    });
    if (!Array.isArray(ev.state.expenses)) ev.state.expenses = [];
    return ev;
  }

  function activeEvent() {
    return state.events.find(function (e) { return String(e.id) === String(state.activeEventId); }) || null;
  }

  /* ---------- settlement: minimize transfers so everyone paid equally ---------- */
  function settleBalances(members, expenses) {
    // members: [{id, name}], expenses: [{payerId, amount, shareWith: [ids]|null (all)}]
    var ids = members.map(function (m) { return m.id; });
    var paid = {};
    var owed = {};
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
    var net = {};
    ids.forEach(function (id) {
      net[id] = (paid[id] || 0) - (owed[id] || 0);
    });
    var debtors = [];
    var creditors = [];
    ids.forEach(function (id) {
      var n = Math.round(net[id] * 100) / 100;
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
    return { net: net, transfers: transfers, paid: paid, owed: owed };
  }

  function memberLabel(id) {
    var m = state.members.find(function (x) { return String(x.user_id || x.id) === String(id); });
    if (m) return m.display_name || m.username || 'Member';
    if (String(id) === String(myId())) return myName();
    return String(id).slice(0, 8);
  }

  function memberColor(id) {
    var m = state.members.find(function (x) { return String(x.user_id || x.id) === String(id); });
    if (m && m.arrow_color) return m.arrow_color;
    if (String(id) === String(myId())) return myColor();
    var idx = Math.abs(String(id).split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0)) % COLORS.length;
    return COLORS[idx];
  }

  /* ---------- persistence ---------- */
  function persistLocal() {
    saveJson(LOCAL_EVENTS_KEY, state.events);
  }

  async function cloudListEvents() {
    var client = sb();
    var user = me();
    if (!client || !user) return null;
    try {
      var res = await client.rpc('list_my_plan_events');
      if (res.error) {
        // tables may not exist yet — fall back local
        console.warn('list_my_plan_events', res.error.message);
        return null;
      }
      return (res.data || []).map(normalizeEvent);
    } catch (e) {
      return null;
    }
  }

  async function cloudSaveEvent(ev) {
    var client = sb();
    var user = me();
    if (!client || !user || !ev) return;
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
    } catch (e) {
      console.warn('cloudSaveEvent', e);
    }
  }

  async function loadEvents() {
    var local = loadJson(LOCAL_EVENTS_KEY, []);
    if (!Array.isArray(local)) local = [];
    state.events = local.map(normalizeEvent);
    var cloud = await cloudListEvents();
    if (cloud && cloud.length) {
      // merge by id — cloud wins on updated_at
      var byId = {};
      state.events.forEach(function (e) { byId[e.id] = e; });
      cloud.forEach(function (e) {
        var prev = byId[e.id];
        if (!prev || new Date(e.updated_at || 0) >= new Date(prev.updated_at || 0)) {
          byId[e.id] = normalizeEvent(e);
        }
      });
      state.events = Object.keys(byId).map(function (k) { return byId[k]; });
      persistLocal();
    }
    render();
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
      } catch (e) {
        console.warn(e);
      }
    }
    if (!ev) {
      ev = normalizeEvent({
        id: uid(),
        owner_user_id: user.id,
        name: name || 'Untitled event',
        event_type: eventType || 'general',
        start_at: startAt || null,
        invite_code: String(Math.floor(100000 + Math.random() * 900000)),
        state: { lists: emptyLists(), expenses: [] },
        updated_at: new Date().toISOString(),
        _localOnly: true
      });
    }
    if (useTemplate) {
      applyTemplateToEvent(ev, eventType);
    }
    state.events.unshift(ev);
    persistLocal();
    await cloudSaveEvent(ev);
    state.activeEventId = ev.id;
    state.view = 'event';
    await loadMembers(ev.id);
    render();
    return ev;
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
          return Object.assign({}, it, { id: uid(), claims: {}, created_by: myId() });
        });
      }
    });
    // last members for this type (local hint)
    var last = state.events.find(function (e) {
      return e.id !== ev.id && String(e.event_type || '').toLowerCase() === type;
    });
    if (last && last._lastMemberHint) ev._memberHint = last._lastMemberHint;
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
      state.activeEventId = ev.id;
      state.view = 'event';
      await loadMembers(ev.id);
      render();
      return ev;
    }
    // local-only join against known events
    var found = state.events.find(function (e) { return String(e.invite_code) === code; });
    if (!found) throw new Error('Event not found (cloud required to join remote codes)');
    state.activeEventId = found.id;
    state.view = 'event';
    render();
    return found;
  }

  async function loadMembers(eventId) {
    state.members = [];
    var client = sb();
    if (!client || !eventId) {
      state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
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
      state.members = rows.map(function (r) {
        var p = profs[r.user_id] || {};
        return {
          user_id: r.user_id,
          role: r.role,
          arrow_color: r.arrow_color || p.arrow_color || '#e11d1d',
          username: p.username,
          display_name: p.display_name || p.username || 'Hunter'
        };
      });
      if (!state.members.length) {
        state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
      }
    } catch (e) {
      state.members = [{ user_id: myId(), display_name: myName(), arrow_color: myColor(), role: 'owner' }];
    }
  }

  /* ---------- list item helpers ---------- */
  function getListBucket(ev, kind, scope) {
    var lists = ev.state.lists[kind];
    if (scope === 'group') return lists.group;
    var pid = myId() || 'local';
    if (!lists.personal[pid]) lists.personal[pid] = [];
    return lists.personal[pid];
  }

  function allTitlesForSuggest(ev, exceptKind) {
    var out = [];
    ['todo', 'buy', 'bring'].forEach(function (k) {
      if (exceptKind && k === exceptKind) return;
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
      title: title,
      notes: '',
      qty: 1,
      priority: 0, // 0 normal, 1 high, 2 urgent
      highlight: false,
      shared_expense: false,
      expense_amount: 0,
      expense_share_with: [],
      claims: {}, // userId -> qty claimed
      due_mode: 'anytime_before', // anytime_before | anytime_during | days_before
      due_days: 0,
      created_by: myId(),
      created_at: new Date().toISOString()
    }, extras);
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

  function claimBarHtml(item) {
    var c = claimsFilled(item);
    if (!c.parts.length) {
      return '<div class="claim-bar empty" title="0 / ' + c.need + '"><span class="claim-empty" style="width:100%"></span></div>';
    }
    var segs = c.parts.map(function (p) {
      var w = (p.qty / c.need) * 100;
      return '<span style="width:' + w + '%;background:' + p.color + '" title="' + esc(memberLabel(p.uid)) + ': ' + p.qty + '"></span>';
    }).join('');
    var rest = Math.max(0, 100 - c.pct);
    if (rest > 0.5) segs += '<span class="claim-empty" style="width:' + rest + '%"></span>';
    return '<div class="claim-bar" title="' + c.total + ' / ' + c.need + '">' + segs + '</div>';
  }

  function saveActiveEvent() {
    var ev = activeEvent();
    if (!ev) return;
    ev.updated_at = new Date().toISOString();
    persistLocal();
    cloudSaveEvent(ev);
  }

  /* ---------- render ---------- */
  function countdownHtml(startAt) {
    if (!startAt) return '<span class="muted">No start time</span>';
    var t = new Date(startAt).getTime() - Date.now();
    if (isNaN(t)) return '';
    if (t <= 0) return '<span class="cd-live">Started / past</span>';
    var mins = Math.floor(t / 60000);
    var days = Math.floor(mins / (60 * 24));
    var hours = Math.floor((mins % (60 * 24)) / 60);
    var m = mins % 60;
    return '<span class="cd">' + days + 'd ' + hours + 'h ' + m + 'm</span>';
  }

  function sortedEvents() {
    var list = state.events.slice();
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
        var ta = a.start_at ? new Date(a.start_at).getTime() : 0;
        var tb = b.start_at ? new Date(b.start_at).getTime() : 0;
        return tb - ta;
      });
    } else {
      // soonest first
      list.sort(function (a, b) {
        var ta = a.start_at ? new Date(a.start_at).getTime() : Number.MAX_SAFE_INTEGER;
        var tb = b.start_at ? new Date(b.start_at).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    }
    return list;
  }

  function renderHome() {
    var list = sortedEvents();
    var html = list.map(function (e) {
      return (
        '<button type="button" class="event-card" data-open-event="' + esc(e.id) + '">' +
          '<div class="ec-top"><strong>' + esc(e.name) + '</strong>' +
          '<span class="ec-type">' + esc(e.event_type || 'general') + '</span></div>' +
          '<div class="ec-meta">' + countdownHtml(e.start_at) +
          (e.start_at ? ' · ' + esc(new Date(e.start_at).toLocaleString()) : '') + '</div>' +
          (e.invite_code ? '<div class="ec-code">Code ' + esc(e.invite_code) + '</div>' : '') +
        '</button>'
      );
    }).join('') || '<p class="empty">No events yet. Create one or join with a 6-digit code.</p>';
    $('view-home-list').innerHTML = html;
  }

  function renderItemRow(item, kind, scope) {
    var c = claimsFilled(item);
    var mine = Number((item.claims || {})[myId()] || 0);
    var pri = item.priority > 0 ? (' pri-' + item.priority) : '';
    var hi = item.highlight ? ' is-highlight' : '';
    var due = '';
    if (kind === 'todo') {
      if (item.due_mode === 'days_before') due = '<span class="chip">Due ' + (item.due_days || 0) + 'd before</span>';
      else if (item.due_mode === 'anytime_during') due = '<span class="chip">During event</span>';
      else due = '<span class="chip">Anytime before</span>';
    }
    return (
      '<div class="list-item' + pri + hi + '" data-item-id="' + esc(item.id) + '" data-kind="' + kind + '" data-scope="' + scope + '" draggable="true">' +
        '<div class="li-drag" title="Drag to reorder">⋮⋮</div>' +
        '<div class="li-main">' +
          '<div class="li-title-row">' +
            '<span class="li-title">' + esc(item.title) + '</span>' +
            '<span class="li-qty">×' + (item.qty || 1) + '</span>' +
            (item.shared_expense ? '<span class="chip exp">Shared $' + (Number(item.expense_amount) || 0).toFixed(2) + '</span>' : '') +
          '</div>' +
          claimBarHtml(item) +
          (item.notes ? '<div class="li-notes">' + esc(item.notes) + '</div>' : '') +
          due +
        '</div>' +
        '<div class="li-actions">' +
          '<button type="button" class="btn-got' + (mine > 0 ? ' is-on' : '') + '" data-act="got" title="Got it!">Got it!</button>' +
          '<button type="button" class="btn-icon" data-act="edit" title="Edit">✎</button>' +
          '<button type="button" class="btn-icon" data-act="up" title="Move up">↑</button>' +
          '<button type="button" class="btn-icon" data-act="down" title="Move down">↓</button>' +
          '<button type="button" class="btn-icon danger" data-act="del" title="Delete">×</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEvent() {
    var ev = activeEvent();
    if (!ev) {
      state.view = 'home';
      render();
      return;
    }
    $('ev-title').textContent = ev.name || 'Event';
    $('ev-type').textContent = ev.event_type || 'general';
    $('ev-countdown').innerHTML = countdownHtml(ev.start_at);
    $('ev-code').textContent = ev.invite_code ? ('Invite code: ' + ev.invite_code) : '';
    $('ev-start').textContent = ev.start_at ? new Date(ev.start_at).toLocaleString() : 'No start set';

    // members
    $('ev-members').innerHTML = state.members.map(function (m) {
      return '<span class="member-chip" style="border-color:' + esc(m.arrow_color || '#888') + '">' +
        '<i style="background:' + esc(m.arrow_color || '#888') + '"></i>' +
        esc(m.display_name || m.username || 'Member') +
        (m.role === 'owner' ? ' · host' : '') +
      '</span>';
    }).join('') || '<span class="muted">Just you</span>';

    // list tabs
    document.querySelectorAll('[data-list-tab]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-list-tab') === state.listTab);
    });
    document.querySelectorAll('[data-scope-tab]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-scope-tab') === state.scopeTab);
    });

    var bucket = getListBucket(ev, state.listTab, state.scopeTab);
    // sort: priority desc, then order
    var items = bucket.slice().sort(function (a, b) {
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      return 0;
    });
    // keep visual order as array order for drag — re-sort only for display of priority at top
    items = bucket.slice().sort(function (a, b) {
      var pa = a.priority || 0, pb = b.priority || 0;
      if (pb !== pa) return pb - pa;
      return bucket.indexOf(a) - bucket.indexOf(b);
    });
    $('ev-list').innerHTML = items.map(function (it) {
      return renderItemRow(it, state.listTab, state.scopeTab);
    }).join('') || '<p class="empty">Nothing here yet. Add an item below.</p>';

    renderExpenses(ev);
    renderMap(ev);
  }

  function renderExpenses(ev) {
    var box = $('ev-settle');
    if (!box) return;
    var members = state.members.map(function (m) {
      return { id: m.user_id, name: m.display_name || m.username };
    });
    // Build expenses from items marked shared_expense with amount
    var expenses = [];
    ['todo', 'buy', 'bring'].forEach(function (kind) {
      (ev.state.lists[kind].group || []).forEach(function (it) {
        if (it.shared_expense && Number(it.expense_amount) > 0) {
          expenses.push({
            payerId: it.created_by || myId(),
            amount: Number(it.expense_amount),
            shareWith: (it.expense_share_with && it.expense_share_with.length) ? it.expense_share_with : null,
            title: it.title
          });
        }
      });
    });
    (ev.state.expenses || []).forEach(function (ex) {
      expenses.push(ex);
    });
    if (!expenses.length) {
      box.innerHTML = '<p class="muted">Mark list items as shared expense with an amount to settle who owes whom.</p>';
      return;
    }
    var result = settleBalances(members, expenses);
    var meId = myId();
    var lines = result.transfers.map(function (t) {
      var mine = String(t.from) === String(meId) || String(t.to) === String(meId);
      var text = esc(memberLabel(t.from)) + ' → ' + esc(memberLabel(t.to)) + ': <strong>$' + t.amount.toFixed(2) + '</strong>';
      if (String(t.from) === String(meId)) text = 'You pay ' + esc(memberLabel(t.to)) + ' <strong>$' + t.amount.toFixed(2) + '</strong>';
      if (String(t.to) === String(meId)) text = esc(memberLabel(t.from)) + ' pays you <strong>$' + t.amount.toFixed(2) + '</strong>';
      return '<div class="settle-line' + (mine ? ' is-mine' : '') + '">' + text + '</div>';
    }).join('');
    box.innerHTML = '<h4>Settle up</h4>' + (lines || '<p class="muted">Already even.</p>');
  }

  function renderMap(ev) {
    var wrap = $('ev-map');
    if (!wrap || typeof L === 'undefined') return;
    if (!state.map) {
      state.map = L.map('ev-map', { zoomControl: true, attributionControl: true });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri'
      }).addTo(state.map);
      setTimeout(function () { try { state.map.invalidateSize(); } catch (e) {} }, 200);
    }
    var lat = ev.lat != null ? Number(ev.lat) : 32.8;
    var lng = ev.lng != null ? Number(ev.lng) : -86.8;
    var z = (ev.lat != null) ? 12 : 6;
    state.map.setView([lat, lng], z);
    if (state.mapMarker) {
      try { state.map.removeLayer(state.mapMarker); } catch (e) {}
    }
    if (ev.lat != null && ev.lng != null) {
      state.mapMarker = L.marker([lat, lng]).addTo(state.map);
      if (ev.location_label) state.mapMarker.bindPopup(esc(ev.location_label));
    }
    state.map.off('click');
    state.map.on('click', function (e) {
      ev.lat = e.latlng.lat;
      ev.lng = e.latlng.lng;
      if (!ev.location_label) ev.location_label = 'Map pin';
      saveActiveEvent();
      renderMap(ev);
    });
  }

  function renderPersonal() {
    var board = loadJson(LOCAL_PERSONAL_KEY, { todo: [], buy: [], bring: [] });
    var kind = state.listTab;
    var items = board[kind] || [];
    $('personal-list').innerHTML = items.map(function (it) {
      return renderItemRow(it, kind, 'personal-board');
    }).join('') || '<p class="empty">Your personal ' + kind + ' list is empty.</p>';
  }

  function renderCalendar() {
    var box = $('view-calendar-list');
    var byDay = {};
    state.events.forEach(function (e) {
      if (!e.start_at) return;
      var d = new Date(e.start_at);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(e);
    });
    var keys = Object.keys(byDay).sort();
    box.innerHTML = keys.map(function (k) {
      return '<div class="cal-day"><h4>' + esc(k) + '</h4>' +
        byDay[k].map(function (e) {
          return '<button type="button" class="event-card compact" data-open-event="' + esc(e.id) + '">' +
            '<strong>' + esc(e.name) + '</strong> · ' + esc(e.event_type || '') +
            ' · ' + countdownHtml(e.start_at) + '</button>';
        }).join('') + '</div>';
    }).join('') || '<p class="empty">No dated events yet.</p>';
  }

  function render() {
    document.querySelectorAll('[data-view]').forEach(function (el) {
      el.style.display = el.getAttribute('data-view') === state.view ? '' : 'none';
    });
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-nav') === state.view);
    });
    var who = $('user-chip');
    if (who) who.textContent = myName();
    if (state.view === 'home') renderHome();
    else if (state.view === 'event') renderEvent();
    else if (state.view === 'personal') renderPersonal();
    else if (state.view === 'calendar') renderCalendar();
  }

  /* ---------- interactions ---------- */
  function openAddItemModal(prefill) {
    var title = prompt('Item name:', prefill || '');
    if (!title || !title.trim()) return null;
    return title.trim();
  }

  async function addItemFlow() {
    var ev = activeEvent();
    if (!ev && state.view !== 'personal') return;
    var kind = state.listTab;
    var scope = state.scopeTab;
    var title = openAddItemModal();
    if (!title) return;

    // suggestions from other lists
    if (ev) {
      var matches = allTitlesForSuggest(ev, null).filter(function (m) {
        return m.title.toLowerCase().indexOf(title.toLowerCase()) >= 0;
      }).slice(0, 6);
      if (matches.length) {
        console.log('Similar items:', matches.map(function (m) { return m.title + ' (' + m.kind + ')'; }));
      }
    }

    var qty = prompt('How many?', '1');
    qty = Math.max(1, parseInt(qty, 10) || 1);

    if (state.view === 'personal') {
      var board = loadJson(LOCAL_PERSONAL_KEY, { todo: [], buy: [], bring: [] });
      if (!board[kind]) board[kind] = [];
      board[kind].push(newItem(title, { qty: qty }));
      saveJson(LOCAL_PERSONAL_KEY, board);
      render();
      return;
    }

    // Bring list: own it?
    if (kind === 'bring') {
      var buyBucket = getListBucket(ev, 'buy', scope);
      var alreadyBuy = buyBucket.some(function (it) {
        return String(it.title).toLowerCase() === title.toLowerCase();
      });
      if (!alreadyBuy) {
        var own = confirm('Do you already own “' + title + '”?\n\nOK = Yes (only add to Bring)\nCancel = No (also add to Buy)');
        if (!own) {
          buyBucket.push(newItem(title, { qty: qty }));
        }
      }
    }

    var bucket = getListBucket(ev, kind, scope);
    var item = newItem(title, { qty: qty });
    if (kind === 'todo') {
      var due = prompt('Due: days before event (number), or leave blank for anytime before. Type "during" for during event.', '');
      if (due && String(due).toLowerCase() === 'during') {
        item.due_mode = 'anytime_during';
      } else if (due && !isNaN(parseInt(due, 10))) {
        item.due_mode = 'days_before';
        item.due_days = Math.max(0, parseInt(due, 10));
      }
    }
    bucket.push(item);
    saveActiveEvent();
    render();
  }

  function findItem(ev, kind, scope, id) {
    var bucket = getListBucket(ev, kind, scope);
    return { bucket: bucket, item: bucket.find(function (x) { return x.id === id; }), index: bucket.findIndex(function (x) { return x.id === id; }) };
  }

  function onGotIt(item) {
    var need = Math.max(1, Number(item.qty) || 1);
    var already = Number((item.claims || {})[myId()] || 0);
    var left = need - claimsFilled(item).total + already;
    var ans = prompt('How many are you covering? (max ' + Math.max(left, already) + ')', String(already || Math.min(1, left)));
    if (ans == null) return;
    var n = parseInt(ans, 10);
    if (isNaN(n) || n < 0) n = 0;
    if (!item.claims) item.claims = {};
    if (n === 0) delete item.claims[myId()];
    else item.claims[myId()] = n;
  }

  function editItem(item, kind) {
    var title = prompt('Title', item.title);
    if (title == null) return;
    item.title = title.trim() || item.title;
    var notes = prompt('Notes', item.notes || '');
    if (notes != null) item.notes = notes;
    var qty = prompt('Quantity', String(item.qty || 1));
    if (qty != null) item.qty = Math.max(1, parseInt(qty, 10) || 1);
    var pri = prompt('Priority 0=normal, 1=high, 2=urgent', String(item.priority || 0));
    if (pri != null) item.priority = Math.max(0, Math.min(2, parseInt(pri, 10) || 0));
    item.highlight = confirm('Highlight this item? (OK=yes, Cancel=no)');
    item.shared_expense = confirm('Shared expense? (OK=yes)');
    if (item.shared_expense) {
      var amt = prompt('Amount spent ($)', String(item.expense_amount || 0));
      item.expense_amount = Math.max(0, parseFloat(amt) || 0);
      item.created_by = item.created_by || myId();
      var all = confirm('Share with ALL members? (OK=all, Cancel=only you for now — edit share list later in V1.1)');
      if (all) {
        item.expense_share_with = state.members.map(function (m) { return m.user_id; });
      } else {
        item.expense_share_with = [myId()];
      }
    }
    if (kind === 'todo') {
      var due = prompt('Due mode: blank=anytime before, "during", or days number', item.due_mode === 'days_before' ? String(item.due_days) : (item.due_mode === 'anytime_during' ? 'during' : ''));
      if (due != null) {
        if (String(due).toLowerCase() === 'during') item.due_mode = 'anytime_during';
        else if (due === '') item.due_mode = 'anytime_before';
        else if (!isNaN(parseInt(due, 10))) {
          item.due_mode = 'days_before';
          item.due_days = Math.max(0, parseInt(due, 10));
        }
      }
    }
  }

  function wire() {
    $('btn-create-event').onclick = function () {
      var name = prompt('Event name');
      if (!name) return;
      var type = prompt('Event type (e.g. camping, birthday, hunt weekend)', 'camping');
      var start = prompt('Start date/time (YYYY-MM-DD or leave blank)', '');
      var startAt = null;
      if (start) {
        var d = new Date(start);
        if (!isNaN(d.getTime())) startAt = d.toISOString();
      }
      var useTpl = confirm('Load saved lists / style from last “' + (type || 'general') + '” event if available?');
      createEvent(name, type || 'general', startAt, useTpl).catch(function (e) {
        alert(e.message || e);
      });
    };
    $('btn-join-event').onclick = function () {
      var code = prompt('6-digit invite code');
      if (!code) return;
      joinEvent(code).catch(function (e) { alert(e.message || e); });
    };
    $('ev-back').onclick = function () {
      state.view = 'home';
      state.activeEventId = null;
      render();
    };
    $('btn-add-item').onclick = function () { addItemFlow(); };
    $('btn-save-list').onclick = function () {
      var ev = activeEvent();
      if (!ev) return;
      var kind = state.listTab;
      var scope = state.scopeTab;
      var bucket = getListBucket(ev, kind, scope);
      var name = prompt('Save list as', (ev.event_type || 'list') + ' ' + kind);
      if (!name) return;
      var saved = loadJson(LOCAL_SAVED_KEY, []);
      saved.push({
        id: uid(),
        name: name,
        event_type: ev.event_type,
        list_kind: kind,
        items: bucket.map(function (it) {
          return { title: it.title, qty: it.qty, notes: it.notes, priority: it.priority };
        }),
        created_at: new Date().toISOString()
      });
      saveJson(LOCAL_SAVED_KEY, saved);
      // also try cloud
      var client = sb();
      if (client && myId()) {
        client.from('plan_saved_lists').insert({
          user_id: myId(),
          name: name,
          event_type: ev.event_type,
          list_kind: kind,
          items: bucket
        }).then(function () {});
      }
      alert('List saved for future “' + (ev.event_type || '') + '” events.');
    };
    $('btn-copy-code').onclick = function () {
      var ev = activeEvent();
      if (!ev || !ev.invite_code) return;
      var url = location.origin + location.pathname + '?join=' + ev.invite_code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          alert('Invite link copied:\n' + url);
        }).catch(function () { prompt('Copy invite link:', url); });
      } else prompt('Copy invite link:', url);
    };
    $('sort-select').onchange = function () {
      state.sort = $('sort-select').value;
      render();
    };
    $('search-input').oninput = function () {
      state.search = $('search-input').value;
      render();
    };
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.onclick = function () {
        state.view = b.getAttribute('data-nav');
        render();
      };
    });
    document.querySelectorAll('[data-list-tab]').forEach(function (b) {
      b.onclick = function () {
        state.listTab = b.getAttribute('data-list-tab');
        render();
      };
    });
    document.querySelectorAll('[data-scope-tab]').forEach(function (b) {
      b.onclick = function () {
        state.scopeTab = b.getAttribute('data-scope-tab');
        render();
      };
    });

    document.body.addEventListener('click', function (ev) {
      var open = ev.target.closest('[data-open-event]');
      if (open) {
        state.activeEventId = open.getAttribute('data-open-event');
        state.view = 'event';
        loadMembers(state.activeEventId).then(render);
        return;
      }
      var row = ev.target.closest('.list-item');
      if (!row) return;
      var act = ev.target.closest('[data-act]');
      if (!act) return;
      var id = row.getAttribute('data-item-id');
      var kind = row.getAttribute('data-kind');
      var scope = row.getAttribute('data-scope');
      var action = act.getAttribute('data-act');

      if (scope === 'personal-board') {
        var board = loadJson(LOCAL_PERSONAL_KEY, { todo: [], buy: [], bring: [] });
        var arr = board[kind] || [];
        var idx = arr.findIndex(function (x) { return x.id === id; });
        if (idx < 0) return;
        var it = arr[idx];
        if (action === 'del') arr.splice(idx, 1);
        else if (action === 'up' && idx > 0) { arr[idx] = arr[idx - 1]; arr[idx - 1] = it; }
        else if (action === 'down' && idx < arr.length - 1) { arr[idx] = arr[idx + 1]; arr[idx + 1] = it; }
        else if (action === 'edit') editItem(it, kind);
        else if (action === 'got') onGotIt(it);
        board[kind] = arr;
        saveJson(LOCAL_PERSONAL_KEY, board);
        render();
        return;
      }

      var event = activeEvent();
      if (!event) return;
      var found = findItem(event, kind, scope, id);
      if (!found.item) return;
      if (action === 'del') found.bucket.splice(found.index, 1);
      else if (action === 'up' && found.index > 0) {
        found.bucket[found.index] = found.bucket[found.index - 1];
        found.bucket[found.index - 1] = found.item;
      } else if (action === 'down' && found.index < found.bucket.length - 1) {
        found.bucket[found.index] = found.bucket[found.index + 1];
        found.bucket[found.index + 1] = found.item;
      } else if (action === 'edit') editItem(found.item, kind);
      else if (action === 'got') onGotIt(found.item);
      saveActiveEvent();
      render();
    });

    // typeahead on add field
    var addInput = $('add-item-input');
    if (addInput) {
      addInput.addEventListener('input', function () {
        var ev = activeEvent();
        var box = $('add-suggest');
        if (!ev || !box) return;
        var q = addInput.value.trim().toLowerCase();
        if (q.length < 2) { box.innerHTML = ''; return; }
        var hits = allTitlesForSuggest(ev).filter(function (m) {
          return m.title.toLowerCase().indexOf(q) >= 0;
        }).slice(0, 8);
        box.innerHTML = hits.map(function (h) {
          return '<button type="button" class="suggest-item" data-suggest="' + esc(h.title) + '">' +
            esc(h.title) + ' <span class="muted">(' + h.kind + ' · ' + h.scope + ')</span></button>';
        }).join('');
      });
      document.body.addEventListener('click', function (e) {
        var s = e.target.closest('[data-suggest]');
        if (!s) return;
        $('add-item-input').value = s.getAttribute('data-suggest');
        $('add-suggest').innerHTML = '';
      });
    }
    $('btn-add-from-input') && ($('btn-add-from-input').onclick = function () {
      var t = $('add-item-input') && $('add-item-input').value.trim();
      if (!t) return addItemFlow();
      var ev = activeEvent();
      if (!ev) return;
      var kind = state.listTab;
      var scope = state.scopeTab;
      if (kind === 'bring') {
        var buyBucket = getListBucket(ev, 'buy', scope);
        var alreadyBuy = buyBucket.some(function (it) {
          return String(it.title).toLowerCase() === t.toLowerCase();
        });
        if (!alreadyBuy) {
          var own = confirm('Do you already own “' + t + '”?\n\nOK = Yes\nCancel = No (also add to Buy)');
          if (!own) buyBucket.push(newItem(t));
        }
      }
      getListBucket(ev, kind, scope).push(newItem(t));
      $('add-item-input').value = '';
      $('add-suggest').innerHTML = '';
      saveActiveEvent();
      render();
    });
  }

  function consumeJoinQuery() {
    try {
      var u = new URL(location.href);
      var code = u.searchParams.get('join') || '';
      code = String(code).replace(/\D/g, '').slice(0, 6);
      if (code.length === 6) {
        u.searchParams.delete('join');
        history.replaceState({}, '', u.pathname + (u.search || '') + (u.hash || ''));
        setTimeout(function () {
          joinEvent(code).catch(function (e) { alert(e.message || e); });
        }, 400);
      }
    } catch (e) {}
  }

  window.PlanSlayerApp = {
    onAuth: function (user, profile) {
      state.user = user;
      state.profile = profile;
      loadEvents().then(function () {
        consumeJoinQuery();
      });
    },
    onSignOut: function () {
      state.user = null;
      state.events = [];
      state.activeEventId = null;
      state.view = 'home';
      render();
    },
    version: APP_VERSION
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
