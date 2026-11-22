'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createRequestHandler } = require('../server/index');
const { createMemoryRepository } = require('../server/ussd/repository');
const { createWeatherService } = require('../server/ussd/weather');
const { buildDemoRows } = require('../server/ussd/demoData');

// the records API needs the server's key: every request in this suite sends it
const realFetch = globalThis.fetch;
const fetch = (url, init = {}) => realFetch(url, { ...init, headers: { 'x-api-key': 'test-key', ...(init.headers || {}) } });

function startTestServer() {
  const repo = createMemoryRepository(buildDemoRows());
  const weather = createWeatherService();
  const server = http.createServer(createRequestHandler({ repo, weather, apiKey: 'test-key' }));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        repo,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

test('FarmTori Commercial REST API Test Suite', async (t) => {
  const env = await startTestServer();

  t.after(async () => {
    await env.close();
  });

  await t.test('GET /health returns 200 with FarmTori metadata', async () => {
    const res = await fetch(`${env.url}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.app, 'FarmTori');
    assert.equal(body.tagline, 'Every farm has a story worth recording');
  });

  await t.test('GET /api/farms returns list of farms with farmer info', async () => {
    const res = await fetch(`${env.url}/api/farms`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.count > 0);
    assert.ok(body.data[0].name);
    assert.ok(body.data[0].farmer);
  });

  await t.test('POST /api/farms creates a new farm plot with validation', async () => {
    // Missing required fields
    const badRes = await fetch(`${env.url}/api/farms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete Farm' }),
    });
    assert.equal(badRes.status, 400);

    // Valid farm creation
    const goodRes = await fetch(`${env.url}/api/farms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmer_id: '00000000-0000-0000-0000-000000000001',
        name: 'Gbarnga Commercial Cocoa',
        county: 'Bong',
        district: 'Jorquelleh',
        size: 5.5,
      }),
    });
    assert.equal(goodRes.status, 201);
    const body = await goodRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Gbarnga Commercial Cocoa');
    assert.equal(body.data.county, 'Bong');
  });

  await t.test('POST /api/harvests registers batch and generates QR token', async () => {
    const res = await fetch(`${env.url}/api/harvests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farm_id: 'farm-001',
        farmer_id: '00000000-0000-0000-0000-000000000001',
        crop_id: '00000000-0000-0000-0000-000000000001',
        quantity: 1200,
        unit: 'kg',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.qr_token);
    assert.ok(body.data.batch_reference);

    // Verification check for this newly created harvest token
    const verifyRes = await fetch(`${env.url}/api/verify?token=${body.data.qr_token}`);
    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.verified, true);
    assert.equal(verifyBody.batch.quantity, 1200);
  });

  await t.test('GET /api/reports/commercial returns aggregated metrics', async () => {
    const res = await fetch(`${env.url}/api/reports/commercial`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(typeof body.total_farms === 'number');
    assert.ok(typeof body.total_production_kg === 'number');
    assert.ok(typeof body.estimated_commercial_revenue_usd === 'number');
    assert.ok(typeof body.net_commercial_margin_usd === 'number');
  });

  await t.test('GET /api/weather/alerts returns advisory alerts for county', async () => {
    const res = await fetch(`${env.url}/api/weather/alerts?county=Nimba`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.county, 'Nimba');
    assert.ok(Array.isArray(body.advisories));
    assert.ok(body.forecast);
  });
});
