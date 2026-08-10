/**
 * PlanSlayer → GitHub Issues bridge.
 * Token stays server-side only (Vercel env GITHUB_ISSUE_TOKEN).
 * Never embed a token in client JS.
 *
 * POST JSON: { message, title?, contact?, site?: 'plan', appVersion? }
 * Creates issue on RockitSaucer/Hunt-Slayer (shared inbox) with labels from-site + from-planslayer.
 *
 * Workflow (same as Hunt):
 *   agent plans → ready-for-review → Rockit marks ready-to-commit or revised-changes
 */

const REPO = process.env.GITHUB_ISSUE_REPO || 'RockitSaucer/Hunt-Slayer';
const MAX_MSG = 4000;
const MAX_TITLE = 120;

const hits = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : 'unknown';
}

function allowRate(ip) {
  const now = Date.now();
  let arr = hits.get(ip) || [];
  arr = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  return true;
}

function cors(res, origin) {
  const allowed = [
    'https://planslayer.com',
    'https://www.planslayer.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];
  // Vercel preview deployments
  const isVercelPreview = typeof origin === 'string' &&
    /^https:\/\/[\w.-]+\.vercel\.app$/i.test(origin);
  if (origin && (allowed.includes(origin) || isVercelPreview)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sanitize(s, max) {
  return String(s == null ? '' : s)
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  cors(res, origin);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  const token = process.env.GITHUB_ISSUE_TOKEN || process.env.GITHUB_TOKEN || '';
  if (!token) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: 'Issue reporting is not configured (missing GITHUB_ISSUE_TOKEN on server).'
    }));
    return;
  }

  const ip = clientIp(req);
  if (!allowRate(ip)) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Too many reports from this network. Try again later.' }));
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const siteName = 'PLAN SLAYER';
  const siteLabel = 'from-planslayer';
  const message = sanitize(body.message, MAX_MSG);
  const titleIn = sanitize(body.title, MAX_TITLE);
  const contact = sanitize(body.contact, 120);
  const appVersion = sanitize(body.appVersion, 40);

  if (!message || message.length < 8) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Please describe the issue (at least a short sentence).' }));
    return;
  }

  const title = titleIn ||
    ('[' + siteName + '] ' + message.replace(/\s+/g, ' ').slice(0, 72) + (message.length > 72 ? '…' : ''));

  const issueBody = [
    '## User report (from site)',
    '',
    '**Site:** ' + siteName + ' (`plan`)',
    appVersion ? ('**App version:** ' + appVersion) : '**App version:** _(unknown)_',
    contact ? ('**Contact:** ' + contact) : '**Contact:** _(not provided)_',
    '**Submitted:** ' + new Date().toISOString(),
    '',
    '---',
    '',
    message,
    '',
    '---',
    '',
    '_Workflow: agent plans → label `ready-for-review` → Rockit labels `ready-to-commit` or `revised-changes`. Do not implement without `ready-to-commit`._',
    '',
    '_Code path: `Desktop/PlanSlayer/` → push **RockitSaucer/PlanSlayer** only (not Hunt/Reg)._'
  ].join('\n');

  try {
    const ghRes = await fetch('https://api.github.com/repos/' + REPO + '/issues', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'plan-slayer-report-api',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        body: issueBody,
        labels: ['from-site', siteLabel]
      })
    });

    const data = await ghRes.json().catch(function () { return {}; });
    if (!ghRes.ok) {
      console.error('GitHub issue create failed', ghRes.status, data);
      // If labels don't exist yet, retry without labels so the report still lands
      if (ghRes.status === 422 && data && /label/i.test(String(data.message || ''))) {
        const retry = await fetch('https://api.github.com/repos/' + REPO + '/issues', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'plan-slayer-report-api',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: title,
            body: issueBody + '\n\n_(Note: labels `from-site` / `from-planslayer` were missing — create them in GitHub.)_'
          })
        });
        const retryData = await retry.json().catch(function () { return {}; });
        if (retry.ok) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            number: retryData.number,
            url: retryData.html_url,
            labelsMissing: true
          }));
          return;
        }
      }
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: false,
        error: (data && data.message) ? data.message : 'GitHub rejected the report.'
      }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      number: data.number,
      url: data.html_url
    }));
  } catch (e) {
    console.error('report-issue', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Server error filing report.' }));
  }
};
