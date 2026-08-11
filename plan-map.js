/* =============================================================================
 * PlanMap — reusable Hunt-Slayer-style map module for PlanSlayer (and future apps)
 * ----------------------------------------------------------------------------
 * Same chrome / tools / pins as Hunt Slayer, without deer-zone / public-land /
 * hunt-log features. Host app injects storage via PlanMap.configure({...}).
 * ============================================================================= */
(function (global) {
  'use strict';

  var MAP_MAX_ZOOM = 22;
  var HUNT_CENTER = [32.7794, -86.8287];
  var HUNT_ZOOM = 8;
  var HUNT_MIN_ZOOM = 8;
  var HUNT_BOUNDS = [[28.2, -91.8], [36.9, -82.2]];
  var MEASURE_LINE_COLOR = '#0a0c09';
  var MEASURE_LINE_HALO = '#f0f4ee';
  var RADAR_OPACITY = 0.55;
  var CUSTOM_COLORS_KEY = 'plan_map_custom_colors_v1';

  /* Hunt fixed presets: black, white, blue, red, yellow + seeds amber/green/purple */
  var COLOR_PRESETS_FIXED = ['#000000', '#ffffff', '#2563eb', '#dc2626', '#facc15'];
  var COLOR_PRESETS_RANDOM_SEED = ['#e59a18', '#16a34a', '#9333ea'];

  /**
   * Hunt Slayer direction markers (party kit) — frontDeg = nose-up of PNG.
   * CSS rotation = heading − frontDeg so the icon faces look-direction.
   */
  var DIR_CATALOG = [
    { id: 'arrow_head', name: 'Arrow head', src: 'icons/dir/arrow_head.png', frontDeg: 0 },
    { id: 'boat', name: 'Boat', src: 'icons/dir/boat.png', frontDeg: 0 },
    { id: 'bomb', name: 'Bomb', src: 'icons/dir/bomb.png', frontDeg: 225 },
    { id: 'bullet', name: 'Bullet', src: 'icons/dir/bullet.png', frontDeg: 0 },
    { id: 'capture', name: 'Capture', src: 'icons/dir/capture.png', frontDeg: 0 },
    { id: 'car', name: 'Car', src: 'icons/dir/car.png', frontDeg: 0 },
    { id: 'helicopter', name: 'Helicopter', src: 'icons/dir/helicopter.png', frontDeg: 0 },
    { id: 'prop_plane', name: 'Prop plane', src: 'icons/dir/prop_plane.png', frontDeg: 180 },
    { id: 'rocket', name: 'Rocket', src: 'icons/dir/rocket.png', frontDeg: 0 },
    { id: 'shuttle', name: 'Shuttle', src: 'icons/dir/shuttle.png', frontDeg: 0 },
    { id: 'speed_boat', name: 'Speed boat', src: 'icons/dir/speed_boat.png', frontDeg: 0 },
    { id: 'truck', name: 'Truck', src: 'icons/dir/truck.png', frontDeg: 0 },
    { id: 'dobbs', name: 'Dobbs', src: 'icons/dir/dobbs.png', frontDeg: 0 },
    { id: 'x_wing', name: 'X-wing', src: 'icons/dir/x_wing.png', frontDeg: 0 }
  ];
  var SHARE_ICON_KEY = 'ps_share_loc_icon';
  var SHARE_COLOR_KEY = 'ps_share_loc_color';
  var SHARE_SCALE_KEY = 'ps_share_loc_scale';
  var SHARE_PING_MS = 60000; // once a minute to group (user request)
  var _dirGlyphFilterSeq = 0;
  var _dirPickerSelected = null;
  var _dirPickerColor = '#e11d1d';
  var _dirPickerScale = 1;
  var _dirPickerOnPick = null;
  var shareHeading = null;
  var shareLastLat = null;
  var shareLastLng = null;
  var sharePingTimer = null;
  var shareHeadingHandler = null;

  var PIN_CATALOG = [
    { id: 'tent', name: 'Tent', src: 'icons/pins/tent.png' },
    { id: 'house', name: 'House', src: 'icons/pins/house.png' },
    { id: 'truck', name: 'Truck', src: 'icons/pins/truck.png' },
    { id: 'boat', name: 'Boat', src: 'icons/pins/boat.png' },
    { id: 'boat_ramp', name: 'Boat Ramp', src: 'icons/pins/boat_ramp.png' },
    { id: 'bridge', name: 'Bridge', src: 'icons/pins/bridge.png' },
    { id: 'camera', name: 'Camera', src: 'icons/pins/camera.png' },
    { id: 'food', name: 'Food', src: 'icons/pins/food.png' },
    { id: 'tree', name: 'Tree', src: 'icons/pins/tree.png' },
    { id: 'feeder', name: 'Feeder', src: 'icons/pins/feeder.png' },
    { id: 'crossing', name: 'Crossing', src: 'icons/pins/crossing.png' },
    { id: 'arrow', name: 'Arrow', src: 'icons/pins/arrow.png' },
    { id: 'prints', name: 'Prints', src: 'icons/pins/prints.png' },
    { id: 'salt', name: 'Salt', src: 'icons/pins/salt.png' },
    { id: 'scrape', name: 'Scrape', src: 'icons/pins/scrape.png' },
    { id: 'rub', name: 'Rub', src: 'icons/pins/rub.png' },
    { id: 'shed', name: 'Shed', src: 'icons/pins/shed.png' },
    { id: 'blood', name: 'Blood', src: 'icons/pins/blood.png', defaultColor: '#e43844' },
    { id: 'bow_stand', name: 'Bow Stand', src: 'icons/pins/bow_stand.png' },
    { id: 'rifle_stand', name: 'Rifle Stand', src: 'icons/pins/rifle_stand.png' },
    { id: 'bow', name: 'Bow', src: 'icons/pins/bow.png' },
    { id: 'rifle', name: 'Rifle', src: 'icons/pins/rifle.png' },
    { id: 'muzzleloader', name: 'Muzzleloader', src: 'icons/pins/muzzleloader.png' },
    { id: 'buck', name: 'Buck', src: 'icons/pins/buck.png' },
    { id: 'doe', name: 'Doe', src: 'icons/pins/doe.png' },
    { id: 'alligator', name: 'Alligator', src: 'icons/pins/alligator.png' },
    { id: 'beaver_dam', name: 'Beaver Dam', src: 'icons/pins/beaver_dam.png' },
    { id: 'deadhead', name: 'Dead Head', src: 'icons/pins/deadhead.png' },
    { id: 'dobbs', name: 'Dobbs', src: 'icons/pins/dobbs.png' }
  ];

  var api = {
    toast: function (m) { try { if (global.PlanSlayerApp && global.PlanSlayerApp.toast) global.PlanSlayerApp.toast(m); } catch (e) {} },
    alert: function (m) { return Promise.resolve(api.toast(m)); },
    confirm: function (m) { return Promise.resolve(!!global.confirm(m)); },
    getPins: function () { return []; },
    savePins: function () {},
    getEventLocation: function () { return null; },
    setEventLocation: function () {},
    /** list of events current user may set location for: [{id,name,lat,lng}] */
    listEventsForLocation: function () { return []; },
    setEventLocationById: function () { return false; },
    openCreateEvent: function () {},
    getMyId: function () { return 'local'; },
    getMyName: function () { return 'You'; },
    getMyColor: function () { return '#a34a4a'; },
    onShareLocation: function () {},
    getShareLocations: function () { return {}; },
    getBasemapKey: function () { return basemapKey || 'topo'; }
  };

  var map = null, baseLayer = null, labelsLayer = null, basemapKey = 'topo', labelsOn = false;
  var pinsLayer = null, shareLayer = null, gpsMarker = null, toolLayer = null, tempDot = null;
  var drawMode = null, drawPoints = [], tempMeasure = null, lastDrawKind = 'shape';
  var radarActive = false, radarTimer = null, radarFrames = [], radarIdx = 0, radarLayers = [null, null];
  var shareLocOn = false, shareWatch = null; // watch = local GPS; broadcast = SHARE_PING_MS
  var clickLat = null, clickLng = null;
  var pinDraft = null, pinColorSlot = 'pin';
  var selectedPinColor = '#e59a18', selectedPinInnerColor = '#ffffff', selectedPinGlyphColor = 'natural';
  var selectedPinIconId = null, pinNameAutoFill = '';
  var mapDotMenuSource = 'dot'; // 'dot' | 'gps'
  var lastMapWeatherPayload = null;
  var mapWeatherUserDismissed = false;
  var pinEditorPhotos = [];
  var PIN_PHOTO_MAX = 2;
  var RECENT_PINS_KEY = 'plan_map_recent_pin_icons_v1';
  var OFFLINE_TILE_CACHE = 'plan-slayer-tiles-v1';
  var OFFLINE_PACKS_KEY = 'plan_slayer_offline_packs_v1';
  var OFFLINE_TIERS = {
    mi2: { id: 'mi2', name: '2 miles', radiusMi: 2, zMin: 10, zMax: 15, sizeHint: '~1–10 MB' },
    mi5: { id: 'mi5', name: '5 miles', radiusMi: 5, zMin: 10, zMax: 15, sizeHint: '~15–40 MB topo' },
    mi10: { id: 'mi10', name: '10 miles', radiusMi: 10, zMin: 10, zMax: 15, sizeHint: '~25–60 MB topo' }
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function uid() { return 'p_' + Math.random().toString(36).slice(2, 10); }

  function normalizeHexColor(c) {
    if (!c) return null;
    var s = String(c).trim();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
    return s.toLowerCase();
  }
  function loadRecentCustomColors() {
    try {
      var arr = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(normalizeHexColor).filter(Boolean).slice(0, 3);
    } catch (e) { return []; }
  }
  function saveRecentCustomColor(hex) {
    hex = normalizeHexColor(hex);
    if (!hex) return;
    if (COLOR_PRESETS_FIXED.indexOf(hex) >= 0 || COLOR_PRESETS_RANDOM_SEED.indexOf(hex) >= 0) return;
    var list = loadRecentCustomColors().filter(function (c) { return c !== hex; });
    list.unshift(hex);
    try { localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(list.slice(0, 3))); } catch (e) {}
  }
  function getColorPresetRow() {
    var custom = loadRecentCustomColors();
    var row = COLOR_PRESETS_FIXED.slice();
    for (var i = 0; i < 3; i++) row.push(custom[i] || COLOR_PRESETS_RANDOM_SEED[i] || '#888888');
    return row;
  }

  /* ---------- color picker (Hunt presets + wheel) ---------- */
  function renderColorPicker(root) {
    if (!root || root._cpBuilt) return;
    root._cpBuilt = true;
    var initial = normalizeHexColor(root.getAttribute('data-initial')) || '#e59a18';
    var inputId = root.getAttribute('data-input-id');
    var input = inputId ? $(inputId) : null;
    if (input && input.value) initial = normalizeHexColor(input.value) || initial;
    root.innerHTML =
      '<div class="cp-tabs" role="tablist">' +
        '<button type="button" class="cp-tab active" data-cp-tab="presets">Presets</button>' +
        '<button type="button" class="cp-tab" data-cp-tab="wheel">Color wheel</button>' +
        '<span class="cp-current" title="Selected" style="background:' + initial + ';"></span>' +
      '</div>' +
      '<div class="cp-panel active" data-cp-panel="presets">' +
        '<div class="cp-swatches" data-role="presets"></div>' +
      '</div>' +
      '<div class="cp-panel" data-cp-panel="wheel">' +
        '<div class="cp-wheel-row">' +
          '<input type="color" value="' + initial + '" aria-label="Custom color" />' +
          '<span class="cp-wheel-hint">Last 3 custom colors fill the extra preset slots.</span>' +
        '</div>' +
      '</div>';
    root.setAttribute('data-value', initial);

    function fillPresets(selectHex) {
      var row = root.querySelector('[data-role="presets"]');
      if (!row) return;
      row.innerHTML = '';
      getColorPresetRow().forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cp-swatch' + (c === selectHex ? ' selected' : '');
        b.setAttribute('data-color', c);
        b.style.background = c;
        if (c === '#ffffff') b.style.boxShadow = 'inset 0 0 0 1px #666';
        b.title = c;
        b.addEventListener('click', function () { setColorPickerValue(root, c); });
        row.appendChild(b);
      });
    }
    fillPresets(initial);

    root.querySelectorAll('.cp-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-cp-tab');
        root.querySelectorAll('.cp-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        root.querySelectorAll('.cp-panel').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-cp-panel') === name);
        });
      });
    });
    var wheel = root.querySelector('input[type="color"]');
    if (wheel) {
      wheel.addEventListener('input', function () {
        var hex = normalizeHexColor(wheel.value);
        if (hex) {
          saveRecentCustomColor(hex);
          setColorPickerValue(root, hex);
        }
      });
    }
  }

  function setColorPickerValue(root, hex, opts) {
    opts = opts || {};
    hex = normalizeHexColor(hex) || '#e59a18';
    var inputId = root.getAttribute('data-input-id');
    var input = inputId ? $(inputId) : null;
    if (input) input.value = hex;
    root.setAttribute('data-value', hex);
    var cur = root.querySelector('.cp-current');
    if (cur) cur.style.background = hex;
    var wheel = root.querySelector('input[type="color"]');
    if (wheel) wheel.value = hex;
    root.querySelectorAll('.cp-swatch').forEach(function (b) {
      b.classList.toggle('selected', normalizeHexColor(b.getAttribute('data-color')) === hex);
    });
    // rebuild presets if custom added
    var presets = root.querySelector('[data-role="presets"]');
    if (presets && getColorPresetRow().indexOf(hex) >= 0) {
      // refresh selection only already done
    }
    applyPinSlotColor(hex);
    updatePinEditorPreview();
  }

  function applyPinSlotColor(hex) {
    if (!pinDraft) return;
    if (pinColorSlot === 'inside') {
      selectedPinInnerColor = hex;
      if ($('pin-inner-color')) $('pin-inner-color').value = hex;
    } else if (pinColorSlot === 'icon') {
      selectedPinGlyphColor = hex;
      if ($('pin-glyph-color')) $('pin-glyph-color').value = hex;
    } else {
      selectedPinColor = hex;
      if ($('pin-outer-color')) $('pin-outer-color').value = hex;
      if ($('pin-color-value')) $('pin-color-value').value = hex;
    }
  }

  function setPinColorSlot(slot) {
    pinColorSlot = slot || 'pin';
    ['pin', 'inside', 'icon'].forEach(function (s) {
      var b = $('pes-slot-' + s);
      if (b) b.classList.toggle('is-active', s === pinColorSlot);
    });
    var hex = pinColorSlot === 'inside' ? selectedPinInnerColor
      : pinColorSlot === 'icon'
        ? (selectedPinGlyphColor === 'natural' ? '#111111' : selectedPinGlyphColor)
        : selectedPinColor;
    var cp = $('cp-pin');
    if (cp) {
      if (!cp._cpBuilt) renderColorPicker(cp);
      setColorPickerValue(cp, hex, { silent: true });
    }
  }

  function tilePerf(extra) {
    var o = {
      maxZoom: MAP_MAX_ZOOM, maxNativeZoom: 19,
      updateWhenZooming: false, updateWhenIdle: false,
      keepBuffer: 8, detectRetina: false, crossOrigin: false, errorTileUrl: ''
    };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  var BASEMAPS = {
    topo: {
      url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
      opts: tilePerf({ maxNativeZoom: 16, attribution: 'USGS' })
    },
    streets: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      opts: tilePerf({ maxNativeZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap & CARTO' })
    },
    satellite: {
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: tilePerf({
        maxNativeZoom: 19, keepBuffer: 10, className: 'basemap-sat-tiles',
        attribution: 'Esri World Imagery · Maxar, Earthstar Geographics & GIS User Community'
      })
    },
    /* Hunt basemap parity (7.0.51+): imagery under + hillshade so deep zoom never blanks */
    lidar: {
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: tilePerf({
        maxNativeZoom: 19, maxZoom: MAP_MAX_ZOOM, keepBuffer: 12,
        className: 'basemap-lidar-under',
        attribution: 'Esri World Imagery + Hillshade · USGS 3DEP'
      }),
      hillUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
      hillOpts: tilePerf({
        maxNativeZoom: 16, maxZoom: MAP_MAX_ZOOM, keepBuffer: 12, opacity: 0.58,
        className: 'basemap-lidar-tiles',
        attribution: 'Esri World Hillshade · USGS 3DEP LiDAR DEMs'
      })
    }
  };
  var LABELS_URL = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

  function haversineMiles(a, b) {
    var R = 3958.8, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLon = (b.lng - a.lng) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function pathMiles(pts) {
    var t = 0;
    for (var i = 1; i < pts.length; i++) t += haversineMiles(pts[i - 1], pts[i]);
    return t;
  }
  function formatMiles(mi) {
    if (mi < 0.1) return (mi * 5280).toFixed(0) + ' ft';
    return mi.toFixed(2) + ' mi';
  }
  function polygonAcres(pts) {
    if (pts.length < 3) return 0;
    var R = 6371000, toR = Math.PI / 180, area = 0;
    for (var i = 0; i < pts.length; i++) {
      var j = (i + 1) % pts.length;
      area += (pts[j].lng - pts[i].lng) * toR * (2 + Math.sin(pts[i].lat * toR) + Math.sin(pts[j].lat * toR));
    }
    return Math.abs(area) * R * R / 2 / 4046.8564224;
  }

  function setBasemap(key) {
    if (!map || !BASEMAPS[key]) return;
    basemapKey = key;
    if (baseLayer) try { map.removeLayer(baseLayer); } catch (e) {}
    var b = BASEMAPS[key];
    if (key === 'lidar' && b.hillUrl) {
      // Layer group: imagery under (deep zoom) + hillshade overscale — never blank
      var under = L.tileLayer(b.url, b.opts);
      var hill = L.tileLayer(b.hillUrl, b.hillOpts || tilePerf({ maxNativeZoom: 16, opacity: 0.58 }));
      baseLayer = L.layerGroup([under, hill]).addTo(map);
    } else {
      baseLayer = L.tileLayer(b.url, b.opts).addTo(map);
    }
    try {
      if (map.setMaxZoom) map.setMaxZoom(MAP_MAX_ZOOM);
      if (map.options) map.options.maxZoom = MAP_MAX_ZOOM;
    } catch (eMz) {}
    if (labelsOn) setLabels(true);
    document.querySelectorAll('input[name="map-basemap"]').forEach(function (r) {
      var v = r.value === 'street' ? 'streets' : r.value;
      if (r.value === 'lidar') v = 'lidar';
      r.checked = v === key;
    });
    if ($('mbb-sub')) {
      $('mbb-sub').textContent = key === 'topo' ? 'USGS Topo'
        : key === 'satellite' ? 'Satellite'
        : key === 'lidar' ? 'LiDAR'
        : 'Roads';
    }
    setTimeout(function () {
      try {
        if (map) {
          map.invalidateSize(false);
          map.setZoom(map.getZoom(), { animate: false });
        }
      } catch (eRd) {}
    }, 60);
  }
  function setLabels(on) {
    labelsOn = !!on;
    if (labelsLayer) { try { map.removeLayer(labelsLayer); } catch (e) {} labelsLayer = null; }
    if (labelsOn && map) {
      labelsLayer = L.tileLayer(LABELS_URL, tilePerf({ maxNativeZoom: 20, subdomains: 'abcd', opacity: 0.9 })).addTo(map);
    }
    if ($('map-labels-toggle')) $('map-labels-toggle').checked = labelsOn;
  }
  var coordHudEnabled = false;
  function setCoordHudEnabled(on) {
    coordHudEnabled = !!on;
    var hud = $('map-coord-hud');
    if (!hud) return;
    hud.style.display = coordHudEnabled ? '' : 'none';
    hud.classList.toggle('is-visible', coordHudEnabled);
    hud.setAttribute('aria-hidden', coordHudEnabled ? 'false' : 'true');
  }
  function updateCoordHud(lat, lng) {
    var hud = $('map-coord-hud');
    if (!hud || lat == null) return;
    // Opt-in only (Map settings → Show coordinate HUD)
    if (!coordHudEnabled) {
      hud.style.display = 'none';
      hud.classList.remove('is-visible');
      return;
    }
    hud.style.display = '';
    hud.classList.add('is-visible');
    hud.textContent = Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5);
  }

  function ensureMap() {
    if (typeof L === 'undefined') return null;
    if (map) { setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 50); return map; }
    if (!$('plan-map')) return null;
    map = L.map('plan-map', {
      center: HUNT_CENTER, zoom: HUNT_ZOOM, minZoom: HUNT_MIN_ZOOM, maxZoom: MAP_MAX_ZOOM,
      maxBounds: HUNT_BOUNDS, maxBoundsViscosity: 0.2, preferCanvas: true,
      zoomControl: false, doubleClickZoom: false, fadeAnimation: true, zoomAnimation: true
    });
    setBasemap('topo');
    pinsLayer = L.layerGroup().addTo(map);
    shareLayer = L.layerGroup().addTo(map);
    toolLayer = L.layerGroup().addTo(map);
    map.on('click', onMapClick);
    map.on('mousemove', function (e) { updateCoordHud(e.latlng.lat, e.latlng.lng); });
    // Start hidden until host enables via Map settings
    setCoordHudEnabled(false);
    redrawAll();
    setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 80);
    return map;
  }

  /* ---------- tools: measure / draw (no track, no pin on bar) ---------- */
  function clearToolPreview() { if (toolLayer) toolLayer.clearLayers(); }
  function clearTempMeasure() {
    if (tempMeasure && map) try { map.removeLayer(tempMeasure); } catch (e) {}
    tempMeasure = null;
  }
  function showTempMeasure(pts, miles) {
    clearTempMeasure();
    if (!map || !pts || pts.length < 2) return;
    var latlngs = pts.map(function (p) { return [p.lat, p.lng]; });
    var layers = [
      L.polyline(latlngs, { color: MEASURE_LINE_HALO, weight: 7, opacity: 0.95, dashArray: '7 7', interactive: false }),
      L.polyline(latlngs, { color: MEASURE_LINE_COLOR, weight: 3.5, opacity: 1, dashArray: '7 7', interactive: false })
    ];
    pts.forEach(function (p) {
      layers.push(L.circleMarker([p.lat, p.lng], {
        radius: 5, color: MEASURE_LINE_HALO, weight: 2, fillColor: MEASURE_LINE_COLOR, fillOpacity: 1, interactive: false
      }));
    });
    var mid = pts[Math.floor(pts.length / 2)];
    layers.push(L.marker([mid.lat, mid.lng], {
      interactive: false,
      icon: L.divIcon({
        className: 'temp-measure-label',
        html: '<div class="tml-box">' + formatMiles(miles) + '</div>',
        iconSize: [120, 32], iconAnchor: [60, 40]
      })
    }));
    tempMeasure = L.layerGroup(layers).addTo(map);
  }
  function setDrawUi() {
    var hint = $('map-draw-hint'), stats = $('map-draw-stats'), panel = $('mdt-tools-panel');
    var active = !!drawMode;
    if (panel) panel.classList.toggle('is-open', active);
    document.querySelectorAll('#mdt-measure,#mdt-draw').forEach(function (b) {
      if (!b) return;
      var on = (b.id === 'mdt-measure' && drawMode === 'measure') ||
        (b.id === 'mdt-draw' && (drawMode === 'draw' || drawMode === 'drawline'));
      b.classList.toggle('is-on', on);
    });
    /* Hunt: crosshair while measure/draw — not grab hand */
    var dock = $('map-dock') || document.querySelector('.map-wrapper');
    if (dock) {
      dock.classList.toggle('draw-mode', active);
      dock.classList.toggle('mode-measure', drawMode === 'measure');
      dock.classList.toggle('mode-draw', drawMode === 'draw');
      dock.classList.toggle('mode-drawline', drawMode === 'drawline');
    }
    if (map && map.getContainer) {
      try {
        var c = map.getContainer();
        c.classList.toggle('planmap-tool-active', active);
        c.style.cursor = active ? 'crosshair' : '';
      } catch (eC) {}
    }
    if (hint) {
      if (!drawMode) { hint.classList.remove('is-on'); hint.textContent = ''; }
      else {
        hint.classList.add('is-on');
        if (drawMode === 'measure') hint.textContent = 'Measure: click points · Finish for distance';
        else if (drawMode === 'draw') hint.textContent = 'Shape: click vertices · Finish for area + perimeter';
        else if (drawMode === 'drawline') hint.textContent = 'Line: click points · Finish for distance';
      }
    }
    if ($('mdt-undo')) $('mdt-undo').disabled = !active || !drawPoints.length;
    if ($('mdt-finish')) $('mdt-finish').disabled = !active || drawPoints.length < 2;
    if ($('mdt-cancel')) $('mdt-cancel').disabled = !active;
    if (stats && drawPoints.length >= 2 && drawMode) {
      var mi = pathMiles(drawPoints);
      var txt = 'Distance: ' + formatMiles(mi);
      if (drawMode === 'draw' && drawPoints.length >= 3) txt += ' · Area ≈ ' + polygonAcres(drawPoints).toFixed(2) + ' ac';
      stats.textContent = txt; stats.style.display = '';
    } else if (stats) { stats.textContent = ''; stats.style.display = 'none'; }
  }
  function refreshDrawPreview() {
    clearToolPreview();
    if (!drawPoints.length || !toolLayer) return;
    drawPoints.forEach(function (p) {
      L.circleMarker([p.lat, p.lng], {
        radius: 5, color: MEASURE_LINE_HALO, weight: 2, fillColor: MEASURE_LINE_COLOR, fillOpacity: 1, interactive: false
      }).addTo(toolLayer);
    });
    if (drawPoints.length >= 2) {
      var latlngs = drawPoints.map(function (p) { return [p.lat, p.lng]; });
      if (drawMode === 'draw' && drawPoints.length >= 3) {
        L.polygon(latlngs, { color: '#e59a18', weight: 2, fillColor: '#e59a18', fillOpacity: 0.15, dashArray: '6 6' }).addTo(toolLayer);
      } else {
        L.polyline(latlngs, { color: MEASURE_LINE_HALO, weight: 7, opacity: 0.9, dashArray: '7 7', interactive: false }).addTo(toolLayer);
        L.polyline(latlngs, { color: MEASURE_LINE_COLOR, weight: 3.5, opacity: 1, dashArray: '7 7', interactive: false }).addTo(toolLayer);
      }
      var mi = pathMiles(drawPoints);
      var mid = drawPoints[Math.floor(drawPoints.length / 2)];
      L.marker([mid.lat, mid.lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'temp-measure-label',
          html: '<div class="tml-box">' + formatMiles(mi) + '</div>',
          iconSize: [120, 32], iconAnchor: [60, 40]
        })
      }).addTo(toolLayer);
    }
    setDrawUi();
  }
  function cancelDraw() {
    drawMode = null; drawPoints = []; clearToolPreview(); setDrawUi(); hideDrawChooser();
  }
  function finishDraw() {
    if (!drawMode || drawPoints.length < 2) { api.toast('Add at least two points, then Finish.'); return; }
    var pts = drawPoints.map(function (p) { return { lat: p.lat, lng: p.lng }; });
    var mi = pathMiles(pts);
    if (drawMode === 'draw') {
      showTempMeasure(pts, mi);
      api.toast('Perimeter: ' + formatMiles(mi) + ' · Area ≈ ' + polygonAcres(pts).toFixed(2) + ' ac');
    } else {
      showTempMeasure(pts, mi);
      api.toast('Distance: ' + formatMiles(mi) + ' · tap map to clear');
    }
    cancelDraw();
  }
  function startMeasure() {
    ensureMap(); stopRadar(); clearTempMeasure();
    if (drawMode === 'measure') { cancelDraw(); return; }
    drawMode = 'measure'; drawPoints = []; clearToolPreview(); setDrawUi();
  }
  function hideDrawChooser() {
    var el = $('draw-mode-chooser');
    if (el) el.classList.remove('open');
  }
  function showDrawChooser() {
    var btn = $('mdt-draw');
    var el = $('draw-mode-chooser');
    if (!el) {
      el = document.createElement('div');
      el.id = 'draw-mode-chooser';
      el.className = 'draw-mode-chooser';
      el.innerHTML = '<button type="button" data-draw-kind="shape">Shape</button><button type="button" data-draw-kind="line">Line</button>';
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-draw-kind]');
        if (!b) return;
        e.stopPropagation();
        beginDraw(b.getAttribute('data-draw-kind'));
      });
    }
    if (btn) {
      var r = btn.getBoundingClientRect();
      el.style.left = Math.max(4, r.left + r.width / 2 - 54) + 'px';
      el.style.bottom = Math.max(8, window.innerHeight - r.top + 6) + 'px';
      el.style.top = 'auto';
    }
    el.classList.add('open');
    el.querySelectorAll('[data-draw-kind]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-draw-kind') === lastDrawKind);
    });
  }
  function beginDraw(kind) {
    ensureMap(); stopRadar(); clearTempMeasure();
    lastDrawKind = kind === 'line' ? 'line' : 'shape';
    drawMode = kind === 'line' ? 'drawline' : 'draw';
    drawPoints = []; clearToolPreview(); setDrawUi(); showDrawChooser();
  }
  function startDraw() {
    if (drawMode === 'draw' || drawMode === 'drawline' || ($('draw-mode-chooser') && $('draw-mode-chooser').classList.contains('open'))) {
      cancelDraw(); hideDrawChooser(); return;
    }
    beginDraw(lastDrawKind || 'shape');
  }

  /* ---------- map click → Hunt-style "What do you want to do?" map-dot ---------- */
  function clearTempDot() {
    if (tempDot && map) try { map.removeLayer(tempDot); } catch (e) {}
    tempDot = null;
  }

  function buildMapDotHtml(opts) {
    opts = opts || {};
    var fromGps = !!(opts.fromGps || mapDotMenuSource === 'gps');
    var shareLabel = fromGps ? 'Share my location' : 'Share location';

    if (opts.offlineRadiusChooser) {
      return '<div class="map-dot-menu" onclick="event.stopPropagation();">' +
        '<div class="mdm-title">Offline map pack</div>' +
        '<div class="mdm-sub">How far around this spot? You will confirm size before download.</div>' +
        '<div class="mdm-actions-grid">' +
        '<button type="button" class="mdm-btn" style="background:#1a4a5c;" data-mdm-act="offline-mi2">2 miles</button>' +
        '<button type="button" class="mdm-btn" style="background:#1a4a5c;" data-mdm-act="offline-mi5">5 miles</button>' +
        '<button type="button" class="mdm-btn" style="background:#1a4a5c;" data-mdm-act="offline-mi10">10 miles</button>' +
        '<button type="button" class="mdm-btn" style="background:#3a4234;" data-mdm-act="offline-back">Back</button>' +
        '</div></div>';
    }

    if (opts.shareChooser) {
      return '<div class="map-dot-menu" onclick="event.stopPropagation();">' +
        '<div class="mdm-title">Share location</div>' +
        '<div class="mdm-sub">' + esc(opts.shareName || (fromGps ? 'My location' : 'Map spot')) + '</div>' +
        '<button type="button" class="mdm-btn share" data-mdm-act="share-copy">Copy location</button>' +
        (fromGps
          ? '<button type="button" class="mdm-btn pin" data-mdm-act="share-live">' +
            (shareLocOn ? 'Stop sharing live' : 'Share live with group') + '</button>'
          : '') +
        '<button type="button" class="mdm-btn" style="background:#3a4234;" data-mdm-act="share-back">Back</button>' +
        '</div>';
    }

    if (opts.eventChooser) {
      var events = api.listEventsForLocation() || [];
      if (!events.length) {
        return '<div class="map-dot-menu" onclick="event.stopPropagation();">' +
          '<div class="mdm-title">Add event location</div>' +
          '<div class="mdm-sub">No events yet. Create one first.</div>' +
          '<button type="button" class="mdm-btn save-pin" data-mdm-act="add-event">Add event</button>' +
          '<button type="button" class="mdm-btn" style="background:#3a4234;" data-mdm-act="event-back">Back</button>' +
          '</div>';
      }
      var rows = events.map(function (ev) {
        var has = ev.lat != null && ev.lng != null;
        return '<button type="button" class="mdm-btn pin" style="width:100%;margin-bottom:6px;" data-mdm-act="set-event-id" data-event-id="' + esc(ev.id) + '">' +
          esc(ev.name || 'Event') + (has ? ' · update' : '') + '</button>';
      }).join('');
      return '<div class="map-dot-menu" onclick="event.stopPropagation();">' +
        '<div class="mdm-title">Add event location</div>' +
        '<div class="mdm-sub">Only creators can set location. Pick an event:</div>' +
        rows +
        '<button type="button" class="mdm-btn" style="background:#3a4234;width:100%;" data-mdm-act="event-back">Back</button>' +
        '</div>';
    }

    // Main menu — same shape as Hunt (minus regs/hunt): weather, pin, offline, share, event location
    return '<div class="map-dot-menu" onclick="event.stopPropagation();">' +
      '<div class="mdm-title">What do you want to do?</div>' +
      '<div class="mdm-actions-grid">' +
      '<button type="button" class="mdm-btn weather" data-mdm-act="weather">Get weather</button>' +
      '<button type="button" class="mdm-btn pin save-pin" data-mdm-act="pin">Add pin</button>' +
      '<button type="button" class="mdm-btn" style="background:#1a4a5c;" data-mdm-act="offline-save">Offline map</button>' +
      '<button type="button" class="mdm-btn pin" data-mdm-act="event-loc">' +
        ((api.listEventsForLocation() || []).length ? 'Add event location' : 'Add event') +
      '</button>' +
      '</div>' +
      '<div class="mdm-actions-below">' +
      '<button type="button" class="mdm-btn share" data-mdm-act="share">' + shareLabel + '</button>' +
      '</div></div>';
  }

  function setMapDotMenuContent(opts) {
    opts = opts || {};
    var html = buildMapDotHtml(opts);
    var layer = (mapDotMenuSource === 'gps' && gpsMarker) ? gpsMarker : tempDot;
    if (layer && typeof layer.setPopupContent === 'function') {
      try { layer.setPopupContent(html); } catch (e) {}
    }
  }

  var _mapDotDelegateBound = false;
  function bindMapDotDelegate() {
    if (_mapDotDelegateBound) return;
    _mapDotDelegateBound = true;
    document.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('.map-dot-popup [data-mdm-act]');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      handleMapDotAction(btn.getAttribute('data-mdm-act'), btn);
    }, true);
  }

  function placeMapDot(latlng, opts) {
    opts = opts || {};
    ensureMap();
    if (!map) return;
    bindMapDotDelegate();
    clearTempDot();
    mapDotMenuSource = opts.fromGps ? 'gps' : 'dot';
    clickLat = latlng.lat; clickLng = latlng.lng;
    updateCoordHud(clickLat, clickLng);
    tempDot = L.circleMarker([clickLat, clickLng], {
      radius: 8, color: '#fff', weight: 2.5, fillColor: '#e59a18', fillOpacity: 0.98,
      interactive: true, bubblingMouseEvents: false
    }).addTo(map);
    /*
     * Hunt logic:
     *  - Free map click → place/move orange dot only (no menu).
     *  - Tap the orange dot → "What do you want to do?" options popup.
     *  - Popup stays above the dot; no aggressive auto-pan.
     *  - Defer open when forceOpen so the same click does not instantly close it.
     */
    var popOpts = {
      className: 'map-dot-popup',
      maxWidth: 280,
      minWidth: 200,
      closeButton: true,
      autoPan: false,
      closeOnClick: false,
      autoClose: false,
      offset: L.point(0, -14)
    };
    tempDot.bindPopup(buildMapDotHtml({ fromGps: !!opts.fromGps }), popOpts);
    tempDot.on('click', function (ev) {
      try {
        if (ev && ev.originalEvent) {
          L.DomEvent.stopPropagation(ev.originalEvent);
          L.DomEvent.preventDefault(ev.originalEvent);
        }
      } catch (eS) {}
      mapDotMenuSource = opts.fromGps ? 'gps' : 'dot';
      try {
        tempDot.setPopupContent(buildMapDotHtml({ fromGps: !!opts.fromGps }));
        tempDot.openPopup();
      } catch (eO) {}
    });
    if (opts.forceOpen || opts.fromGps) {
      setTimeout(function () {
        if (!tempDot) return;
        try {
          tempDot.setPopupContent(buildMapDotHtml({ fromGps: !!opts.fromGps }));
          tempDot.openPopup();
        } catch (eF) {}
      }, 40);
    }
  }

  function googleMapsShareUrl(lat, lng) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(Number(lat).toFixed(6) + ',' + Number(lng).toFixed(6));
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve(); else reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function shareLocationLink(lat, lng, label) {
    var url = googleMapsShareUrl(lat, lng);
    copyTextToClipboard(url).then(function () {
      api.toast('Link copied · Google Maps pin ready to paste');
    }).catch(function () {
      api.toast(url);
    });
  }

  /* --- Hunt-style weather: compact bottom-right + movable More details --- */
  function getCardinal(deg) {
    var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    if (deg == null || isNaN(deg)) return '—';
    return dirs[Math.round(((Number(deg) % 360) / 45)) % 8];
  }
  function formatTemp(f) {
    if (f == null || isNaN(f)) return '—';
    return Math.round(Number(f)) + '°F';
  }
  function hourlyWindCellHtml(speedMph, dirDeg) {
    var spd = Math.round(Number(speedMph) || 0);
    var rot = (Number(dirDeg) || 0) + 180; // arrow shows FROM direction
    return '<span class="hourly-wind">' +
      '<span class="hourly-wind-arrow" style="transform:rotate(' + rot + 'deg)"></span>' +
      spd + ' mph</span>';
  }
  function calculateMoonPhase(date) {
    // Simple approx (same spirit as Hunt display)
    var d = date || new Date();
    var lp = 2551443;
    var newMoon = new Date(1970, 0, 7, 20, 35, 0).getTime();
    var phase = ((d.getTime() - newMoon) / 1000) % lp;
    var age = phase / (24 * 3600);
    var illum = Math.round((1 - Math.cos((age / 29.53) * 2 * Math.PI)) / 2 * 100);
    var names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
      'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    var idx = Math.floor(((age / 29.53) * 8) + 0.5) % 8;
    return { phase: names[idx] || '—', illumination: illum };
  }
  function formatSunTime(iso) {
    if (!iso) return '--';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return '--'; }
  }

  function wireDraggableMapPanel(box) {
    if (!box || box._dragWired) return;
    box._dragWired = true;
    var dragging = false, startX = 0, startY = 0, origL = 0, origT = 0;
    function isInteractiveTarget(t) {
      if (!t || !t.closest) return false;
      return !!t.closest('button, a, input, select, textarea, label, .mwo-close, .mwo-more, .mdm-btn');
    }
    function onDown(ev) {
      if (isInteractiveTarget(ev.target)) return;
      if (ev.button != null && ev.button !== 0) return;
      dragging = true;
      box.classList.add('is-dragging');
      var parent = box.offsetParent || box.parentElement || document.body;
      var pref = parent.getBoundingClientRect ? parent.getBoundingClientRect() : { left: 0, top: 0 };
      var rect = box.getBoundingClientRect();
      box.classList.add('is-dragged');
      box.style.transform = 'none';
      box.style.right = 'auto';
      box.style.bottom = 'auto';
      box.style.left = Math.round(rect.left - pref.left) + 'px';
      box.style.top = Math.round(rect.top - pref.top) + 'px';
      startX = ev.clientX; startY = ev.clientY;
      origL = parseFloat(box.style.left) || 0;
      origT = parseFloat(box.style.top) || 0;
      try { box.setPointerCapture(ev.pointerId); } catch (eCap) {}
      if (ev.preventDefault) ev.preventDefault();
    }
    function onMove(ev) {
      if (!dragging) return;
      box.style.left = Math.round(origL + (ev.clientX - startX)) + 'px';
      box.style.top = Math.round(origT + (ev.clientY - startY)) + 'px';
      if (ev.preventDefault) ev.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      box.classList.remove('is-dragging');
    }
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onUp);
  }

  function closeMapWeatherPopup() {
    mapWeatherUserDismissed = true;
    var el = $('map-weather-overlay');
    if (el) el.style.display = 'none';
    var details = $('map-weather-details');
    if (details) details.style.display = 'none';
  }
  function closeMapWeatherDetails() {
    var el = $('map-weather-details');
    if (el) el.style.display = 'none';
    try {
      var compact = $('map-weather-overlay');
      if (compact && lastMapWeatherPayload && !mapWeatherUserDismissed) {
        compact.style.display = 'block';
      }
    } catch (eR) {}
  }
  function expandMapWeatherDetails() {
    var box = $('map-weather-details');
    var body = $('mwd-body');
    var title = $('mwd-title');
    if (!box || !body || !lastMapWeatherPayload) return;
    var p = lastMapWeatherPayload;
    if (title) title.textContent = p.title || 'Weather details';
    body.innerHTML = p.detailsHtml || p.compactHtml || '';
    if (!box.classList.contains('is-dragged')) {
      box.style.left = '';
      box.style.top = '';
      box.style.right = '12px';
      box.style.bottom = '';
      box.style.transform = 'none';
    }
    box.style.display = 'block';
    try {
      var compact = $('map-weather-overlay');
      if (compact) compact.style.display = 'none';
    } catch (eC) {}
    wireMapWeatherUi();
  }
  function wireMapWeatherUi() {
    wireDraggableMapPanel($('map-weather-details'));
    wireDraggableMapPanel($('map-weather-overlay'));
    function wireCloseBtn(btn, fn) {
      if (!btn || btn._mwoCloseWired) return;
      btn._mwoCloseWired = true;
      btn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      btn.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        if (typeof fn === 'function') fn();
      });
    }
    wireCloseBtn($('mwo-close'), closeMapWeatherPopup);
    wireCloseBtn($('mwd-close'), closeMapWeatherDetails);
    var more = $('mwo-more-btn');
    if (more && !more._mwoMoreWired) {
      more._mwoMoreWired = true;
      more.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        expandMapWeatherDetails();
      });
    }
  }

  function showMapWeatherPopup(location, weather, lat, lng) {
    mapWeatherUserDismissed = false;
    var overlay = $('map-weather-overlay');
    var body = $('mwo-body');
    var title = $('mwo-title');
    var more = $('mwo-more-btn');
    if (!overlay || !body) return;

    var cur = weather.current || {};
    var daily = weather.daily || {};
    var hourly = weather.hourly || {};
    var wspd = cur.wind_speed_10m;
    var wdir = cur.wind_direction_10m;
    var tempNow = cur.temperature_2m;
    if (wspd == null && hourly.wind_speed_10m) {
      var idx = hourly.wind_speed_10m[7] !== undefined ? 7 : 12;
      wspd = hourly.wind_speed_10m[idx];
      wdir = hourly.wind_direction_10m && hourly.wind_direction_10m[idx];
      tempNow = hourly.temperature_2m && hourly.temperature_2m[idx];
    }
    var high = daily.temperature_2m_max && daily.temperature_2m_max[0];
    var low = daily.temperature_2m_min && daily.temperature_2m_min[0];
    var rise = formatSunTime(daily.sunrise && daily.sunrise[0]);
    var set = formatSunTime(daily.sunset && daily.sunset[0]);
    var moon = calculateMoonPhase(new Date());
    var name = (location && location.name) || 'Map spot';
    if (title) title.textContent = name;

    var windCell = hourlyWindCellHtml(wspd, wdir);
    var compact =
      '<div style="font-weight:bold;color:var(--accent);margin-bottom:6px;">' +
      formatTemp(tempNow) + ' · Wind ' + Math.round(wspd || 0) + ' mph ' + getCardinal(wdir || 0) +
      '</div>' +
      '<div>High ' + formatTemp(high) + ' · Low ' + formatTemp(low) + '</div>' +
      '<div style="margin-top:4px;color:var(--muted);font-size:11px;">Sunrise ' + rise +
      ' · Sunset ' + set + '</div>';

    // Full 24h, starting at current hour so "now" is at the top of the scrollable table
    var hourlyRows = '';
    var nowHour = new Date().getHours();
    if (hourly.time && hourly.time.length) {
      // Prefer matching API hour index for today
      var startIdx = 0;
      for (var hi = 0; hi < Math.min(24, hourly.time.length); hi++) {
        var ht = new Date(hourly.time[hi]);
        if (ht.getHours() === nowHour) { startIdx = hi; break; }
      }
      for (var i = 0; i < 24; i++) {
        var h = (startIdx + i) % Math.min(24, hourly.time.length);
        if (!hourly.time[h]) continue;
        var t = new Date(hourly.time[h]);
        var rainPct = (hourly.precipitation_probability && hourly.precipitation_probability[h] != null)
          ? Math.round(hourly.precipitation_probability[h]) : '—';
        var hWind = hourlyWindCellHtml(
          hourly.wind_speed_10m && hourly.wind_speed_10m[h],
          hourly.wind_direction_10m && hourly.wind_direction_10m[h]
        );
        var isNow = i === 0;
        hourlyRows += '<tr' + (isNow ? ' style="background:rgba(229,154,24,0.12)"' : '') + '>' +
          '<td style="border-right:1px solid rgba(255,255,255,0.12);padding:3px 3px;text-align:center;font-weight:' +
          (isNow ? '800' : '600') + '">' +
          (isNow ? 'Now · ' : '') +
          t.toLocaleTimeString('en-US', { hour: 'numeric' }) + '</td>' +
          '<td style="border-right:1px solid rgba(255,255,255,0.12);padding:3px 3px;text-align:center;">' +
          formatTemp(hourly.temperature_2m[h]) + '</td>' +
          '<td style="border-right:1px solid rgba(255,255,255,0.12);padding:3px 3px;text-align:center;">' +
          (rainPct === '—' ? '—' : rainPct + '%') + '</td>' +
          '<td class="hourly-wind-td" style="padding:3px 3px;text-align:center;">' + hWind + '</td></tr>';
      }
    }
    var thStyle = 'border-right:1px solid rgba(255,255,255,0.18);padding:2px 2px;font-size:10px;font-weight:700;text-align:center;white-space:nowrap;position:sticky;top:0;background:var(--panel);';
    var details =
      '<div style="margin-bottom:8px;"><strong>Wind</strong>' +
      '<div class="mwd-wind-row">' + windCell +
      '<span style="color:var(--muted);font-size:11px;">from ' + getCardinal(wdir || 0) +
      ' · Scent → ' + getCardinal(((wdir || 0) + 180) % 360) + '</span></div></div>' +
      '<div style="margin-bottom:8px;"><strong>Sun &amp; moon</strong><br>Sunrise ' + rise +
      ' · Sunset ' + set + '<br>Moon: ' + (moon.phase || '—') +
      (moon.illumination != null ? ' (' + moon.illumination + '% lit)' : '') + '</div>' +
      '<div style="margin-bottom:8px;"><strong>High / Low</strong><br>' +
      formatTemp(high) + ' / ' + formatTemp(low) + '</div>' +
      '<div><strong>Hourly (24h · scroll)</strong>' +
      '<div style="max-height:min(42vh,280px);overflow:auto;margin-top:4px;-webkit-overflow-scrolling:touch;">' +
      '<table style="width:100%;table-layout:fixed;font-size:10px;border-collapse:collapse;">' +
      '<thead><tr>' +
      '<th style="' + thStyle + '">Hour</th>' +
      '<th style="' + thStyle + '">Temp</th>' +
      '<th style="' + thStyle + '">Rain %</th>' +
      '<th style="padding:2px 2px;font-size:10px;font-weight:700;text-align:center;position:sticky;top:0;background:var(--panel);">Wind</th>' +
      '</tr></thead><tbody>' + hourlyRows + '</tbody></table></div></div>' +
      '<p style="font-size:10px;color:var(--muted);margin-top:8px;">Weather is planning-only.</p>';

    lastMapWeatherPayload = { title: name, compactHtml: compact, detailsHtml: details, lat: lat, lng: lng, weather: weather };
    body.innerHTML = compact;
    if (more) more.style.display = 'block';
    if (!overlay.classList.contains('is-dragged')) {
      overlay.style.left = '';
      overlay.style.top = '';
      overlay.style.right = '12px';
      overlay.style.bottom = '';
    }
    overlay.style.display = 'block';
    wireMapWeatherUi();
    closeMapWeatherDetails();
  }

  function showWeatherAt(lat, lng) {
    var body = $('mwo-body');
    var overlay = $('map-weather-overlay');
    var title = $('mwo-title');
    if (title) title.textContent = 'Map spot';
    if (body) body.innerHTML = 'Loading weather…';
    if (overlay) {
      if (!overlay.classList.contains('is-dragged')) {
        overlay.style.left = ''; overlay.style.top = '';
        overlay.style.right = '12px'; overlay.style.bottom = '';
      }
      overlay.style.display = 'block';
    }
    var more = $('mwo-more-btn');
    if (more) more.style.display = 'none';
    wireMapWeatherUi();
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lng) +
      '&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code' +
      '&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m' +
      '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      showMapWeatherPopup({ name: 'Map spot' }, data, lat, lng);
    }).catch(function () {
      if (body) body.innerHTML = 'Weather unavailable right now.';
      api.toast('Weather unavailable');
    });
  }

  /* --- offline map packs (Cache API, Hunt 2/5/10 mi) --- */
  function lonLatToTile(lng, lat, z) {
    var n = Math.pow(2, z);
    var x = Math.floor(((lng + 180) / 360) * n);
    var latRad = (lat * Math.PI) / 180;
    var y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
  }
  function milesToDegLat(mi) { return mi / 69.0; }
  function milesToDegLng(mi, lat) {
    var cos = Math.cos((lat * Math.PI) / 180);
    if (Math.abs(cos) < 0.01) cos = 0.01;
    return mi / (69.0 * cos);
  }
  function tileUrlForBasemap(bm, z, x, y) {
    if (bm === 'satellite') {
      return 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x;
    }
    if (bm === 'streets' || bm === 'street') {
      return 'https://a.basemaps.cartocdn.com/light_all/' + z + '/' + x + '/' + y + '.png';
    }
    return 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/' + z + '/' + y + '/' + x;
  }
  function listOfflineTileUrls(lat, lng, radiusMi, basemap, zMin, zMax) {
    var dLat = milesToDegLat(radiusMi), dLng = milesToDegLng(radiusMi, lat);
    var south = lat - dLat, north = lat + dLat, west = lng - dLng, east = lng + dLng;
    var urls = [], maxSide = 48;
    for (var z = zMin; z <= zMax; z++) {
      var nw = lonLatToTile(west, north, z), se = lonLatToTile(east, south, z);
      var x0 = Math.min(nw.x, se.x), x1 = Math.max(nw.x, se.x);
      var y0 = Math.min(nw.y, se.y), y1 = Math.max(nw.y, se.y);
      if (x1 - x0 > maxSide) { var mx = Math.floor((x0 + x1) / 2); x0 = mx - Math.floor(maxSide / 2); x1 = x0 + maxSide; }
      if (y1 - y0 > maxSide) { var my = Math.floor((y0 + y1) / 2); y0 = my - Math.floor(maxSide / 2); y1 = y0 + maxSide; }
      for (var x = x0; x <= x1; x++) {
        for (var y = y0; y <= y1; y++) urls.push(tileUrlForBasemap(basemap, z, x, y));
      }
    }
    return urls;
  }
  function estimateOfflinePack(lat, lng, tierId, basemap) {
    var tier = OFFLINE_TIERS[tierId] || OFFLINE_TIERS.mi2;
    var urls = listOfflineTileUrls(lat, lng, tier.radiusMi, basemap || 'topo', tier.zMin, tier.zMax);
    var kb = (basemap === 'satellite') ? 35 : 18;
    return {
      tier: tier, urls: urls, tileCount: urls.length,
      approxMb: Math.max(0.1, Math.round((urls.length * kb) / 1024 * 10) / 10)
    };
  }
  function saveOfflineMapAround(lat, lng, tierId) {
    var basemap = (api.getBasemapKey && api.getBasemapKey()) || basemapKey || 'topo';
    if (basemap === 'street') basemap = 'streets';
    var est = estimateOfflinePack(lat, lng, tierId, basemap);
    var msg = 'Download ' + est.tier.name + ' offline map around this spot? ' +
      '~' + est.approxMb + ' MB · ' + est.tileCount + ' tiles · ' + basemap + '. ' +
      (est.tier.sizeHint || '') + ' Needs network while downloading.';
    return Promise.resolve(api.confirm(msg, 'Offline map')).then(function (ok) {
      if (!ok) return null;
      if (!('caches' in global)) {
        api.toast('This browser cannot store offline maps');
        return null;
      }
      if (!navigator.onLine) {
        api.toast('Need network once to download tiles');
        return null;
      }
      api.toast('Downloading offline map… ~' + est.approxMb + ' MB');
      try { if (map) map.closePopup(); } catch (e) {}
      return caches.open(OFFLINE_TILE_CACHE).then(function (cache) {
        var okN = 0, failN = 0, i = 0, workers = 4;
        function worker() {
          return new Promise(function (resolve) {
            function next() {
              if (i >= est.urls.length) { resolve(); return; }
              var u = est.urls[i++];
              fetch(u, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
                .then(function (res) {
                  if (res && res.ok) return cache.put(u, res.clone()).then(function () { okN++; });
                  failN++;
                })
                .catch(function () { failN++; })
                .then(function () {
                  if ((okN + failN) % 40 === 0) {
                    api.toast('Offline map ' + Math.round(((okN + failN) / est.urls.length) * 100) + '%');
                  }
                  next();
                });
            }
            next();
          });
        }
        return Promise.all(Array.from({ length: workers }, worker)).then(function () {
          try {
            var packs = JSON.parse(localStorage.getItem(OFFLINE_PACKS_KEY) || '[]');
            if (!Array.isArray(packs)) packs = [];
            packs.push({
              id: 'p_' + Date.now().toString(36), lat: lat, lng: lng,
              tierId: est.tier.id, basemap: basemap, ok: okN, fail: failN,
              tileCount: est.urls.length, label: 'Map spot',
              createdAt: new Date().toISOString(), status: okN ? 'ready' : 'failed'
            });
            localStorage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(packs.slice(-20)));
          } catch (eS) {}
          api.toast(okN ? ('Offline map ready · ' + okN + ' tiles') : 'Offline map failed');
          return { ok: okN, fail: failN };
        });
      });
    });
  }

  function handleMapDotAction(act, btn) {
    try {
      if (act === 'pin') {
        if (clickLat == null || clickLng == null) { api.toast('Tap the map first'); return; }
        openPinEditor({ mode: 'create', lat: clickLat, lng: clickLng });
        try { if (map) map.closePopup(); } catch (e) {}
        return;
      }
      if (act === 'weather') {
        if (clickLat == null || clickLng == null) { api.toast('Tap the map first'); return; }
        showWeatherAt(clickLat, clickLng);
        try { if (map) map.closePopup(); } catch (e) {}
        return;
      }
      if (act === 'share') {
        setMapDotMenuContent({
          shareChooser: true,
          fromGps: mapDotMenuSource === 'gps',
          shareName: mapDotMenuSource === 'gps' ? 'My location' : 'Map spot'
        });
        return;
      }
      if (act === 'share-back' || act === 'offline-back' || act === 'event-back') {
        setMapDotMenuContent({ fromGps: mapDotMenuSource === 'gps' });
        return;
      }
      if (act === 'share-copy') {
        if (clickLat == null || clickLng == null) { api.toast('No coordinates'); return; }
        shareLocationLink(clickLat, clickLng, mapDotMenuSource === 'gps' ? 'My location' : 'Map spot');
        return;
      }
      if (act === 'share-live') {
        setShareLocation(!shareLocOn);
        try { if (map) map.closePopup(); } catch (e) {}
        api.toast(shareLocOn ? 'Sharing live location with group' : 'Live share off');
        return;
      }
      if (act === 'offline-save') {
        if (clickLat == null || clickLng == null) { api.toast('Tap the map first'); return; }
        setMapDotMenuContent({ offlineRadiusChooser: true, fromGps: mapDotMenuSource === 'gps' });
        return;
      }
      if (act === 'offline-mi2' || act === 'offline-mi5' || act === 'offline-mi10') {
        if (clickLat == null || clickLng == null) { api.toast('Tap the map first'); return; }
        var tid = act === 'offline-mi5' ? 'mi5' : act === 'offline-mi10' ? 'mi10' : 'mi2';
        saveOfflineMapAround(clickLat, clickLng, tid);
        return;
      }
      if (act === 'event-loc') {
        var list = api.listEventsForLocation() || [];
        if (!list.length) {
          try { if (map) map.closePopup(); } catch (e) {}
          api.openCreateEvent();
          return;
        }
        setMapDotMenuContent({ eventChooser: true });
        return;
      }
      if (act === 'add-event') {
        try { if (map) map.closePopup(); } catch (e) {}
        api.openCreateEvent();
        return;
      }
      if (act === 'set-event-id') {
        if (clickLat == null || clickLng == null) return;
        var eid = btn && btn.getAttribute('data-event-id');
        if (!eid) return;
        var ok = api.setEventLocationById(eid, clickLat, clickLng);
        if (ok) {
          api.toast('Event location set');
          redrawAll();
          try { if (map) map.closePopup(); } catch (e) {}
          // Snap only if that event is the one currently open
          var cur = api.getEventLocation && api.getEventLocation();
          if (cur && Math.abs(Number(cur.lat) - Number(clickLat)) < 1e-8 &&
              Math.abs(Number(cur.lng) - Number(clickLng)) < 1e-8) {
            followEventLocation(true);
          } else {
            // Still pan to the pin they just set so they see it
            try { map.setView([clickLat, clickLng], Math.max(12, map.getZoom() || 12)); } catch (eV) {}
          }
        }
        return;
      }
    } catch (err) {
      console.error('map-dot action', act, err);
      api.toast('Action failed');
    }
  }

  function followEventLocation(force) {
    ensureMap();
    if (!map) return;
    var loc = api.getEventLocation && api.getEventLocation();
    if (!loc || loc.lat == null || loc.lng == null) return;
    try {
      map.setView([Number(loc.lat), Number(loc.lng)], Math.max(12, map.getZoom() || 12), { animate: !force });
    } catch (e) {}
    redrawAll();
  }

  function onMapClick(e) {
    updateCoordHud(e.latlng.lat, e.latlng.lng);
    if (tempMeasure && !drawMode) { clearTempMeasure(); return; }
    if (drawMode === 'measure' || drawMode === 'draw' || drawMode === 'drawline') {
      drawPoints.push({ lat: e.latlng.lat, lng: e.latlng.lng });
      refreshDrawPreview();
      return;
    }
    // Hunt: free click places orange dot only; menu opens when the orange dot is tapped
    placeMapDot(e.latlng, { forceOpen: false });
    if (!global.__planMapDotHintShown) {
      global.__planMapDotHintShown = true;
      api.toast('Tap the orange dot for options');
    }
  }

  /* ---------- pin visual (body / inside / icon) ---------- */
  function pinHtml(p, scale) {
    scale = scale || 1;
    var iconId = p.icon || p.iconId || 'tent';
    var isBlank = iconId === 'blank' || iconId === 'none';
    var cat = isBlank ? null : (PIN_CATALOG.find(function (x) { return x.id === iconId; }) || PIN_CATALOG[0]);
    var outer = p.color || '#e59a18';
    var inner = p.innerColor || '#ffffff';
    var glyph = (p.iconColor == null || p.iconColor === '' || p.iconColor === 'natural') ? null : p.iconColor;
    var w = Math.round(36 * scale), h = Math.round(44 * scale);
    var iconInner = '';
    if (!isBlank && cat) {
      var iconStyle = glyph
        ? 'filter:none;opacity:1;background:' + glyph + ';-webkit-mask:url(' + cat.src + ') center/contain no-repeat;mask:url(' + cat.src + ') center/contain no-repeat;width:18px;height:18px;'
        : '';
      iconInner = glyph
        ? '<span class="rs-pin-glyph" style="' + iconStyle + '"></span>'
        : '<img src="' + cat.src + '" alt="">';
    }
    return '<div class="rs-pin" style="width:' + w + 'px;height:' + h + 'px;--pin-c:' + outer + ';--pin-in:' + inner + '">' +
      '<div class="rs-pin-body"></div>' +
      '<div class="rs-pin-inside"></div>' +
      '<div class="rs-pin-icon">' + iconInner + '</div>' +
      '<div class="rs-pin-point"></div></div>';
  }
  function leafletPinIcon(p) {
    var sc = (p.pinScale != null && !isNaN(p.pinScale)) ? Number(p.pinScale) : 1;
    sc = Math.max(0.25, Math.min(1.5, sc));
    var w = Math.round(36 * sc), h = Math.round(44 * sc);
    return L.divIcon({
      className: 'plan-pin-marker',
      html: pinHtml(p, sc),
      iconSize: [w, h],
      iconAnchor: [w / 2, h - 2],
      popupAnchor: [0, -h + 8]
    });
  }

  function updatePinEditorPreview() {
    var prev = $('pes-preview');
    if (!prev) return;
    var p = {
      icon: selectedPinIconId || 'tent',
      color: selectedPinColor,
      innerColor: selectedPinInnerColor,
      iconColor: selectedPinGlyphColor,
      pinScale: (($('pin-size-slider') && Number($('pin-size-slider').value)) || 100) / 100
    };
    prev.innerHTML = pinHtml(p, Math.max(1, p.pinScale));
  }

  function loadRecentPinIcons() {
    try {
      var arr = JSON.parse(localStorage.getItem(RECENT_PINS_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(Boolean).slice(0, 8) : [];
    } catch (e) { return []; }
  }
  function pushRecentPinIcon(id) {
    if (!id) return;
    var arr = loadRecentPinIcons().filter(function (x) { return x !== id; });
    arr.unshift(id);
    try { localStorage.setItem(RECENT_PINS_KEY, JSON.stringify(arr.slice(0, 8))); } catch (e) {}
  }

  function pinIconButtonHtml(p, selectedId) {
    var sel = selectedId === p.id ? ' selected' : '';
    var blank = p.id === 'blank' ? ' pin-picker-blank-btn' : '';
    var mock = {
      icon: p.id,
      color: selectedPinColor, innerColor: selectedPinInnerColor,
      iconColor: selectedPinGlyphColor, pinScale: 0.85
    };
    return '<button type="button" class="pin-icon-btn' + blank + sel + '" data-pin-icon="' + esc(p.id) + '" title="' + esc(p.name) + '">' +
      '<span class="pin-picker-fullpin">' + pinHtml(mock, 0.85) + '</span></button>';
  }

  function renderRecentPinGrid() {
    var wrap = $('pin-icon-recent');
    if (!wrap) return;
    var recent = loadRecentPinIcons();
    if (!recent.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    var list = recent.map(function (id) {
      return PIN_CATALOG.find(function (x) { return x.id === id; }) || { id: id, name: id, src: '' };
    }).filter(function (p) { return p.src || p.id === 'blank'; });
    if (!list.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    wrap.innerHTML = '<div class="pin-icon-grid">' + list.map(function (p) {
      return pinIconButtonHtml(p, selectedPinIconId);
    }).join('') + '</div>';
  }

  function renderPinGrid() {
    var grid = $('pin-icon-grid');
    if (!grid) return;
    var q = (($('pin-icon-search') && $('pin-icon-search').value) || '').toLowerCase().trim();
    var list = PIN_CATALOG.filter(function (p) {
      return !q || p.name.toLowerCase().indexOf(q) >= 0 || p.id.indexOf(q) >= 0;
    });
    // Hunt: blank/generic pin option first
    var blank = { id: 'blank', name: 'Blank pin', src: '' };
    if (!q || 'blank'.indexOf(q) >= 0 || 'pin'.indexOf(q) >= 0) {
      list = [blank].concat(list);
    }
    grid.innerHTML = list.map(function (p) { return pinIconButtonHtml(p, selectedPinIconId); }).join('');
    renderRecentPinGrid();
  }

  /* ---- pin photos (Hunt: max 2) ---- */
  function normalizePinPhotos(arr) {
    if (!arr || !Array.isArray(arr)) return [];
    var out = [], seen = {};
    for (var i = 0; i < arr.length && out.length < PIN_PHOTO_MAX; i++) {
      var p = arr[i];
      var url = typeof p === 'string' ? p : (p && (p.dataUrl || p.url || p.src)) || '';
      if (!url || String(url).indexOf('data:image') !== 0) continue;
      var id = (p && p.id) ? String(p.id) : '';
      var fp = String(url.length) + ':' + String(url).slice(-96);
      if ((id && seen[id]) || seen[fp]) continue;
      if (id) seen[id] = true;
      seen[fp] = true;
      out.push({ id: id || ('ph_' + i + '_' + Date.now()), dataUrl: String(url) });
    }
    return out;
  }
  function renderPinEditorPhotos() {
    var wrap = $('pes-photo-thumbs');
    var countEl = $('pes-photo-count');
    var btn = $('pes-add-photo-btn');
    if (!wrap) return;
    var list = pinEditorPhotos || [];
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.classList.remove('has-photos');
      if (countEl) { countEl.hidden = true; countEl.textContent = ''; }
      if (btn) btn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M9 3l1.5 2H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h1.5L9 3zm3 5a4 4 0 100 8 4 4 0 000-8z"/>' +
        '</svg> Add photo';
      return;
    }
    wrap.classList.add('has-photos');
    if (countEl) {
      countEl.hidden = false;
      countEl.textContent = list.length + ' of ' + PIN_PHOTO_MAX + ' photos';
    }
    if (btn) {
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M9 3l1.5 2H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h1.5L9 3zm3 5a4 4 0 100 8 4 4 0 000-8z"/>' +
        '</svg> Add photo' + (list.length >= PIN_PHOTO_MAX ? ' (replace…)' : '');
    }
    list.forEach(function (ph, idx) {
      var cell = document.createElement('div');
      cell.className = 'pes-photo-thumb';
      cell.title = 'View photo';
      var img = document.createElement('img');
      img.src = ph.dataUrl;
      img.alt = 'Pin photo ' + (idx + 1);
      cell.appendChild(img);
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'pes-photo-x';
      x.title = 'Remove photo';
      x.textContent = '×';
      x.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        pinEditorPhotos = pinEditorPhotos.filter(function (p) { return String(p.id) !== String(ph.id); });
        renderPinEditorPhotos();
      });
      cell.appendChild(x);
      cell.addEventListener('click', function (ev) {
        if (ev.target === x) return;
        openPinPhotoViewer(ph.dataUrl);
      });
      wrap.appendChild(cell);
    });
  }
  function openPinPhotoViewer(dataUrl) {
    var v = $('pin-photo-viewer');
    var img = $('ppv-img');
    if (!v || !img) return;
    img.src = dataUrl;
    v.classList.add('is-open');
    v.setAttribute('aria-hidden', 'false');
  }
  function closePinPhotoViewer() {
    var v = $('pin-photo-viewer');
    if (!v) return;
    v.classList.remove('is-open');
    v.setAttribute('aria-hidden', 'true');
    if ($('ppv-img')) $('ppv-img').src = '';
  }
  function canvasFromSize(w, h, drawFn) {
    var maxEdge = 1024, nw = w, nh = h;
    if (nw > maxEdge || nh > maxEdge) {
      if (nw >= nh) { nh = Math.round(nh * maxEdge / nw); nw = maxEdge; }
      else { nw = Math.round(nw * maxEdge / nh); nh = maxEdge; }
    }
    var canvas = document.createElement('canvas');
    canvas.width = nw; canvas.height = nh;
    var ctx = canvas.getContext('2d');
    drawFn(ctx, nw, nh);
    var quality = 0.65;
    var dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > 450000 && quality > 0.42) {
      quality -= 0.07;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  }
  function compressImageFileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('No file')); return; }
      var t = String(file.type || '');
      if (t && t.indexOf('image/') !== 0 && t !== 'application/octet-stream' && t.indexOf('heic') < 0) {
        reject(new Error('Not an image')); return;
      }
      function finishOk(dataUrl) {
        if (dataUrl && String(dataUrl).indexOf('data:') === 0) resolve(dataUrl);
        else reject(new Error('Empty image'));
      }
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(file).then(function (bitmap) {
          try {
            finishOk(canvasFromSize(bitmap.width, bitmap.height, function (ctx, nw, nh) {
              ctx.drawImage(bitmap, 0, 0, nw, nh);
            }));
            try { if (bitmap.close) bitmap.close(); } catch (e) {}
          } catch (eBm) { readViaObjectUrl(); }
        }).catch(function () { readViaObjectUrl(); });
        return;
      }
      function readViaObjectUrl() {
        var url = '';
        try { url = URL.createObjectURL(file); } catch (eU) {}
        if (!url) { reject(new Error('Could not read')); return; }
        var img = new Image();
        img.onload = function () {
          try {
            finishOk(canvasFromSize(img.naturalWidth || img.width, img.naturalHeight || img.height, function (ctx, nw, nh) {
              ctx.drawImage(img, 0, 0, nw, nh);
            }));
          } catch (eD) { reject(eD); }
          try { URL.revokeObjectURL(url); } catch (eR) {}
        };
        img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} reject(new Error('Bad image')); };
        img.src = url;
      }
      readViaObjectUrl();
    });
  }
  function addPinPhotoFromFile(file) {
    if (!file) return;
    api.toast('Adding photo…');
    compressImageFileToDataUrl(file).then(function (dataUrl) {
      if ((pinEditorPhotos || []).length >= PIN_PHOTO_MAX) {
        // replace oldest
        pinEditorPhotos = pinEditorPhotos.slice(1);
      }
      pinEditorPhotos.push({ id: 'ph_' + Date.now().toString(36), dataUrl: dataUrl });
      renderPinEditorPhotos();
      api.toast('Photo added · ' + pinEditorPhotos.length + ' of ' + PIN_PHOTO_MAX);
    }).catch(function () { api.toast('Could not add photo'); });
  }
  function onPinAddPhotoClick() {
    // Hunt: prefer camera on phones when available; gallery otherwise
    var isTouch = false;
    try { isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window; } catch (e) {}
    var cam = $('pin-photo-camera-input');
    var gal = $('pin-photo-gallery-input');
    if (isTouch && cam) {
      try { cam.value = ''; cam.click(); return; } catch (e) {}
    }
    if (gal) { try { gal.value = ''; gal.click(); } catch (e2) {} }
  }

  function setWindDialDegrees(deg) {
    if (deg == null || deg === '' || isNaN(Number(deg))) {
      if ($('wind-dial-arrow')) $('wind-dial-arrow').style.transform = 'rotate(0deg)';
      if ($('wind-dial-deg')) $('wind-dial-deg').textContent = '—';
      if ($('pin-ideal-wind')) $('pin-ideal-wind').value = '';
      return;
    }
    deg = ((Number(deg) % 360) + 360) % 360;
    if ($('wind-dial-arrow')) $('wind-dial-arrow').style.transform = 'rotate(' + deg + 'deg)';
    if ($('wind-dial-deg')) {
      $('wind-dial-deg').textContent = Math.round(deg) + '° ' + getCardinal(deg);
    }
    if ($('pin-ideal-wind')) $('pin-ideal-wind').value = String(Math.round(deg));
    var dial = $('wind-dial');
    if (dial) dial.setAttribute('aria-valuenow', String(Math.round(deg)));
  }
  function syncWindDialFromInput() {
    var v = $('pin-ideal-wind') && $('pin-ideal-wind').value;
    if (v === '' || v == null) setWindDialDegrees(null);
    else setWindDialDegrees(Number(v));
  }
  function wireWindDial() {
    var dial = $('wind-dial');
    if (!dial || dial._windWired) return;
    dial._windWired = true;
    var dragging = false;
    function degFromEvent(ev) {
      var rect = dial.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var x = (ev.clientX != null ? ev.clientX : (ev.touches && ev.touches[0].clientX)) - cx;
      var y = (ev.clientY != null ? ev.clientY : (ev.touches && ev.touches[0].clientY)) - cy;
      // 0° = North (up), clockwise
      var rad = Math.atan2(x, -y);
      var deg = (rad * 180 / Math.PI + 360) % 360;
      return deg;
    }
    function onDown(ev) {
      dragging = true;
      try { dial.setPointerCapture(ev.pointerId); } catch (e) {}
      setWindDialDegrees(degFromEvent(ev));
      if (ev.preventDefault) ev.preventDefault();
    }
    function onMove(ev) {
      if (!dragging) return;
      setWindDialDegrees(degFromEvent(ev));
      if (ev.preventDefault) ev.preventDefault();
    }
    function onUp() { dragging = false; }
    dial.addEventListener('pointerdown', onDown);
    dial.addEventListener('pointermove', onMove);
    dial.addEventListener('pointerup', onUp);
    dial.addEventListener('pointercancel', onUp);
  }

  function openPinEditor(opts) {
    opts = opts || {};
    ensureMap();
    pinDraft = {
      id: opts.id || uid(),
      lat: opts.lat != null ? opts.lat : clickLat,
      lng: opts.lng != null ? opts.lng : clickLng,
      isEdit: !!(opts.mode === 'edit' || opts.id)
    };
    if (pinDraft.lat == null || pinDraft.lng == null) {
      api.toast('Tap the map first to place a spot');
      pinDraft = null;
      return;
    }
    if (opts.mode === 'edit' || opts.id) {
      selectedPinIconId = opts.icon || opts.iconId || 'tent';
      selectedPinColor = opts.color || '#e59a18';
      selectedPinInnerColor = opts.innerColor || '#ffffff';
      selectedPinGlyphColor = (opts.iconColor == null || opts.iconColor === '') ? 'natural' : opts.iconColor;
      if ($('pin-name-input')) $('pin-name-input').value = opts.name || '';
      if ($('pin-notes-input')) $('pin-notes-input').value = opts.notes || '';
      if ($('pin-hide-chk')) $('pin-hide-chk').checked = !!opts.hidden;
      var sc = (opts.pinScale != null) ? Math.round(Number(opts.pinScale) * 100) : 100;
      if ($('pin-size-slider')) $('pin-size-slider').value = String(sc);
      if ($('pin-size-val')) $('pin-size-val').textContent = String(sc);
      if ($('pes-title')) $('pes-title').textContent = 'Edit pin';
      if ($('pin-ignore-overlay')) $('pin-ignore-overlay').checked = !!opts.ignoreOverlayRules;
      if ($('pin-save-weather')) $('pin-save-weather').checked = opts.saveWeather !== false;
      if (opts.idealConditions) {
        if ($('pin-ideal-high') && opts.idealConditions.high != null) $('pin-ideal-high').value = opts.idealConditions.high;
        if ($('pin-ideal-low') && opts.idealConditions.low != null) $('pin-ideal-low').value = opts.idealConditions.low;
        if ($('pin-ideal-wind') && opts.idealConditions.windDir != null) $('pin-ideal-wind').value = opts.idealConditions.windDir;
        if ($('pin-ideal-wind-tol') && opts.idealConditions.windTol != null) $('pin-ideal-wind-tol').value = opts.idealConditions.windTol;
      } else {
        ['pin-ideal-high', 'pin-ideal-low', 'pin-ideal-wind'].forEach(function (id) {
          if ($(id)) $(id).value = '';
        });
        if ($('pin-ideal-wind-tol')) $('pin-ideal-wind-tol').value = '30';
      }
      syncWindDialFromInput();
      pinEditorPhotos = normalizePinPhotos(opts.photos || opts.notePhotos || []);
      pinNameAutoFill = '';
      try {
        if (selectedPinIconId && (opts.name || '') === (PIN_CATALOG.find(function (x) { return x.id === selectedPinIconId; }) || {}).name) {
          pinNameAutoFill = opts.name || '';
        }
      } catch (eAf) {}
    } else {
      selectedPinIconId = null;
      selectedPinColor = '#e59a18';
      selectedPinInnerColor = '#ffffff';
      selectedPinGlyphColor = 'natural';
      if ($('pin-name-input')) $('pin-name-input').value = '';
      if ($('pin-notes-input')) $('pin-notes-input').value = '';
      if ($('pin-hide-chk')) $('pin-hide-chk').checked = false;
      if ($('pin-size-slider')) $('pin-size-slider').value = '100';
      if ($('pin-size-val')) $('pin-size-val').textContent = '100';
      if ($('pes-title')) $('pes-title').textContent = 'Add pin';
      if ($('pin-ignore-overlay')) $('pin-ignore-overlay').checked = false;
      if ($('pin-save-weather')) $('pin-save-weather').checked = true;
      ['pin-ideal-high', 'pin-ideal-low', 'pin-ideal-wind'].forEach(function (id) {
        if ($(id)) $(id).value = '';
      });
      if ($('pin-ideal-wind-tol')) $('pin-ideal-wind-tol').value = '30';
      if ($('pin-icon-search')) $('pin-icon-search').value = '';
      pinEditorPhotos = [];
      pinNameAutoFill = '';
      syncWindDialFromInput();
    }
    if ($('pin-outer-color')) $('pin-outer-color').value = selectedPinColor;
    if ($('pin-color-value')) $('pin-color-value').value = selectedPinColor;
    if ($('pin-inner-color')) $('pin-inner-color').value = selectedPinInnerColor;
    if ($('pin-glyph-color')) $('pin-glyph-color').value = selectedPinGlyphColor === 'natural' ? '#000000' : selectedPinGlyphColor;
    if ($('pes-customize-panel')) $('pes-customize-panel').style.display = 'none';
    if ($('pes-customize-btn')) $('pes-customize-btn').classList.remove('is-open');
    if ($('pin-ideal-panel')) $('pin-ideal-panel').style.display = 'none';
    var cp = $('cp-pin');
    if (cp) {
      cp._cpBuilt = false;
      renderColorPicker(cp);
    }
    setPinColorSlot('pin');
    renderPinGrid();
    renderPinEditorPhotos();
    updatePinEditorPreview();
    var sheet = $('pin-editor-sheet');
    if (sheet) {
      sheet.classList.add('open');
      sheet.classList.remove('customize-open');
      sheet.setAttribute('aria-hidden', 'false');
      // Reset sheet position (centered above toolbar)
      sheet.style.left = '';
      sheet.style.top = '';
      sheet.style.right = '';
      sheet.style.bottom = '';
      sheet.style.transform = '';
      try {
        var scroll = sheet.querySelector('.pes-scroll');
        if (scroll) scroll.scrollTop = 0;
      } catch (eS) {}
    }
    setLayersOpen(false);
  }

  function closePinEditor() {
    var sheet = $('pin-editor-sheet');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.classList.remove('customize-open');
      sheet.setAttribute('aria-hidden', 'true');
    }
    pinDraft = null;
    pinEditorPhotos = [];
  }

  function savePinFromEditor() {
    if (!pinDraft) return;
    if (!selectedPinIconId) {
      api.toast('Pick a pin icon first');
      return;
    }
    var name = ($('pin-name-input') && $('pin-name-input').value.trim()) || '';
    if (!name) {
      if (selectedPinIconId === 'blank') name = 'Pin';
      else {
        var cat = PIN_CATALOG.find(function (x) { return x.id === selectedPinIconId; });
        name = cat ? cat.name : 'Pin';
      }
    }
    var notes = ($('pin-notes-input') && $('pin-notes-input').value.trim()) || '';
    var scale = (($('pin-size-slider') && Number($('pin-size-slider').value)) || 100) / 100;
    var ideal = null;
    var ih = $('pin-ideal-high') && $('pin-ideal-high').value;
    var il = $('pin-ideal-low') && $('pin-ideal-low').value;
    var iw = $('pin-ideal-wind') && $('pin-ideal-wind').value;
    var it = $('pin-ideal-wind-tol') && $('pin-ideal-wind-tol').value;
    if (ih || il || iw) {
      ideal = {
        high: ih !== '' && ih != null ? Number(ih) : null,
        low: il !== '' && il != null ? Number(il) : null,
        windDir: iw !== '' && iw != null && !isNaN(Number(iw)) ? Number(iw) : null,
        windTol: it !== '' && it != null ? Number(it) : 30
      };
    }
    var row = {
      id: pinDraft.id,
      lat: pinDraft.lat,
      lng: pinDraft.lng,
      name: name,
      notes: notes,
      icon: selectedPinIconId,
      iconId: selectedPinIconId,
      color: selectedPinColor,
      innerColor: selectedPinInnerColor,
      iconColor: selectedPinGlyphColor,
      pinScale: scale,
      hidden: !!( $('pin-hide-chk') && $('pin-hide-chk').checked ),
      ignoreOverlayRules: !!( $('pin-ignore-overlay') && $('pin-ignore-overlay').checked ),
      saveWeather: !!( $('pin-save-weather') && $('pin-save-weather').checked ),
      idealConditions: ideal,
      photos: normalizePinPhotos(pinEditorPhotos),
      updatedAt: new Date().toISOString(),
      createdAt: pinDraft.isEdit ? (pinDraft.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    // Optional: attach current weather snapshot when saving
    if (row.saveWeather && lastMapWeatherPayload && lastMapWeatherPayload.weather &&
        lastMapWeatherPayload.lat != null &&
        Math.abs(lastMapWeatherPayload.lat - row.lat) < 0.02) {
      try {
        var w = lastMapWeatherPayload.weather;
        var c = w.current || {};
        row.weatherSnapshot = {
          at: new Date().toISOString(),
          temp: c.temperature_2m,
          wind: c.wind_speed_10m,
          windDir: c.wind_direction_10m
        };
      } catch (eW) {}
    }
    var pins = (api.getPins() || []).slice();
    var idx = pins.findIndex(function (p) { return p.id === row.id; });
    if (idx >= 0) {
      row.createdAt = pins[idx].createdAt || row.createdAt;
      pins[idx] = Object.assign({}, pins[idx], row);
    } else {
      pins.push(row);
    }
    pushRecentPinIcon(selectedPinIconId);
    api.savePins(pins);
    closePinEditor();
    clearTempDot();
    redrawAll();
    api.toast('Pin saved');
  }

  function redrawAll() {
    if (!pinsLayer) return;
    pinsLayer.clearLayers();
    var loc = api.getEventLocation && api.getEventLocation();
    if (loc && loc.lat != null) {
      L.circleMarker([loc.lat, loc.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: '#e59a18', fillOpacity: 0.95
      }).bindPopup(esc(loc.label || 'Event location')).addTo(pinsLayer);
    }
    (api.getPins() || []).forEach(function (p) {
      if (p.hidden) return;
      var m = L.marker([p.lat, p.lng], { icon: leafletPinIcon(p) });
      var photoBits = '';
      var photos = normalizePinPhotos(p.photos || []);
      if (photos.length) {
        photoBits = '<div class="mdm-pin-photos" style="display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;">' +
          photos.map(function (ph) {
            return '<button type="button" data-view-photo="' + esc(ph.id) + '" style="width:56px;height:56px;padding:0;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#0a0c09;cursor:pointer;">' +
              '<img src="' + ph.dataUrl + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;"></button>';
          }).join('') + '</div>';
      }
      var html = '<div class="map-dot-menu">' +
        '<div class="mdm-title">' + esc(p.name || 'Pin') + '</div>' +
        (p.notes ? '<div class="mdm-sub">' + esc(p.notes) + '</div>' : '') +
        photoBits +
        '<div class="mdm-actions-grid">' +
        '<button type="button" class="mdm-btn weather" data-pin-weather="' + esc(p.id) + '">Get weather</button>' +
        '<button type="button" class="mdm-btn pin" data-edit-pin="' + esc(p.id) + '">Edit pin</button>' +
        '</div></div>';
      m.bindPopup(html, { className: 'map-dot-popup', maxWidth: 260 });
      m.on('popupopen', function () {
        var root = document.querySelector('.map-dot-popup');
        if (!root) return;
        var editBtn = root.querySelector('[data-edit-pin="' + p.id + '"]');
        if (editBtn) editBtn.onclick = function () {
          openPinEditor(Object.assign({ mode: 'edit' }, p));
          try { map.closePopup(); } catch (e) {}
        };
        var wBtn = root.querySelector('[data-pin-weather="' + p.id + '"]');
        if (wBtn) wBtn.onclick = function () {
          clickLat = p.lat; clickLng = p.lng;
          showWeatherAt(p.lat, p.lng);
          try { map.closePopup(); } catch (e) {}
        };
        root.querySelectorAll('[data-view-photo]').forEach(function (b) {
          b.onclick = function () {
            var ph = photos.find(function (x) { return String(x.id) === String(b.getAttribute('data-view-photo')); });
            if (ph) openPinPhotoViewer(ph.dataUrl);
          };
        });
      });
      m.addTo(pinsLayer);
    });
    redrawShareLocations();
  }

  /* ========== Share location — Hunt directional icons + 1/min ping ========== */
  function getDirIconById(id) {
    if (!id) return null;
    for (var i = 0; i < DIR_CATALOG.length; i++) {
      if (DIR_CATALOG[i].id === id) return DIR_CATALOG[i];
    }
    return null;
  }
  function normalizeDirHex(hex) {
    var h = String(hex || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      return ('#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]).toLowerCase();
    }
    return '#e11d1d';
  }
  function getShareLocIconId() {
    try { return localStorage.getItem(SHARE_ICON_KEY) || ''; } catch (e) { return ''; }
  }
  function setShareLocIconId(id) {
    try {
      if (!id) localStorage.removeItem(SHARE_ICON_KEY);
      else localStorage.setItem(SHARE_ICON_KEY, String(id));
    } catch (e) {}
  }
  function getShareLocColor() {
    try { return normalizeDirHex(localStorage.getItem(SHARE_COLOR_KEY) || api.getMyColor() || '#e11d1d'); }
    catch (e) { return '#e11d1d'; }
  }
  function setShareLocColor(c) {
    try { localStorage.setItem(SHARE_COLOR_KEY, normalizeDirHex(c)); } catch (e) {}
  }
  function getShareLocScale() {
    try {
      var s = parseFloat(localStorage.getItem(SHARE_SCALE_KEY) || '1');
      if (isNaN(s) || s <= 0) s = 1;
      return Math.max(0.4, Math.min(1.6, s));
    } catch (e) { return 1; }
  }
  function setShareLocScale(s) {
    s = Math.max(0.4, Math.min(1.6, Number(s) || 1));
    try { localStorage.setItem(SHARE_SCALE_KEY, String(s)); } catch (e) {}
  }
  function normalizeHeading(d) {
    d = Number(d);
    if (isNaN(d)) return null;
    d = d % 360;
    if (d < 0) d += 360;
    return d;
  }
  /** Recolor black silhouette PNG → solid hex + black outline (Hunt dirIconColoredMarkup) */
  function dirIconColoredMarkup(iconId, hex, size) {
    var s = size || 30;
    var ic = getDirIconById(iconId);
    if (!ic || !ic.src) return '';
    hex = normalizeDirHex(hex);
    _dirGlyphFilterSeq += 1;
    var fid = 'psdgf' + _dirGlyphFilterSeq + '_' + String(iconId || 'x').replace(/[^a-z0-9_-]/gi, '');
    var outlineR = s >= 36 ? 0.81 : (s >= 28 ? 0.72 : 0.63);
    var src = String(ic.src).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return (
      '<svg class="ps-dir-icon-svg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" ' +
        'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
        'aria-hidden="true" focusable="false" style="display:block;overflow:visible;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));">' +
        '<defs><filter id="' + fid + '" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">' +
          '<feMorphology in="SourceAlpha" operator="dilate" radius="' + outlineR + '" result="dilated"/>' +
          '<feFlood flood-color="#000000" flood-opacity="1" result="black"/>' +
          '<feComposite in="black" in2="dilated" operator="in" result="outline"/>' +
          '<feFlood flood-color="' + hex + '" flood-opacity="1" result="flood"/>' +
          '<feComposite in="flood" in2="SourceAlpha" operator="in" result="fill"/>' +
          '<feMerge><feMergeNode in="outline"/><feMergeNode in="fill"/></feMerge>' +
        '</filter></defs>' +
        '<image width="' + s + '" height="' + s + '" href="' + src + '" xlink:href="' + src + '" ' +
          'filter="url(#' + fid + ')" preserveAspectRatio="xMidYMid meet"/>' +
      '</svg>'
    );
  }
  function buildDirBodyHtml(color, heading, iconId, sizePx) {
    var rot = heading != null && !isNaN(heading) ? (((Number(heading) % 360) + 360) % 360) : 0;
    var c = normalizeDirHex(color || '#e11d1d');
    var ic = getDirIconById(iconId);
    if (ic) {
      var front = (ic.frontDeg != null && !isNaN(ic.frontDeg)) ? Number(ic.frontDeg) : 0;
      var cssRot = ((rot - front) % 360 + 360) % 360;
      var s = sizePx || 30;
      return (
        '<div class="ps-dir-rot" data-front="' + front + '" style="width:' + s +
          'px;height:' + s + 'px;transform:rotate(' + cssRot.toFixed(1) +
          'deg);transform-origin:center center;will-change:transform;line-height:0;">' +
          dirIconColoredMarkup(ic.id, c, s) +
        '</div>'
      );
    }
    // Default triangle (Hunt GPS arrow)
    var w = sizePx ? Math.round(sizePx * 0.8) : 24;
    var h = sizePx ? Math.round(sizePx * 1.13) : 34;
    return (
      '<div class="ps-dir-rot" data-front="0" style="width:' + w + 'px;height:' + h +
        'px;transform:rotate(' + rot.toFixed(1) + 'deg);transform-origin:center center;will-change:transform;">' +
        '<svg viewBox="0 0 24 32" width="' + w + '" height="' + h + '" style="display:block;">' +
          '<path d="M12 1.5 L22.5 29.5 L12 23.2 L1.5 29.5 Z" fill="' + c +
            '" stroke="#000" stroke-width="0.9" stroke-linejoin="round"/>' +
        '</svg></div>'
    );
  }
  /** Hunt party marker: label above, directional glyph centered on lat/lng */
  function shareLocDivIcon(Lx) {
    var name = esc((Lx && (Lx.name || Lx.display_name) || 'Member').slice(0, 16));
    var c = normalizeDirHex((Lx && Lx.color) || getShareLocColor());
    var iconId = (Lx && (Lx.iconId || Lx.icon)) || getShareLocIconId() || null;
    var heading = Lx && Lx.heading != null ? normalizeHeading(Lx.heading) : null;
    var scale = Lx && Lx.scale != null ? Number(Lx.scale) : getShareLocScale();
    if (isNaN(scale) || scale <= 0) scale = 1;
    scale = Math.max(0.4, Math.min(1.6, scale));
    var s = Math.round(30 * scale);
    s = Math.max(14, Math.min(56, s));
    var ic = getDirIconById(iconId);
    var gw = ic ? s : Math.round(s * 0.8);
    var gh = ic ? s : Math.round(s * 1.13);
    var labelCss =
      'position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:3px;' +
      'font-size:10px;font-weight:800;color:#fff;text-shadow:0 0 3px #000,0 1px 2px #000;' +
      'background:rgba(0,0,0,.55);padding:1px 5px;border-radius:4px;max-width:90px;' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;line-height:1.2;';
    var html =
      '<div class="ps-share-loc-marker" style="position:relative;width:' + gw + 'px;height:' + gh +
        'px;pointer-events:auto;overflow:visible;">' +
        '<div class="ps-share-label" style="' + labelCss + '">' + name + '</div>' +
        buildDirBodyHtml(c, heading, iconId, s) +
      '</div>';
    return L.divIcon({
      className: 'ps-share-loc-icon',
      html: html,
      iconSize: [gw, gh],
      iconAnchor: [gw / 2, gh / 2]
    });
  }
  function broadcastShareLoc(force) {
    if (!shareLocOn || shareLastLat == null) return;
    var payload = {
      lat: shareLastLat,
      lng: shareLastLng,
      heading: shareHeading,
      at: new Date().toISOString(),
      name: api.getMyName(),
      color: getShareLocColor(),
      iconId: getShareLocIconId() || null,
      scale: getShareLocScale()
    };
    api.onShareLocation(payload);
    redrawShareLocations();
  }
  function paintSelfShareMarker() {
    if (!map || shareLastLat == null) return;
    var Lx = {
      lat: shareLastLat, lng: shareLastLng,
      name: 'You', color: getShareLocColor(),
      iconId: getShareLocIconId() || null,
      heading: shareHeading, scale: getShareLocScale()
    };
    if (gpsMarker) try { map.removeLayer(gpsMarker); } catch (e) {}
    try {
      gpsMarker = L.marker([shareLastLat, shareLastLng], {
        icon: shareLocDivIcon(Lx),
        interactive: true
      }).on('click', function (e) {
        try { L.DomEvent.stopPropagation(e); } catch (eS) {}
        openShareMemberMenu(api.getMyId(), Lx, true);
      }).addTo(map);
    } catch (eMk) {
      gpsMarker = L.circleMarker([shareLastLat, shareLastLng], {
        radius: 8, color: '#fff', weight: 2, fillColor: getShareLocColor(), fillOpacity: 1
      }).addTo(map);
    }
  }
  function startHeadingWatch() {
    stopHeadingWatch();
    function onOrient(ev) {
      var h = null;
      if (ev && ev.webkitCompassHeading != null && !isNaN(ev.webkitCompassHeading)) {
        h = Number(ev.webkitCompassHeading);
      } else if (ev && ev.alpha != null && !isNaN(ev.alpha)) {
        // absolute / relative — invert alpha for compass-ish heading
        h = (360 - Number(ev.alpha)) % 360;
      }
      h = normalizeHeading(h);
      if (h == null) return;
      var prev = shareHeading;
      shareHeading = h;
      // Smooth local rotate without full rebuild when possible
      try {
        if (gpsMarker && gpsMarker.getElement) {
          var el = gpsMarker.getElement();
          var rot = el && el.querySelector && el.querySelector('.ps-dir-rot');
          if (rot) {
            var front = parseFloat(rot.getAttribute('data-front') || '0') || 0;
            var cssRot = ((h - front) % 360 + 360) % 360;
            rot.style.transform = 'rotate(' + cssRot.toFixed(1) + 'deg)';
            return;
          }
        }
      } catch (eR) {}
      if (prev == null || Math.abs(((h - prev + 540) % 360) - 180) > 8) {
        paintSelfShareMarker();
      }
    }
    shareHeadingHandler = onOrient;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (state) {
          if (state === 'granted') {
            window.addEventListener('deviceorientationabsolute', onOrient, true);
            window.addEventListener('deviceorientation', onOrient, true);
          }
        }).catch(function () {
          window.addEventListener('deviceorientation', onOrient, true);
        });
      } else {
        window.addEventListener('deviceorientationabsolute', onOrient, true);
        window.addEventListener('deviceorientation', onOrient, true);
      }
    } catch (eH) {
      try { window.addEventListener('deviceorientation', onOrient, true); } catch (e2) {}
    }
  }
  function stopHeadingWatch() {
    if (!shareHeadingHandler) return;
    try { window.removeEventListener('deviceorientationabsolute', shareHeadingHandler, true); } catch (e) {}
    try { window.removeEventListener('deviceorientation', shareHeadingHandler, true); } catch (e2) {}
    shareHeadingHandler = null;
  }

  function setShareLocation(on) {
    shareLocOn = !!on;
    var btn = $('share-loc-btn');
    if (btn) {
      btn.classList.toggle('is-sharing', shareLocOn);
      btn.classList.toggle('is-pulse', shareLocOn);
      btn.setAttribute('aria-pressed', shareLocOn ? 'true' : 'false');
      btn.title = shareLocOn
        ? 'Sharing location with group (updates ~1 min) — tap to stop'
        : 'Show other members my location';
    }
    if (shareWatch != null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(shareWatch); } catch (e) {}
      shareWatch = null;
    }
    if (sharePingTimer) {
      clearInterval(sharePingTimer);
      sharePingTimer = null;
    }
    stopHeadingWatch();
    if (!shareLocOn) {
      api.onShareLocation(null);
      if (gpsMarker && map) try { map.removeLayer(gpsMarker); } catch (eG) {}
      gpsMarker = null;
      shareLastLat = shareLastLng = null;
      shareHeading = null;
      redrawShareLocations();
      return;
    }
    if (!navigator.geolocation) {
      api.toast('Location not available');
      setShareLocation(false);
      return;
    }
    startHeadingWatch();
    // Local GPS for smooth self-marker; group broadcast once per minute
    shareWatch = navigator.geolocation.watchPosition(function (pos) {
      shareLastLat = pos.coords.latitude;
      shareLastLng = pos.coords.longitude;
      if (pos.coords.heading != null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
        shareHeading = normalizeHeading(pos.coords.heading);
      }
      paintSelfShareMarker();
    }, function () {
      api.toast('Could not get location');
      setShareLocation(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    // Immediate first ping + every 60s
    function doPing() {
      if (!shareLocOn) return;
      if (shareLastLat != null) {
        broadcastShareLoc(true);
        return;
      }
      navigator.geolocation.getCurrentPosition(function (pos) {
        shareLastLat = pos.coords.latitude;
        shareLastLng = pos.coords.longitude;
        if (pos.coords.heading != null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
          shareHeading = normalizeHeading(pos.coords.heading);
        }
        paintSelfShareMarker();
        broadcastShareLoc(true);
      }, function () {}, { enableHighAccuracy: true, timeout: 15000 });
    }
    doPing();
    sharePingTimer = setInterval(doPing, SHARE_PING_MS);
    api.toast('Sharing location · updates about once a minute');
  }

  function openDirIconPicker(opts) {
    opts = opts || {};
    _dirPickerOnPick = typeof opts.onPick === 'function' ? opts.onPick : null;
    _dirPickerSelected = opts.currentId || null;
    _dirPickerColor = normalizeDirHex(opts.currentColor || getShareLocColor());
    var sc = opts.currentScale != null ? Number(opts.currentScale) : getShareLocScale();
    if (isNaN(sc) || sc <= 0) sc = 1;
    _dirPickerScale = Math.max(0.4, Math.min(1.6, sc));
    var modal = $('ps-dir-icon-picker');
    if (!modal) {
      // fallback: settings grid only
      if (_dirPickerOnPick) _dirPickerOnPick(_dirPickerSelected, _dirPickerColor, _dirPickerScale);
      return;
    }
    var title = $('ps-dip-title');
    if (title) title.textContent = opts.title || 'Your location marker';
    var col = $('ps-dip-color');
    if (col) col.value = _dirPickerColor;
    var size = $('ps-dip-size');
    var sizeVal = $('ps-dip-size-val');
    var pct = Math.round(_dirPickerScale * 100);
    if (size) size.value = String(pct);
    if (sizeVal) sizeVal.textContent = String(pct);
    renderDirIconPickerGrid();
    updateDipPreview();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeDirIconPicker() {
    var modal = $('ps-dir-icon-picker');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    _dirPickerOnPick = null;
  }
  function updateDipPreview() {
    var prev = $('ps-dip-preview');
    if (!prev) return;
    var s = Math.round(30 * _dirPickerScale);
    s = Math.max(18, Math.min(48, s));
    prev.innerHTML = buildDirBodyHtml(_dirPickerColor, 0, _dirPickerSelected, s);
  }
  function renderDirIconPickerGrid() {
    var grid = $('ps-dip-grid');
    if (!grid) return;
    var cells = '';
    // Default triangle
    cells +=
      '<button type="button" class="dir-icon-cell' + (!_dirPickerSelected ? ' selected' : '') +
        '" data-dip-id="" title="Default arrow">' +
        '<svg class="dir-default-map-arrow" viewBox="0 0 24 32" width="26" height="34">' +
          '<path d="M12 1.5 L22.5 29.5 L12 23.2 L1.5 29.5 Z" fill="' +
          normalizeDirHex(_dirPickerColor) + '" stroke="#000" stroke-width="0.9" stroke-linejoin="round"/>' +
        '</svg></button>';
    DIR_CATALOG.forEach(function (d) {
      var on = String(d.id) === String(_dirPickerSelected);
      cells +=
        '<button type="button" class="dir-icon-cell' + (on ? ' selected' : '') +
          '" data-dip-id="' + esc(d.id) + '" title="' + esc(d.name) + '">' +
          dirIconColoredMarkup(d.id, _dirPickerColor, 28) +
        '</button>';
    });
    grid.innerHTML = cells;
    grid.querySelectorAll('[data-dip-id]').forEach(function (b) {
      b.onclick = function () {
        _dirPickerSelected = b.getAttribute('data-dip-id') || null;
        if (_dirPickerSelected === '') _dirPickerSelected = null;
        renderDirIconPickerGrid();
        updateDipPreview();
      };
    });
  }
  function wireDirIconPickerOnce() {
    if (document._psDipWired) return;
    document._psDipWired = true;
    var modal = $('ps-dir-icon-picker');
    if (!modal) return;
    var col = $('ps-dip-color');
    if (col) {
      col.addEventListener('input', function () {
        _dirPickerColor = normalizeDirHex(col.value);
        renderDirIconPickerGrid();
        updateDipPreview();
      });
    }
    var size = $('ps-dip-size');
    if (size) {
      size.addEventListener('input', function () {
        var pct = parseInt(size.value, 10) || 100;
        pct = Math.max(40, Math.min(160, pct));
        _dirPickerScale = pct / 100;
        var lab = $('ps-dip-size-val');
        if (lab) lab.textContent = String(pct);
        updateDipPreview();
      });
    }
    function doCancel() { closeDirIconPicker(); }
    var cancel = $('ps-dip-cancel');
    if (cancel) cancel.onclick = doCancel;
    var cancel2 = $('ps-dip-cancel2');
    if (cancel2) cancel2.onclick = doCancel;
    var ok = $('ps-dip-ok');
    if (ok) {
      ok.onclick = function () {
        var cb = _dirPickerOnPick;
        var id = _dirPickerSelected || null;
        var color = normalizeDirHex(_dirPickerColor);
        var scale = Math.max(0.4, Math.min(1.6, _dirPickerScale || 1));
        closeDirIconPicker();
        if (cb) {
          try { cb(id, color, scale); } catch (e) {}
        }
      };
    }
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeDirIconPicker();
    });
  }

  function openShareMemberMenu(uid, Lx, isSelf) {
    if (!map || !Lx) return;
    wireDirIconPickerOnce();
    if (isSelf) {
      openDirIconPicker({
        title: 'Your location marker',
        currentId: getShareLocIconId() || null,
        currentColor: getShareLocColor(),
        currentScale: getShareLocScale(),
        onPick: function (id, color, scale) {
          setShareLocIconId(id || '');
          if (color) setShareLocColor(color);
          if (scale != null) setShareLocScale(scale);
          paintSelfShareMarker();
          if (shareLocOn) broadcastShareLoc(true);
          api.toast('Marker updated');
        }
      });
      return;
    }
    try {
      L.popup({ maxWidth: 240 })
        .setLatLng([Lx.lat, Lx.lng])
        .setContent(
          '<strong style="color:' + esc(Lx.color || '#e59a18') + '">' +
            esc(Lx.name || 'Member') + '</strong><br>' +
          '<span class="muted" style="font-size:11px">Live location' +
            (Lx.heading != null ? ' · facing' : '') + '</span>'
        )
        .openOn(map);
    } catch (eP) {}
  }

  function fillShareIconSettingsGrid() {
    wireDirIconPickerOnce();
    var wrap = $('ms-share-icon-grid');
    if (!wrap) return;
    var id = getShareLocIconId();
    var color = getShareLocColor();
    var scale = getShareLocScale();
    var pct = Math.round(scale * 100);
    var s = Math.round(28 * scale);
    s = Math.max(18, Math.min(40, s));
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;width:100%;flex-wrap:wrap">' +
        '<div style="width:48px;height:48px;border-radius:10px;background:#fff;border:1px solid #ccc;' +
          'display:flex;align-items:center;justify-content:center;">' +
          buildDirBodyHtml(color, 0, id, s) +
        '</div>' +
        '<div style="flex:1;min-width:120px">' +
          '<div style="font-size:12px;font-weight:800;color:#fff">' +
            esc(id ? ((getDirIconById(id) || {}).name || id) : 'Default arrow') +
            ' · ' + pct + '%</div>' +
          '<div class="muted" style="font-size:11px;margin-top:2px">Icon · color · size (Hunt style)</div>' +
        '</div>' +
        '<button type="button" class="btn btn-primary" id="ms-open-dir-picker" style="font-size:12px">Change marker</button>' +
      '</div>';
    var btn = $('ms-open-dir-picker');
    if (btn) {
      btn.onclick = function () {
        openDirIconPicker({
          title: 'Your location marker',
          currentId: getShareLocIconId() || null,
          currentColor: getShareLocColor(),
          currentScale: getShareLocScale(),
          onPick: function (nid, ncolor, nscale) {
            setShareLocIconId(nid || '');
            if (ncolor) setShareLocColor(ncolor);
            if (nscale != null) setShareLocScale(nscale);
            fillShareIconSettingsGrid();
            if (shareLocOn) {
              paintSelfShareMarker();
              broadcastShareLoc(true);
            }
          }
        });
      };
    }
    var clear = $('ms-share-icon-clear');
    if (clear) {
      clear.onclick = function () {
        setShareLocIconId('');
        setShareLocScale(1);
        fillShareIconSettingsGrid();
      };
      clear.textContent = 'Reset to default arrow';
    }
  }

  function redrawShareLocations() {
    if (!shareLayer) return;
    shareLayer.clearLayers();
    var locs = api.getShareLocations() || {};
    var me = api.getMyId();
    Object.keys(locs).forEach(function (uid) {
      var Lx = locs[uid];
      if (!Lx || Lx.lat == null) return;
      if (String(uid) === String(me) && shareLocOn) return;
      try {
        var isSelf = String(uid) === String(me);
        var mk = L.marker([Lx.lat, Lx.lng], { icon: shareLocDivIcon(Lx), interactive: true });
        mk.on('click', function (e) {
          try { L.DomEvent.stopPropagation(e); } catch (eS) {}
          openShareMemberMenu(uid, Lx, isSelf);
        });
        mk.addTo(shareLayer);
      } catch (eM) {
        L.circleMarker([Lx.lat, Lx.lng], {
          radius: 8, color: '#fff', weight: 2, fillColor: Lx.color || '#4a6d9a', fillOpacity: 0.95
        }).bindPopup(esc(Lx.name || 'Member')).addTo(shareLayer);
      }
    });
  }
  function goGps() {
    ensureMap();
    if (!navigator.geolocation || !map) return;
    var btn = $('gps-snap-btn');
    if (btn) btn.classList.add('is-on');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      // Current location = pure snap (no map-dot menu)
      map.setView([lat, lng], 14, { animate: true });
      updateCoordHud(lat, lng);
      if (gpsMarker) try { map.removeLayer(gpsMarker); } catch (e) {}
      gpsMarker = L.circleMarker([lat, lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: api.getMyColor(), fillOpacity: 1
      }).bindPopup('You').addTo(map);
      setTimeout(function () { if (btn) btn.classList.remove('is-on'); }, 1200);
    }, function () {
      if (btn) btn.classList.remove('is-on');
      api.toast('Could not get location. Allow location access.');
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  /* radar */
  function stopRadar() {
    radarActive = false;
    if (radarTimer) { clearTimeout(radarTimer); radarTimer = null; }
    radarFrames = []; radarIdx = 0;
    radarLayers.forEach(function (ly, i) {
      if (ly && map) try { map.removeLayer(ly); } catch (e) {}
      radarLayers[i] = null;
    });
    if ($('map-radar-toggle')) $('map-radar-toggle').setAttribute('aria-pressed', 'false');
    if ($('map-radar-control')) $('map-radar-control').classList.remove('radar-on');
    if ($('map-radar-hud')) $('map-radar-hud').classList.remove('is-on');
    if ($('map-radar-layer')) $('map-radar-layer').checked = false;
  }
  function setRadarClock(ts) {
    var el = $('map-radar-clock');
    if (!el) return;
    if (!ts) { el.textContent = '—'; return; }
    try { el.textContent = new Date(ts * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { el.textContent = '—'; }
  }
  function showRadarFrame(i) {
    if (!radarActive || !map || !radarFrames.length) return;
    radarIdx = i % radarFrames.length;
    var frame = radarFrames[radarIdx];
    setRadarClock(frame.time);
    var url = frame.host + frame.path + '/256/{z}/{x}/{y}/2/1_1.png';
    var next = radarLayers[1];
    var prev = radarLayers[0];
    if (!next) {
      next = L.tileLayer(url, {
        opacity: RADAR_OPACITY, zIndex: 20, maxZoom: MAP_MAX_ZOOM, maxNativeZoom: 10,
        updateWhenZooming: false, errorTileUrl: ''
      }).addTo(map);
      radarLayers[1] = next;
    } else {
      next.setUrl(url);
      next.setOpacity(RADAR_OPACITY);
    }
    if (prev) try { prev.setOpacity(0); } catch (e) {}
    radarLayers = [next, prev];
    radarTimer = setTimeout(function () { if (radarActive) showRadarFrame(radarIdx + 1); }, 700);
  }
  function startRadar() {
    ensureMap();
    if (radarActive) { stopRadar(); return; }
    if (drawMode) cancelDraw();
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var host = data.host;
        var past = (data.radar && data.radar.past) || [];
        var nowcast = (data.radar && data.radar.nowcast) || [];
        var frames = past.concat(nowcast).slice(-12);
        if (!frames.length) { api.toast('Radar unavailable'); return; }
        radarFrames = frames.map(function (f) { return { host: host, path: f.path, time: f.time }; });
        radarActive = true;
        if ($('map-radar-toggle')) $('map-radar-toggle').setAttribute('aria-pressed', 'true');
        if ($('map-radar-control')) $('map-radar-control').classList.add('radar-on');
        if ($('map-radar-hud')) $('map-radar-hud').classList.add('is-on');
        if ($('map-radar-layer')) $('map-radar-layer').checked = true;
        showRadarFrame(0);
      })
      .catch(function () { api.toast('Radar unavailable'); });
  }
  function toggleRadar() { if (radarActive) stopRadar(); else startRadar(); }

  function runSearch(q) {
    ensureMap();
    q = String(q || '').trim();
    var box = $('map-search-results');
    if (!q) { if (box) box.innerHTML = ''; return; }
    var m = q.match(/^(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)$/);
    if (m) {
      var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], 14);
        placeMapDot({ lat: lat, lng: lng });
        if (box) box.innerHTML = '';
        return;
      }
    }
    if (box) box.innerHTML = '<div class="map-search-status">Searching…</div>';
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(q), {
      headers: { Accept: 'application/json' }
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!box) return;
      if (!data || !data.length) { box.innerHTML = '<div class="map-search-status">No results</div>'; return; }
      box.innerHTML = data.map(function (r) {
        return '<button type="button" class="map-search-item" data-lat="' + esc(r.lat) + '" data-lng="' + esc(r.lon) + '">' +
          '<div class="msi-label">' + esc(r.display_name) + '</div></button>';
      }).join('');
    }).catch(function () {
      if (box) box.innerHTML = '<div class="map-search-status">Search failed</div>';
    });
  }

  function setLayersOpen(open) {
    var menu = $('map-layers-menu');
    var btn = $('map-layers-toggle-btn');
    if (!menu) return;
    menu.classList.toggle('open', !!open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  var _uiWired = false;
  function wireUi() {
    if (_uiWired) return;
    _uiWired = true;
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

    /* Capture-phase delegation on the bar so tools always fire above any hit-layer quirks */
    var bar = $('map-bottom-bar');
    if (bar) {
      bar.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('#mdt-measure')) {
          e.preventDefault(); e.stopPropagation();
          startMeasure();
          return;
        }
        if (t.closest('#mdt-draw')) {
          e.preventDefault(); e.stopPropagation();
          startDraw();
          return;
        }
        if (t.closest('#gps-snap-btn')) {
          e.preventDefault(); e.stopPropagation();
          goGps();
          return;
        }
        if (t.closest('#share-loc-btn')) {
          e.preventDefault(); e.stopPropagation();
          setShareLocation(!shareLocOn);
          return;
        }
        if (t.closest('#map-radar-toggle')) {
          e.preventDefault(); e.stopPropagation();
          toggleRadar();
          return;
        }
        if (t.closest('#map-radar-stop')) {
          e.preventDefault(); e.stopPropagation();
          stopRadar();
          return;
        }
        if (t.closest('#map-layers-toggle-btn')) {
          e.preventDefault(); e.stopPropagation();
          var sc = $('map-search-chrome');
          if (sc) sc.classList.remove('is-open');
          var menu = $('map-layers-menu');
          setLayersOpen(!(menu && menu.classList.contains('open')));
          return;
        }
        if (t.closest('#map-layers-menu')) e.stopPropagation();
      }, true);
    }

    on('mdt-undo', 'click', function () { if (drawPoints.length) { drawPoints.pop(); refreshDrawPreview(); } });
    on('mdt-finish', 'click', finishDraw);
    on('mdt-cancel', 'click', cancelDraw);
    on('map-layers-panel', 'change', function (e) {
      var t = e.target; if (!t) return;
      ensureMap();
      if (t.name === 'map-basemap') {
        var k = t.value === 'street' ? 'streets' : t.value;
        setBasemap(k);
      }
      else if (t.id === 'map-labels-toggle') setLabels(!!t.checked);
      else if (t.id === 'map-radar-layer' && t.checked !== radarActive) toggleRadar();
    });
    on('map-search-toggle', 'click', function (e) {
      e.stopPropagation(); setLayersOpen(false);
      var chrome = $('map-search-chrome'), panel = $('map-search-panel');
      if (!chrome) return;
      var open = !chrome.classList.contains('is-open');
      chrome.classList.toggle('is-open', open);
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (panel) panel.hidden = !open;
      if (open && $('map-search-input')) $('map-search-input').focus();
    });
    on('map-search-clear', 'click', function () {
      if ($('map-search-input')) $('map-search-input').value = '';
      if ($('map-search-results')) $('map-search-results').innerHTML = '';
    });
    on('map-search-input', 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runSearch(this.value); }
    });
    on('map-search-results', 'click', function (e) {
      var b = e.target.closest('[data-lat]');
      if (!b || !map) return;
      var lat = parseFloat(b.getAttribute('data-lat')), lng = parseFloat(b.getAttribute('data-lng'));
      map.setView([lat, lng], 14);
      placeMapDot({ lat: lat, lng: lng });
      if ($('map-search-chrome')) $('map-search-chrome').classList.remove('is-open');
    });

    // Pin editor
    function onPickPinIcon(e) {
      var b = e.target.closest('[data-pin-icon]');
      if (!b) return;
      selectedPinIconId = b.getAttribute('data-pin-icon');
      var cat = selectedPinIconId === 'blank'
        ? { name: 'Pin' }
        : PIN_CATALOG.find(function (x) { return x.id === selectedPinIconId; });
      if (cat && $('pin-name-input')) {
        var cur = $('pin-name-input').value.trim();
        if (!cur || cur === pinNameAutoFill) {
          $('pin-name-input').value = cat.name;
          pinNameAutoFill = cat.name;
        }
      }
      if (selectedPinIconId && selectedPinIconId !== 'blank') {
        var def = PIN_CATALOG.find(function (x) { return x.id === selectedPinIconId; });
        if (def && def.defaultColor && !pinDraft) selectedPinColor = def.defaultColor;
      }
      renderPinGrid();
      updatePinEditorPreview();
    }
    on('pin-icon-grid', 'click', onPickPinIcon);
    on('pin-icon-recent', 'click', onPickPinIcon);
    on('pin-icon-search', 'input', renderPinGrid);
    on('pin-name-input', 'input', function () {
      // user typed a custom name — stop auto-fill overwrite
      if (this.value.trim() !== pinNameAutoFill) pinNameAutoFill = '';
    });
    on('pes-customize-btn', 'click', function () {
      var panel = $('pes-customize-panel');
      var sheet = $('pin-editor-sheet');
      if (!panel) return;
      var isHidden = panel.style.display === 'none' || getComputedStyle(panel).display === 'none';
      if (isHidden) {
        panel.style.display = 'block';
        this.classList.add('is-open');
        if (sheet) sheet.classList.add('customize-open');
        setPinColorSlot(pinColorSlot || 'pin');
        updatePinEditorPreview();
        // Keep customize options on screen — no need to scroll hunting for them
        try {
          var scroll = sheet && sheet.querySelector('.pes-scroll');
          if (scroll) {
            // Bring customize section near top of the scroll area
            var top = this.offsetTop - 8;
            scroll.scrollTop = Math.max(0, top);
          }
          this.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (eSc) {}
      } else {
        panel.style.display = 'none';
        this.classList.remove('is-open');
        if (sheet) sheet.classList.remove('customize-open');
      }
    });
    on('pes-ideal-btn', 'click', function () {
      var p = $('pin-ideal-panel');
      if (!p) return;
      var open = p.style.display === 'none' || !p.style.display;
      p.style.display = open ? 'block' : 'none';
      if (open) syncWindDialFromInput();
    });
    wireWindDial();
    on('pes-slot-pin', 'click', function () { setPinColorSlot('pin'); });
    on('pes-slot-inside', 'click', function () { setPinColorSlot('inside'); });
    on('pes-slot-icon', 'click', function () { setPinColorSlot('icon'); });
    on('pin-size-slider', 'input', function () {
      if ($('pin-size-val')) $('pin-size-val').textContent = this.value;
      updatePinEditorPreview();
    });
    on('pes-save', 'click', savePinFromEditor);
    on('pes-cancel', 'click', closePinEditor);
    on('pes-close', 'click', closePinEditor);
    on('pes-add-photo-btn', 'click', function (e) { e.preventDefault(); onPinAddPhotoClick(); });
    on('pin-photo-gallery-input', 'change', function () {
      if (this.files && this.files[0]) addPinPhotoFromFile(this.files[0]);
      try { this.value = ''; } catch (e) {}
    });
    on('pin-photo-camera-input', 'change', function () {
      if (this.files && this.files[0]) addPinPhotoFromFile(this.files[0]);
      try { this.value = ''; } catch (e) {}
    });
    on('ppv-close', 'click', closePinPhotoViewer);
    on('pin-photo-viewer', 'click', function (e) {
      if (e.target === this || e.target.id === 'ppv-close') closePinPhotoViewer();
    });

    document.addEventListener('click', function (e) {
      var menu = $('map-layers-menu');
      if (menu && menu.classList.contains('open') && !(e.target.closest && e.target.closest('#map-layers-menu'))) {
        setLayersOpen(false);
      }
      var ch = $('draw-mode-chooser');
      if (ch && ch.classList.contains('open')) {
        if (ch.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#mdt-draw')) return;
        hideDrawChooser();
      }
    });
  }

  global.PlanMap = {
    configure: function (opts) {
      if (!opts) return;
      Object.keys(opts).forEach(function (k) { api[k] = opts[k]; });
    },
    ensure: ensureMap,
    setBasemap: setBasemap,
    setLabels: setLabels,
    redraw: redrawAll,
    goGps: goGps,
    followEventLocation: followEventLocation,
    showWeatherAt: showWeatherAt,
    toggleRadar: toggleRadar,
    stopRadar: stopRadar,
    setShareLocation: setShareLocation,
    isSharing: function () { return shareLocOn; },
    setCoordHudEnabled: setCoordHudEnabled,
    fillShareIconSettingsGrid: fillShareIconSettingsGrid,
    getShareLocIconId: getShareLocIconId,
    setShareLocIconId: setShareLocIconId,
    openPinEditor: openPinEditor,
    cancelDraw: cancelDraw,
    homeView: function () { ensureMap(); if (map) map.setView(HUNT_CENTER, HUNT_ZOOM, { animate: true }); },
    invalidate: function () { if (map) try { map.invalidateSize(); } catch (e) {} },
    getMap: function () { return map; },
    wire: wireUi,
    /** Export for future apps */
    PIN_CATALOG: PIN_CATALOG,
    DIR_CATALOG: DIR_CATALOG,
    COLOR_PRESETS_FIXED: COLOR_PRESETS_FIXED
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { wireUi(); bindMapDotDelegate(); });
  else { wireUi(); bindMapDotDelegate(); }
})(typeof window !== 'undefined' ? window : this);
