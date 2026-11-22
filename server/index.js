'use strict';
/**
 * FarmTori USSD & Commercial REST API Server.
 * "Every farm has a story worth recording"
 *
 * Endpoints:
 *   POST /ussd                 Aggregator callback (Africa's Talking style). Returns text/plain "CON ..." / "END ...".
 *   GET  /simulator            Browser feature-phone simulator (acts as the gateway).
 *   GET  /activity             Live activity log: recent records labelled USSD / App.
 *   GET  /api/activity         JSON for the activity log.
 *   GET  /api/demo-phones      Demo phone numbers for the simulator picker.
 *   GET  /health               System health status & active store backend.
 *
 * Commercial REST API:
 *   GET  /api/farms            List registered farms with optional ?farmer_id=&county=
 *   POST /api/farms            Create/register a farm plot
 *   GET  /api/harvests         List harvest batches with ?farm_id=&farmer_id=
 *   POST /api/harvests         Register new harvest batch & generate batch reference / QR token
 *   GET  /api/inspections      List quality inspections with ?batch_id=
 *   POST /api/inspections      Record official quality grade & certificate
 *   GET  /api/verify           Public QR passport verification (?token=...)
 *   GET  /api/reports/commercial Aggregated acreage, production, and commercial margins
 *   GET  /api/weather/alerts   Active localized weather advisory alerts
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { handleUssd } = require('./ussd/menu');
const { createSupabaseRepository, createMemoryRepository } = require('./ussd/repository');
const { createWeatherService } = require('./ussd/weather');
const { createSmsSender } = require('./ussd/sms');
const { buildDemoRows, demoPhoneList } = require('./ussd/demoData');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 32 * 1024;

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      /* file missing: fine */
    }
  }
}

function supabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(url && key && url !== 'https://agritrack-liberia-demo.supabase.co');
  return { url, key, configured };
}

/** Pick repository: Supabase (shared with the app) unless memory mode is requested/required. */
function createRepositoryFromEnv(env = process.env) {
  const cfg = supabaseConfig(env);
  if (env.USSD_STORE === 'memory' || !cfg.configured) {
    if (env.USSD_STORE !== 'memory') console.warn('[ussd] Supabase not configured; using in-memory demo store.');
    // Memory mode starts EMPTY: nobody sees another person's (or a sample) farm. Sample farmers are loaded only
    // when asked for, with USSD_DEMO_DATA=1 or --demo-data.
    const withDemo = env.USSD_DEMO_DATA === '1' || process.argv.includes('--demo-data');
    return createMemoryRepository(withDemo ? buildDemoRows() : { farmers: [], farms: [], farm_seasons: [], harvest_batches: [], expenses: [], quality_inspections: [] });
  }
  return createSupabaseRepository({ url: cfg.url, key: cfg.key });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parsePayload(raw, contentType = '') {
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json');
}

function sendFile(res, name) {
  fs.readFile(path.join(PUBLIC_DIR, name), (e, buf) => {
    if (e) return send(res, 404, 'Not found');
    send(res, 200, buf, 'text/html; charset=utf-8');
  });
}

/** Mask a phone number for logs: +231...0009 */
const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 4 ? `+${digits.slice(0, 3)}...${digits.slice(-4)}` : '***';
};

/** "Sarah Johnson" -> "Sarah J." (the public activity view never shows a full name) */
const shortName = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.length === 0 ? '' : words.length === 1 ? words[0] : `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
};

/** Is this request allowed to read farmers' records? Only with the server's API key (ADMIN_API_KEY). */
function hasApiKey(req, apiKey) {
  if (!apiKey) return false;
  const header = String(req.headers['x-api-key'] || '').trim() || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(header);
  const b = Buffer.from(String(apiKey));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const PRIVATE_API = /^\/api\/(farms|harvests|inspections|reports)(\/|$)/;

function createRequestHandler({ repo, weather, sms, apiKey = process.env.ADMIN_API_KEY, pins = true }) {
  const pinsOn = pins !== false;
  return async function onRequest(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      });
      return res.end();
    }

    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const route = `${req.method} ${pathname}`;

    // Farmers' records are private. The REST API answers only with the server's API key; without one set,
    // it is switched off. (A farmer on USSD only ever sees their own records, found by their phone number.)
    if (PRIVATE_API.test(pathname) && !hasApiKey(req, apiKey)) {
      return sendJson(res, apiKey ? 401 : 403, { error: apiKey ? 'A valid API key is required.' : 'The records API is switched off. Set ADMIN_API_KEY on the server to use it.' });
    }

    try {
      // Direct exact route dispatch
      switch (route) {
        case 'POST /ussd': {
          const p = parsePayload(await readBody(req), req.headers['content-type']);
          const reply = await handleUssd(
            { sessionId: p.sessionId, serviceCode: p.serviceCode, phoneNumber: p.phoneNumber, text: p.text || '' },
            { repo, weather, sms, pins: pinsOn }
          );
          console.log(`[ussd] ${p.sessionId || '-'} ${maskPhone(p.phoneNumber)} -> ${reply.slice(0, 3)}`);
          return send(res, 200, reply);
        }

        case 'GET /':
          res.writeHead(302, { Location: '/simulator' });
          return res.end();

        case 'GET /simulator':
          return sendFile(res, 'simulator.html');

        case 'GET /activity':
          return sendFile(res, 'activity.html');

        case 'GET /api/activity': {
          const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);
          const items = await repo.getRecentActivity(limit);
          // Without the API key the feed shows no names: first name and initial only, and no farm names.
          const full = hasApiKey(req, apiKey);
          return sendJson(res, 200, { store: repo.kind, items: full ? items : items.map((i) => ({ ...i, farmer: shortName(i.farmer), farm: '' })) });
        }

        case 'GET /api/sms': {
          // Demo inbox for the simulator. Only exists when no real SMS gateway is configured.
          if (!sms || sms.kind !== 'log') return send(res, 404, 'Not found');
          return sendJson(res, 200, { messages: sms.messagesFor(url.searchParams.get('phone') || '') });
        }

        case 'GET /api/demo-phones':
          return sendJson(res, 200, { store: repo.kind, phones: demoPhoneList() });

        case 'GET /health':
          return sendJson(res, 200, {
            ok: true,
            app: 'FarmTori',
            tagline: 'Every farm has a story worth recording',
            store: repo.kind,
            timestamp: new Date().toISOString(),
          });

        // -------------------------------------------------------------------
        // Commercial REST Endpoints
        // -------------------------------------------------------------------

        case 'GET /api/farms': {
          const farmerId = url.searchParams.get('farmer_id');
          const county = url.searchParams.get('county');
          const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
          const farms = await repo.getAllFarms({ farmerId, county, limit });
          return sendJson(res, 200, { count: farms.length, data: farms });
        }

        case 'POST /api/farms': {
          const body = parsePayload(await readBody(req), req.headers['content-type']);
          if (!body.farmer_id || !body.name || !body.county) {
            return sendJson(res, 400, { error: 'Missing required fields: farmer_id, name, county' });
          }
          const id = body.id || crypto.randomUUID();
          const farm = await repo.createFarm({
            id,
            farmer_id: body.farmer_id,
            name: body.name.trim(),
            county: body.county.trim(),
            district: body.district ? body.district.trim() : 'Central',
            community: body.community ? body.community.trim() : 'Farm Area',
            size: Number(body.size) || 1.0,
            size_unit: body.size_unit || 'acres',
            farming_type: body.farming_type || 'Crop Production',
            created_at: body.created_at || new Date().toISOString(),
          }, 'rest_api');
          return sendJson(res, 201, { success: true, data: farm });
        }

        case 'GET /api/harvests': {
          const farmId = url.searchParams.get('farm_id');
          const farmerId = url.searchParams.get('farmer_id');
          const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
          const harvests = await repo.getAllHarvests({ farmId, farmerId, limit });
          return sendJson(res, 200, { count: harvests.length, data: harvests });
        }

        case 'POST /api/harvests': {
          const body = parsePayload(await readBody(req), req.headers['content-type']);
          if (!body.farm_id || !body.farmer_id || !body.crop_id || !body.quantity) {
            return sendJson(res, 400, { error: 'Missing required fields: farm_id, farmer_id, crop_id, quantity' });
          }
          const id = body.id || crypto.randomUUID();
          const batchRef = body.batch_reference || `FT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
          const qrToken = body.qr_token || crypto.randomBytes(8).toString('hex');
          const harvest = await repo.createHarvest({
            id,
            batch_reference: batchRef,
            farmer_id: body.farmer_id,
            farm_id: body.farm_id,
            crop_id: body.crop_id,
            quantity: Number(body.quantity),
            unit: body.unit || 'kg',
            total_value: body.total_value ? Number(body.total_value) : null,
            status: body.status || 'submitted',
            qr_token: qrToken,
            harvest_date: body.harvest_date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
          }, 'rest_api');
          return sendJson(res, 201, { success: true, data: harvest });
        }

        case 'GET /api/inspections': {
          const batchId = url.searchParams.get('batch_id');
          const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
          const inspections = await repo.getInspections({ batchId, limit });
          return sendJson(res, 200, { count: inspections.length, data: inspections });
        }

        case 'POST /api/inspections': {
          const body = parsePayload(await readBody(req), req.headers['content-type']);
          if (!body.batch_id || !body.inspector_id || !body.final_grade) {
            return sendJson(res, 400, { error: 'Missing required fields: batch_id, inspector_id, final_grade' });
          }
          const id = body.id || crypto.randomUUID();
          const inspection = await repo.createInspection({
            id,
            batch_id: body.batch_id,
            inspector_id: body.inspector_id,
            template_id: body.template_id || '00000000-0000-0000-0000-000000000001',
            final_grade: body.final_grade,
            decision_status: body.decision_status || 'approved',
            observations: body.observations || 'Official quality certification completed.',
            inspection_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }, 'rest_api');
          return sendJson(res, 201, { success: true, data: inspection });
        }

        case 'GET /api/reports/commercial': {
          const county = url.searchParams.get('county');
          const report = await repo.getCommercialReport({ county });
          return sendJson(res, 200, report);
        }

        case 'GET /api/weather/alerts': {
          const county = url.searchParams.get('county') || 'Nimba';
          const forecast = await weather.getForecast(county);
          return sendJson(res, 200, {
            county,
            forecast: forecast || [
              { day: 'Today', label: 'Partly cloudy', tMax: 31, tMin: 24, rainChance: 20 },
              { day: 'Sun', label: 'Rain', tMax: 29, tMin: 23, rainChance: 70 },
              { day: 'Mon', label: 'Showers', tMax: 28, tMin: 23, rainChance: 60 },
            ],
            advisories: [
              {
                id: 'adv-01',
                type: 'harvest_drying',
                title: 'Good day to dry your produce',
                message: 'Clear skies expected today with low humidity. Plan harvesting and crop drying.',
                severity: 'info',
              },
            ],
          });
        }

        default: {
          // Dynamic path matching for /api/verify and /api/verify/:token
          if (pathname.startsWith('/api/verify')) {
            const token = url.searchParams.get('token') || pathname.split('/api/verify/')[1];
            if (!token) return sendJson(res, 400, { error: 'Provide a token: /api/verify?token=XYZ or /api/verify/XYZ' });
            const verification = await repo.getVerification(token);
            if (!verification) return sendJson(res, 404, { verified: false, error: 'Passport QR token not found or invalid' });
            return sendJson(res, 200, verification);
          }
          return send(res, 404, 'Not found');
        }
      }
    } catch (e) {
      console.error(`[server] ${route}:`, e);
      if (route === 'POST /ussd') return send(res, 200, 'END Sorry, the service is busy. Please try again later.');
      return send(res, e.status || 500, JSON.stringify({ error: e.message }), 'application/json');
    }
  };
}

function start() {
  loadEnv();
  if (process.argv.includes('--memory')) process.env.USSD_STORE = 'memory';
  if (!process.env.ADMIN_API_KEY) console.log('[api] ADMIN_API_KEY is not set: the farm/harvest/inspection/report REST API is switched off.');
  const repo = createRepositoryFromEnv();
  const weather = createWeatherService();
  const port = Number(process.env.PORT) || 4000;
  const sms = createSmsSender(process.env);
  console.log(`[sms] sender: ${sms.kind}${sms.kind === 'log' ? ' (demo: messages are kept in memory and shown in the simulator)' : ''}`);
  const server = http.createServer(createRequestHandler({ repo, weather, sms }));
  server.listen(port, () => {
    console.log(`FarmTori Server listening on http://localhost:${port} (store: ${repo.kind})`);
    console.log(`  Simulator:         http://localhost:${port}/simulator`);
    console.log(`  Activity log:      http://localhost:${port}/activity`);
    console.log(`  USSD Gateway:      POST http://localhost:${port}/ussd`);
    console.log(`  Commercial REST:   GET  http://localhost:${port}/api/farms`);
    console.log(`  Traceability:      GET  http://localhost:${port}/api/verify?token=XYZ`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { createRequestHandler, createRepositoryFromEnv, supabaseConfig, parsePayload, loadEnv, start };
