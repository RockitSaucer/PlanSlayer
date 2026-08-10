/**
 * PlanSlayer list photo → text via xAI vision (handwriting-capable).
 * Token stays server-side only (Vercel env XAI_API_KEY).
 *
 * POST JSON: { image: "data:image/jpeg;base64,..." }
 * Returns: { ok: true, lines: string[], text: string, engine: "xai" }
 */

const MAX_IMAGE_CHARS = 6 * 1024 * 1024; // ~4.5MB base64 budget
const XAI_URL = 'https://api.x.ai/v1/responses';
const MODEL = process.env.XAI_OCR_MODEL || 'grok-4.5';

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

function extractOutputText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  // responses API: output[].content[].text
  const out = data.output || data.choices || [];
  const parts = [];
  if (Array.isArray(out)) {
    out.forEach(function (block) {
      if (typeof block === 'string') { parts.push(block); return; }
      const content = block.content || block.message && block.message.content;
      if (typeof content === 'string') parts.push(content);
      else if (Array.isArray(content)) {
        content.forEach(function (c) {
          if (!c) return;
          if (typeof c === 'string') parts.push(c);
          else if (c.text) parts.push(c.text);
          else if (c.output_text) parts.push(c.output_text);
          else if (c.type === 'output_text' && c.text) parts.push(c.text);
        });
      }
      if (block.text) parts.push(block.text);
    });
  }
  // chat.completions fallback shape
  if (!parts.length && data.choices && data.choices[0]) {
    const m = data.choices[0].message;
    if (m && typeof m.content === 'string') return m.content;
  }
  return parts.join('\n');
}

function linesFromModelText(text) {
  text = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/```[\s\S]*?```/g, function (block) {
      return block.replace(/```\w*/g, '').trim();
    });
  // Prefer JSON array if model returned one
  try {
    const j = JSON.parse(text.trim());
    if (Array.isArray(j)) {
      return j.map(function (x) { return String(x || '').trim(); }).filter(function (s) {
        return s.length >= 1 && s.length <= 80;
      });
    }
    if (j && Array.isArray(j.items)) {
      return j.items.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    }
    if (j && Array.isArray(j.lines)) {
      return j.lines.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    }
  } catch (e) { /* not JSON */ }

  return text.split(/\n+/).map(function (l) {
    return l
      .replace(/^[\s•\-\*\u2022·▪◦\d\.\)\(]+/, '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }).filter(function (l) {
    if (!l || l.length < 1 || l.length > 80) return false;
    if (/^(here|the list|items|json|none|n\/a)$/i.test(l)) return false;
    return /[A-Za-z0-9]/.test(l);
  });
}

module.exports = async function handler(req, res) {
  cors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ ok: false, error: 'POST only' });
  }

  const key = process.env.XAI_API_KEY || process.env.SPACEXAI_API_KEY || '';
  if (!key) {
    res.statusCode = 503;
    return res.json({
      ok: false,
      error: 'Vision OCR not configured (set XAI_API_KEY on Vercel)',
      code: 'NO_XAI_KEY'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  let image = String(body.image || body.dataUrl || '').trim();
  if (!image) {
    res.statusCode = 400;
    return res.json({ ok: false, error: 'Missing image data' });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    res.statusCode = 413;
    return res.json({ ok: false, error: 'Photo too large — try a closer crop' });
  }
  if (image.indexOf('data:image/') !== 0) {
    // allow raw base64
    image = 'data:image/jpeg;base64,' + image.replace(/^base64,/, '');
  }
  if (!/^data:image\/(jpeg|jpg|png)/i.test(image)) {
    res.statusCode = 400;
    return res.json({ ok: false, error: 'Use JPEG or PNG photo' });
  }

  const prompt =
    'Read the handwritten or printed shopping/todo list in this photo. ' +
    'Return ONLY a JSON array of strings — one list item per string. ' +
    'Example: ["chips","soda","ice"]. ' +
    'Do not invent items. Do not add numbering, bullets, or commentary. ' +
    'If nothing readable, return [].';

  try {
    const xaiRes = await fetch(XAI_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_image', image_url: image, detail: 'high' },
              { type: 'input_text', text: prompt }
            ]
          }
        ]
      })
    });

    const rawText = await xaiRes.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch (eP) { data = null; }

    if (!xaiRes.ok) {
      const msg = (data && (data.error && data.error.message || data.message)) ||
        ('Vision API ' + xaiRes.status);
      res.statusCode = 502;
      return res.json({ ok: false, error: String(msg).slice(0, 240), code: 'XAI_ERROR' });
    }

    const text = extractOutputText(data);
    const lines = linesFromModelText(text);
    return res.json({
      ok: true,
      engine: 'xai',
      model: MODEL,
      text: text,
      lines: lines.slice(0, 40)
    });
  } catch (e) {
    res.statusCode = 500;
    return res.json({
      ok: false,
      error: (e && e.message) ? String(e.message).slice(0, 240) : 'OCR request failed',
      code: 'NETWORK'
    });
  }
};
