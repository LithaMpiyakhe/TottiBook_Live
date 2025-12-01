// Minimal local development API server for Yoco endpoints (no deps)
// Do NOT hardcode secrets. Read from environment: YOCO_SECRET_KEY, SITE_URL

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.API_DEV_PORT ? Number(process.env.API_DEV_PORT) : 8787;
const YOCO_API = 'https://payments.yoco.com/api/checkouts';
const SECRET = process.env.YOCO_SECRET_KEY || '';
const YOCO_TEST = String(process.env.YOCO_TEST_MODE || '').toLowerCase() === '1' || String(process.env.YOCO_TEST_MODE || '').toLowerCase() === 'true';
const SITE_URL = process.env.SITE_URL || 'http://localhost:8080';
function normalizeSiteUrl(u) {
  const s = String(u || '').trim().replace(/^[`'"]+|[`'"]+$/g, '');
  return s.replace(/\/$/, '');
}
// Microsoft Graph env (optional)
const GRAPH_TENANT_ID = process.env.GRAPH_TENANT_ID || '';
const GRAPH_CLIENT_ID = process.env.GRAPH_CLIENT_ID || '';
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';
const GRAPH_DEFAULT_UPN = process.env.GRAPH_USER_UPN || '';
// ICS calendar (optional)
const ICS_URL = process.env.ICS_URL || '';
// Simple admin PIN (optional)
const ADMIN_PIN = process.env.ADMIN_PIN || '';
let ADMIN_PIN_RUNTIME = '';

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  json(res, 404, { error: 'Not found' });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_) {
        resolve({});
      }
    });
  });
}

const STATUS = new Map();
const QUEENSTOWN = new Map();
const QUEENSTOWN_STATUS = new Map();
const QTN_THRESHOLD = process.env.QTN_THRESHOLD ? Number(process.env.QTN_THRESHOLD) : 6;
let QTN_ENABLED = process.env.QTN_ENABLED ? (String(process.env.QTN_ENABLED).toLowerCase() === 'true') : true;
const BLOCKED_SLOTS = new Set(); // key: `${date}|${route}|${time}`
const BLOCKED_DATES = new Set(); // key: `YYYY-MM-DD`

const DIST_DIR = path.join(__dirname, 'dist');

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html'
      : ext === '.css' ? 'text/css'
      : ext === '.js' ? 'application/javascript'
      : ext === '.svg' ? 'image/svg+xml'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.ico' ? 'image/x-icon'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (url.pathname === '/api/yoco/create-checkout' && req.method === 'POST') {
    if (!SECRET && !YOCO_TEST) {
      return json(res, 500, { error: 'Missing YOCO_SECRET_KEY env' });
    }

    const body = await parseBody(req);
    const amount = Number(body.amount);
    const currency = body.currency || 'ZAR';
    const metadata = body.metadata || {};
    const clientReferenceId = body.clientReferenceId || '';

    if (!amount || !Number.isFinite(amount)) {
      return json(res, 400, { error: 'Invalid or missing amount (cents)' });
    }

    try {
      console.log('Creating Yoco checkout with:', { amount, currency, clientReferenceId, metadata });
      const payload = {
        amount,
        currency,
        metadata: { ...metadata, clientReferenceId },
        clientReferenceId,
        successUrl: `${normalizeSiteUrl(SITE_URL)}/payment/success?ref=${encodeURIComponent(clientReferenceId)}`,
        cancelUrl: `${normalizeSiteUrl(SITE_URL)}/payment/cancel`,
        failureUrl: `${normalizeSiteUrl(SITE_URL)}/payment/failure`,
      };

      if (YOCO_TEST) {
        const fakeId = `test_${Date.now()}`;
        STATUS.set(clientReferenceId, { status: 'succeeded', updatedAt: Date.now(), checkoutId: fakeId });
        return json(res, 200, { id: fakeId, redirectUrl: `${normalizeSiteUrl(SITE_URL)}/payment/success?ref=${encodeURIComponent(clientReferenceId)}` });
      }

      const resp = await postJson(YOCO_API, { Authorization: `Bearer ${SECRET}`, Accept: 'application/json' }, payload);
      const text = resp.body;
      let data = {};
      try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
      console.log('Yoco response status:', resp.statusCode, 'body:', data);
      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        return json(res, resp.statusCode, { error: data });
      }
      if (clientReferenceId) STATUS.set(clientReferenceId, { status: 'created', updatedAt: Date.now(), checkoutId: data.id });
      return json(res, 200, { id: data.id, redirectUrl: data.redirectUrl });
    } catch (err) {
      console.error('Yoco create checkout error:', err && err.stack ? err.stack : err);
      return json(res, 500, { error: (err && err.message) ? err.message : 'Unexpected server error' });
    }
  }

  if (url.pathname === '/api/yoco/webhook' && req.method === 'POST') {
    const event = await parseBody(req);
    console.log('Webhook event received (dev):', JSON.stringify(event));
    try {
      const type = event && event.type;
      let ref = '';
      if (event && event.data && event.data.metadata && event.data.metadata.clientReferenceId) {
        ref = event.data.metadata.clientReferenceId;
      }
      if (ref) {
        const status = type === 'payment.succeeded' ? 'succeeded' : type === 'payment.failed' ? 'failed' : 'unknown';
        STATUS.set(ref, { status, updatedAt: Date.now() });
      }
    } catch (_) {}
    return json(res, 200, { received: true });
  }

  if (url.pathname === '/api/admin/verify' && req.method === 'POST') {
    const body = await parseBody(req);
    const pin = String(body.pin || '');
    const effective = ADMIN_PIN_RUNTIME || ADMIN_PIN;
    if (!effective) return json(res, 200, { ok: true });
    const ok = pin === effective;
    return json(res, ok ? 200 : 401, { ok });
  }

  if (url.pathname === '/api/admin/status' && req.method === 'GET') {
    const effective = ADMIN_PIN_RUNTIME || ADMIN_PIN;
    return json(res, 200, { requiresPin: !!effective });
  }

  if (url.pathname === '/api/admin/change-pin' && req.method === 'POST') {
    const body = await parseBody(req);
    const current = String(body.current || '');
    const next = String(body.next || '');
    const effective = ADMIN_PIN_RUNTIME || ADMIN_PIN;
    if (!next || next.length < 4 || next.length > 32) return json(res, 400, { ok: false });
    if (!effective) {
      ADMIN_PIN_RUNTIME = next;
      return json(res, 200, { ok: true });
    }
    if (current !== effective) return json(res, 401, { ok: false });
    ADMIN_PIN_RUNTIME = next;
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/yoco/status' && req.method === 'GET') {
    const ref = url.searchParams.get('ref') || '';
    if (!ref || !STATUS.has(ref)) {
      return json(res, 404, { status: 'unknown' });
    }
    const v = STATUS.get(ref);
    return json(res, 200, v);
  }

  // Yoco webhook management (admin-protected)
  if (url.pathname === '/api/yoco/register-webhook' && req.method === 'POST') {
    const body = await parseBody(req);
    const pin = String(body.pin || '');
    const name = String(body.name || 'totti-webhook');
    const webhookUrl = String(body.url || '').trim();
    const effective = ADMIN_PIN_RUNTIME || ADMIN_PIN;
    if (effective && pin !== effective) return json(res, 401, { ok: false, error: 'Invalid PIN' });
    if (!/^https?:\/\//i.test(webhookUrl)) return json(res, 400, { ok: false, error: 'Invalid webhook URL' });
    if (!SECRET) return json(res, 500, { ok: false, error: 'Missing YOCO_SECRET_KEY env' });
    try {
      const resp = await postJson('https://payments.yoco.com/api/webhooks', { Authorization: `Bearer ${SECRET}`, Accept: 'application/json' }, { name, url: webhookUrl });
      let data = {}; try { data = JSON.parse(resp.body); } catch (_) { data = { raw: resp.body }; }
      if (resp.statusCode < 200 || resp.statusCode >= 300) return json(res, resp.statusCode, { ok: false, error: data });
      return json(res, 200, { ok: true, data });
    } catch (err) {
      return json(res, 500, { ok: false, error: (err && err.message) ? err.message : 'Unexpected error' });
    }
  }

  if (url.pathname === '/api/yoco/webhooks' && req.method === 'GET') {
    if (!SECRET) return json(res, 500, { ok: false, error: 'Missing YOCO_SECRET_KEY env' });
    try {
      const resp = await getJson('https://payments.yoco.com/api/webhooks', { Authorization: `Bearer ${SECRET}`, Accept: 'application/json' });
      let data = {}; try { data = JSON.parse(resp.body); } catch (_) { data = { raw: resp.body }; }
      if (resp.statusCode < 200 || resp.statusCode >= 300) return json(res, resp.statusCode, { ok: false, error: data });
      return json(res, 200, { ok: true, data });
    } catch (err) {
      return json(res, 500, { ok: false, error: (err && err.message) ? err.message : 'Unexpected error' });
    }
  }

  if (url.pathname === '/api/yoco/delete-webhook' && req.method === 'POST') {
    const body = await parseBody(req);
    const pin = String(body.pin || '');
    const id = String(body.id || '').trim();
    const effective = ADMIN_PIN_RUNTIME || ADMIN_PIN;
    if (effective && pin !== effective) return json(res, 401, { ok: false, error: 'Invalid PIN' });
    if (!id) return json(res, 400, { ok: false, error: 'Missing webhook id' });
    if (!SECRET) return json(res, 500, { ok: false, error: 'Missing YOCO_SECRET_KEY env' });
    try {
      const urlStr = `https://payments.yoco.com/api/webhooks/${encodeURIComponent(id)}`;
      // Yoco uses DELETE; using https.request via getJson/postJson helpers is fine to implement directly here
      const urlObj = new URL(urlStr);
      const opts = { hostname: urlObj.hostname, port: urlObj.port || 443, path: urlObj.pathname + (urlObj.search || ''), method: 'DELETE', headers: { Authorization: `Bearer ${SECRET}` } };
      const del = await new Promise((resolve, reject) => {
        const req2 = https.request(opts, (res2) => { const chunks = []; res2.on('data', c => chunks.push(c)); res2.on('end', () => resolve({ statusCode: res2.statusCode, body: Buffer.concat(chunks).toString('utf8') })); });
        req2.on('error', (e) => reject(e));
        req2.end();
      });
      let data = {}; try { data = JSON.parse(del.body); } catch (_) { data = { raw: del.body }; }
      if (del.statusCode < 200 || del.statusCode >= 300) return json(res, del.statusCode, { ok: false, error: data });
      return json(res, 200, { ok: true, data });
    } catch (err) {
      return json(res, 500, { ok: false, error: (err && err.message) ? err.message : 'Unexpected error' });
    }
  }

  // Calendar: blocked dates endpoint (mock for dev)
  if (url.pathname === '/api/calendar/blocked' && req.method === 'GET') {
    const blocked = Array.from(BLOCKED_DATES);
    const slots = Array.from(BLOCKED_SLOTS).map((k) => {
      const [d, r, t] = k.split('|');
      return { date: d, route: r, time: t };
    });
    return json(res, 200, { blocked, slots });
  }

  if (url.pathname === '/api/calendar/block-date' && req.method === 'POST') {
    const body = await parseBody(req);
    const date = String(body.date || '').slice(0,10);
    if (!date) return json(res, 400, { ok: false });
    BLOCKED_DATES.add(date);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/calendar/unblock-date' && req.method === 'POST') {
    const body = await parseBody(req);
    const date = String(body.date || '').slice(0,10);
    if (!date) return json(res, 400, { ok: false });
    BLOCKED_DATES.delete(date);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/calendar/unblock-all' && req.method === 'POST') {
    BLOCKED_DATES.clear();
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/queenstown/request' && req.method === 'POST') {
    const body = await parseBody(req);
    const date = String(body.date || '').slice(0,10);
    const time = String(body.time || '');
    const passengers = Number(body.passengers || 0);
    const name = String(body.name || '');
    const email = String(body.email || '');
    const phone = String(body.phone || '');
    if (!date || !time || !passengers || !name || !email || !phone) {
      return json(res, 400, { ok: false });
    }
    const key = `${date}|${time}`;
    const prev = QUEENSTOWN.get(key) || 0;
    const count = prev + passengers;
    QUEENSTOWN.set(key, count);
    if (!QUEENSTOWN_STATUS.has(key)) QUEENSTOWN_STATUS.set(key, 'pending');
    return json(res, 200, { ok: true, count, threshold: QTN_THRESHOLD });
  }

  if (url.pathname === '/api/queenstown/stats' && req.method === 'GET') {
    const date = String(url.searchParams.get('date') || '').slice(0,10);
    const time = String(url.searchParams.get('time') || '');
    if (!date || !time) {
      return json(res, 400, { count: 0, threshold: QTN_THRESHOLD, status: 'unknown' });
    }
    const key = `${date}|${time}`;
    const count = QUEENSTOWN.get(key) || 0;
    const status = QUEENSTOWN_STATUS.get(key) || 'pending';
    return json(res, 200, { count, threshold: QTN_THRESHOLD, status });
  }

  if (url.pathname === '/api/queenstown/list' && req.method === 'GET') {
    const date = String(url.searchParams.get('date') || '').slice(0,10);
    const out = [];
    for (const [key, count] of QUEENSTOWN.entries()) {
      const [d, t] = key.split('|');
      if (!date || d === date) {
        out.push({ date: d, time: t, count, status: QUEENSTOWN_STATUS.get(key) || 'pending' });
      }
    }
    out.sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
    return json(res, 200, { requests: out, threshold: QTN_THRESHOLD });
  }

  if (url.pathname === '/api/queenstown/config' && req.method === 'GET') {
    return json(res, 200, { enabled: !!QTN_ENABLED, threshold: QTN_THRESHOLD });
  }

  if (url.pathname === '/api/queenstown/config' && req.method === 'POST') {
    const body = await parseBody(req);
    if (typeof body.enabled === 'boolean') QTN_ENABLED = body.enabled;
    if (typeof body.threshold === 'number' && Number.isFinite(body.threshold)) {
      // runtime-only adjustment of threshold
      // note: env value remains unchanged; dev server holds runtime value separately
    }
    return json(res, 200, { enabled: !!QTN_ENABLED, threshold: QTN_THRESHOLD });
  }

  if (url.pathname === '/api/queenstown/confirm' && req.method === 'POST') {
    const body = await parseBody(req);
    const date = String(body.date || '').slice(0,10);
    const time = String(body.time || '');
    const key = `${date}|${time}`;
    if (!QUEENSTOWN.has(key)) return json(res, 404, { ok: false });
    QUEENSTOWN_STATUS.set(key, 'confirmed');
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/queenstown/decline' && req.method === 'POST') {
    const body = await parseBody(req);
    const date = String(body.date || '').slice(0,10);
    const time = String(body.time || '');
    const key = `${date}|${time}`;
    if (!QUEENSTOWN.has(key)) return json(res, 404, { ok: false });
    QUEENSTOWN_STATUS.set(key, 'declined');
    return json(res, 200, { ok: true });
  }


  if (url.pathname === '/api/graph/availability' && req.method === 'GET') {
    if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
      return json(res, 500, { error: 'Missing Graph env vars' });
    }
    const start = String(url.searchParams.get('start') || '').slice(0,10);
    const end = String(url.searchParams.get('end') || start).slice(0,10);
    const upn = String(url.searchParams.get('upn') || GRAPH_DEFAULT_UPN);
    if (!start || !upn) return json(res, 400, { error: 'Missing start or upn' });
    const tokenUrl = `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`;
    const form = `client_id=${encodeURIComponent(GRAPH_CLIENT_ID)}&client_secret=${encodeURIComponent(GRAPH_CLIENT_SECRET)}&grant_type=client_credentials&scope=${encodeURIComponent('https://graph.microsoft.com/.default')}`;
    try {
      const tokResp = await postForm(tokenUrl, form);
      const tokData = JSON.parse(tokResp.body);
      const accessToken = tokData.access_token;
      const startDt = `${start}T00:00:00Z`;
      const endDt = `${end}T23:59:59Z`;
      const viewUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}/calendarView?startDateTime=${encodeURIComponent(startDt)}&endDateTime=${encodeURIComponent(endDt)}&$select=subject,start,end,showAs,categories`;
      const calResp = await getJson(viewUrl, { Authorization: `Bearer ${accessToken}` });
      const calData = JSON.parse(calResp.body);
      const events = Array.isArray(calData.value) ? calData.value : [];
      const blockedTimes = [];
      for (const e of events) {
        const showAs = (e.showAs || '').toLowerCase();
        if (showAs === 'busy' || showAs === 'oof') {
          const dt = (e.start && e.start.dateTime) ? String(e.start.dateTime) : '';
          if (dt.length >= 16) blockedTimes.push(dt.slice(11,16));
        }
      }
      return json(res, 200, { events, blockedTimes });
    } catch (err) {
      console.error('Graph availability error:', err && err.stack ? err.stack : err);
      return json(res, 500, { error: (err && err.message) ? err.message : 'Unexpected Graph error' });
    }
  }

  if (url.pathname === '/api/calendar/ics' && req.method === 'GET') {
    if (!ICS_URL) return json(res, 500, { error: 'Missing ICS_URL env' });
    const start = String(url.searchParams.get('start') || '').slice(0,10);
    const end = String(url.searchParams.get('end') || start).slice(0,10);
    try {
      const icsResp = await getJson(ICS_URL, { Accept: 'text/calendar' });
      const text = icsResp.body || '';
      const events = [];
      const parts = text.split('BEGIN:VEVENT');
      for (let i = 1; i < parts.length; i++) {
        const chunk = parts[i].split('END:VEVENT')[0];
        const statusMatch = chunk.match(/STATUS:(.*)/);
        const status = statusMatch ? String(statusMatch[1]).trim().toUpperCase() : '';
        if (status === 'CANCELLED') continue;
        const dtstartMatch = chunk.match(/DTSTART(?:;[^:]+)?:([^\r\n]+)/);
        const dtendMatch = chunk.match(/DTEND(?:;[^:]+)?:([^\r\n]+)/);
        const summaryMatch = chunk.match(/SUMMARY:(.*)/);
        const dtstart = dtstartMatch ? String(dtstartMatch[1]).trim() : '';
        const dtend = dtendMatch ? String(dtendMatch[1]).trim() : '';
        const summary = summaryMatch ? String(summaryMatch[1]).trim() : '';
        if (!dtstart) continue;
        // Normalize to YYYY-MM-DD and HH:MM if possible
        const toIso = (s) => {
          // Formats like 20251125T150000Z or 20251125T150000
          const m = s.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
          if (!m) return null;
          const yyyy = m[1], mm = m[2], dd = m[3], HH = m[4], MM = m[5];
          return { date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}` };
        };
        const startIso = toIso(dtstart);
        if (!startIso) continue;
        events.push({ summary, start: startIso, end: toIso(dtend) });
      }
      const inRange = events.filter(e => {
        if (!start || !end) return true;
        return e.start.date >= start && e.start.date <= end;
      });
      const blockedTimes = Array.from(new Set(inRange.map(e => e.start.time)));
      return json(res, 200, { events: inRange, blockedTimes });
    } catch (err) {
      console.error('ICS availability error:', err && err.stack ? err.stack : err);
      return json(res, 500, { error: (err && err.message) ? err.message : 'Unexpected ICS error' });
    }
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    const graphPresent = !!GRAPH_TENANT_ID && !!GRAPH_CLIENT_ID && !!GRAPH_CLIENT_SECRET;
    return json(res, 200, { secretPresent: !!SECRET, siteUrl: normalizeSiteUrl(SITE_URL), icsPresent: !!ICS_URL, graphPresent });
  }

  // Static file serving and SPA fallback (Hostinger)
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    const safePath = path.normalize(url.pathname).replace(/^\/+/, '');
    const filePath = path.join(DIST_DIR, safePath || 'index.html');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveFile(filePath, res);
    }
    return serveFile(path.join(DIST_DIR, 'index.html'), res);
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`API dev server listening on http://localhost:${PORT}`);
});
function postJson(urlString, headers, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = Buffer.from(JSON.stringify(payload));
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}
function postForm(urlString, form) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = Buffer.from(form);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length,
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}
function getJson(urlString, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'GET',
      headers: headers || {},
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}
