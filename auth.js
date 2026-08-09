/* PlanSlayer auth — same Supabase project + username scheme as Hunt/Reg */
(function () {
  'use strict';

  var SB_URL = 'https://grvhmktqzrivbqbczkii.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdydmhta3RxenJpdmJxYmN6a2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDQ0MTIsImV4cCI6MjEwMTI4MDQxMn0.fFfrS-7w45IzxwOvvyYDB5ngLnyTz-Ru7XVL5LZXm4o';
  var EMAIL_DOMAIN = 'users.regslayer.local';

  var sb = null;
  var sessionUser = null;
  var profile = null;
  var authReadyResolve = null;
  var authReady = new Promise(function (r) { authReadyResolve = r; });

  function $(id) { return document.getElementById(id); }

  function normalizeUsername(u) {
    return String(u || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function syntheticEmail(username) {
    return normalizeUsername(username) + '@' + EMAIL_DOMAIN;
  }

  function setAuthError(msg) {
    var el = $('auth-error');
    if (el) el.textContent = msg || '';
  }

  function showAuthPanel(name) {
    ['signin', 'signup', 'recover'].forEach(function (p) {
      var el = $('auth-panel-' + p);
      if (el) el.style.display = p === name ? 'block' : 'none';
    });
    setAuthError('');
  }

  function setGateVisible(show) {
    var gate = $('auth-gate');
    var app = $('app-root');
    if (gate) {
      gate.classList.toggle('is-open', !!show);
      gate.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (app) app.style.display = show ? 'none' : '';
  }

  async function loadProfile(uid) {
    if (!sb || !uid) return null;
    try {
      var res = await sb.from('profiles').select('id, username, display_name, arrow_color').eq('id', uid).maybeSingle();
      if (res.error) return null;
      profile = res.data || null;
      return profile;
    } catch (e) {
      return null;
    }
  }

  async function ensureClient() {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase SDK missing');
    sb = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.__psSb = sb;
    return sb;
  }

  async function refreshSession() {
    await ensureClient();
    var { data } = await sb.auth.getSession();
    sessionUser = (data && data.session && data.session.user) || null;
    window.__psUser = sessionUser;
    if (sessionUser) {
      await loadProfile(sessionUser.id);
      setGateVisible(false);
      try {
        if (window.PlanSlayerApp && typeof window.PlanSlayerApp.onAuth === 'function') {
          window.PlanSlayerApp.onAuth(sessionUser, profile);
        }
      } catch (eA) {}
    } else {
      profile = null;
      setGateVisible(true);
    }
    if (authReadyResolve) {
      authReadyResolve({ user: sessionUser, profile: profile });
      authReadyResolve = null;
    }
    return sessionUser;
  }

  async function signIn(username, password) {
    await ensureClient();
    var u = normalizeUsername(username);
    if (!u || !password) throw new Error('Username and password required');
    var { data, error } = await sb.auth.signInWithPassword({
      email: syntheticEmail(u),
      password: password
    });
    if (error) throw error;
    sessionUser = data.user;
    await loadProfile(sessionUser.id);
    setGateVisible(false);
    try {
      if (window.PlanSlayerApp && window.PlanSlayerApp.onAuth) {
        window.PlanSlayerApp.onAuth(sessionUser, profile);
      }
    } catch (e) {}
    return sessionUser;
  }

  async function signUp(username, password, displayName) {
    await ensureClient();
    var u = normalizeUsername(username);
    if (!u || u.length < 3) throw new Error('Username must be at least 3 characters');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    var email = syntheticEmail(u);
    var { data, error } = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: u,
          display_name: (displayName && String(displayName).trim()) || u
        }
      }
    });
    if (error) throw error;
    // Profile row may be created by existing Hunt/Reg triggers; best-effort upsert
    try {
      if (data.user) {
        await sb.from('profiles').upsert({
          id: data.user.id,
          username: u,
          display_name: (displayName && String(displayName).trim()) || u
        }, { onConflict: 'id' });
      }
    } catch (eP) {}
    if (data.session) {
      sessionUser = data.user;
      await loadProfile(sessionUser.id);
      setGateVisible(false);
      try {
        if (window.PlanSlayerApp && window.PlanSlayerApp.onAuth) {
          window.PlanSlayerApp.onAuth(sessionUser, profile);
        }
      } catch (e2) {}
    }
    return data;
  }

  async function signOut() {
    await ensureClient();
    await sb.auth.signOut();
    sessionUser = null;
    profile = null;
    window.__psUser = null;
    setGateVisible(true);
    try {
      if (window.PlanSlayerApp && window.PlanSlayerApp.onSignOut) window.PlanSlayerApp.onSignOut();
    } catch (e) {}
  }

  function wireAuthUi() {
    var si = $('auth-btn-signin');
    if (si) si.onclick = function () {
      setAuthError('');
      signIn($('auth-si-user').value, $('auth-si-pass').value).catch(function (e) {
        setAuthError((e && e.message) || String(e));
      });
    };
    var su = $('auth-btn-signup');
    if (su) su.onclick = function () {
      setAuthError('');
      signUp($('auth-su-user').value, $('auth-su-pass').value, $('auth-su-name').value).then(function (d) {
        if (!d.session) setAuthError('Account created — sign in with your username and password.');
        showAuthPanel('signin');
      }).catch(function (e) {
        setAuthError((e && e.message) || String(e));
      });
    };
    document.querySelectorAll('[data-auth-goto]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        showAuthPanel(a.getAttribute('data-auth-goto') || 'signin');
      });
    });
    var so = $('btn-signout');
    if (so) so.onclick = function () {
      if (confirm('Sign out on this device?')) signOut().catch(function () {});
    };
  }

  async function boot() {
    wireAuthUi();
    try {
      await ensureClient();
      sb.auth.onAuthStateChange(function () { refreshSession().catch(function () {}); });
      await refreshSession();
    } catch (e) {
      console.error(e);
      setGateVisible(true);
      setAuthError('Could not reach auth service. Check connection.');
      if (authReadyResolve) authReadyResolve({ user: null, profile: null });
    }
    if ('serviceWorker' in navigator) {
      try { navigator.serviceWorker.register('./sw.js'); } catch (eS) {}
    }
  }

  window.PlanSlayerAuth = {
    authReady: authReady,
    getClient: function () { return sb || window.__psSb; },
    getUser: function () { return sessionUser || window.__psUser; },
    getProfile: function () { return profile; },
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    syntheticEmail: syntheticEmail
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
