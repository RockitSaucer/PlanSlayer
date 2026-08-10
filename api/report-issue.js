/**
 * PlanSlayer → GitHub Issues (shared Hunt-Slayer inbox).
 * Token server-side only: Vercel env GITHUB_ISSUE_TOKEN
 *   (needs issues:write on RockitSaucer/Hunt-Slayer)
 *
 * POST JSON: { message, title?, contact?, site?: 'plan', appVersion? }
 * Labels: from-site + from-planslayer
 * Optional email confirmation when contact is an email:
 *   RESEND_API_KEY + REPORT_EMAIL_FROM (or default)
 */

const PRIMARY_REPO = process.env.GITHUB_ISSUE_REPO || 'RockitSaucer/Hunt-Slayer';
const FALLBACK_REPO = process.env.GITHUB_ISSUE_FALLBACK_REPO || 'RockitSaucer/PlanSlayer';
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

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

async function createIssue(token, repo, title, issueBody, labels) {
  const payload = { title: title, body: issueBody };
  if (labels && labels.length) payload.labels = labels;
  const ghRes = await fetch('https://api.github.com/repos/' + repo + '/issues', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'plan-slayer-report-api',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await ghRes.json().catch(function () { return {}; });
  return { ghRes: ghRes, data: data };
}

/**
 * Email confirmation to the reporter (contact field).
 * Uses Resend when RESEND_API_KEY is set.
 */
async function sendReporterConfirmation(to, issueNumber, issueUrl) {
  if (!looksLikeEmail(to)) return { sent: false, reason: 'no_email' };
  const key = process.env.RESEND_API_KEY || '';
  if (!key) return { sent: false, reason: 'no_resend_key' };

  const from = process.env.REPORT_EMAIL_FROM || 'PlanSlayer Reports <onboarding@resend.dev>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from,
        to: [to],
        subject: 'PlanSlayer report received' + (issueNumber ? (' (#' + issueNumber + ')') : ''),
        text: [
          'Thanks for reporting a problem on PlanSlayer.',
          '',
          issueNumber ? ('Issue number: #' + issueNumber) : '',
          issueUrl ? ('Track it: ' + issueUrl) : '',
          '',
          'Your report was filed in the shared Hunt Slayer issues inbox (tagged from-planslayer).',
          '',
          '— PlanSlayer'
        ].filter(Boolean).join('\n')
      })
    });
    if (!r.ok) {
      const errBody = await r.text().catch(function () { return ''; });
      console.error('Resend confirm failed', r.status, errBody.slice(0, 300));
      return { sent: false, reason: 'resend_' + r.status };
    }
    return { sent: true };
  } catch (e) {
    console.error('Resend confirm error', e);
    return { sent: false, reason: 'network' };
  }
}

/** Optional: notify Rockit when a Plan report lands */
async function sendOwnerNotify(issueNumber, issueUrl, message, contact) {
  const key = process.env.RESEND_API_KEY || '';
  const owner = process.env.REPORT_NOTIFY_EMAIL || '';
  if (!key || !looksLikeEmail(owner)) return;
  const from = process.env.REPORT_EMAIL_FROM || 'PlanSlayer Reports <onboarding@resend.dev>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from,
        to: [owner],
        subject: '[PlanSlayer] New site report' + (issueNumber ? (' #' + issueNumber) : ''),
        text: [
          'New PlanSlayer report in Hunt-Slayer inbox.',
          issueUrl || '',
          contact ? ('Contact: ' + contact) : '',
          '',
          message
        ].join('\n')
      })
    });
  } catch (e) {
    console.error('owner notify', e);
  }
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
      error: 'Issue reporting is not configured. Set Vercel env GITHUB_ISSUE_TOKEN (GitHub PAT with issues:write on Hunt-Slayer) and redeploy PlanSlayer.'
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
    '**Origin label:** `from-planslayer`',
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
    '_Shared inbox: Hunt-Slayer. Fix in **Desktop/PlanSlayer/** → push **RockitSaucer/PlanSlayer** only._',
    '_Workflow: agent plans → `ready-for-review` → Rockit `ready-to-commit` / `revised-changes`._'
  ].join('\n');

  const labels = ['from-site', siteLabel];
  const reposToTry = [PRIMARY_REPO];
  if (FALLBACK_REPO && FALLBACK_REPO !== PRIMARY_REPO) reposToTry.push(FALLBACK_REPO);

  try {
    let lastErr = null;
    for (let r = 0; r < reposToTry.length; r++) {
      const repo = reposToTry[r];
      let result = await createIssue(token, repo, title, issueBody, labels);

      if (!result.ghRes.ok && result.ghRes.status === 422 &&
          result.data && /label/i.test(String(result.data.message || JSON.stringify(result.data.errors || '')))) {
        // Retry without labels
        const bare = await fetch('https://api.github.com/repos/' + repo + '/issues', {
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
            body: issueBody + '\n\n_(Labels `from-site` / `from-planslayer` missing on ' + repo + ' — create them.)_'
          })
        });
        const bareData = await bare.json().catch(function () { return {}; });
        result = { ghRes: bare, data: bareData };
      }

      if (result.ghRes.ok) {
        const number = result.data.number;
        const url = result.data.html_url;
        let emailSent = false;
        let emailNote = '';
        if (looksLikeEmail(contact)) {
          const em = await sendReporterConfirmation(contact, number, url);
          emailSent = !!em.sent;
          if (!em.sent && em.reason === 'no_resend_key') {
            emailNote = ' (Add RESEND_API_KEY on Vercel to email confirmations to reporters.)';
          } else if (!em.sent) {
            emailNote = ' (Could not send confirmation email.)';
          }
        }
        try {
          await sendOwnerNotify(number, url, message, contact);
        } catch (eN) {}

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          number: number,
          url: url,
          repo: repo,
          usedFallback: repo !== PRIMARY_REPO,
          emailSent: emailSent,
          emailNote: emailNote
        }));
        return;
      }

      lastErr = (result.data && result.data.message) ? result.data.message : ('HTTP ' + result.ghRes.status);
      console.error('GitHub issue create failed', repo, result.ghRes.status, result.data);
    }

    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: lastErr || 'GitHub rejected the report. Token needs issues:write on Hunt-Slayer.'
    }));
  } catch (e) {
    console.error('report-issue', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Server error filing report.' }));
  }
};
