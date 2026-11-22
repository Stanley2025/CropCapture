const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { makeDb, insights, detail, ID } = require('./helpers/countyDb');
const { loadAdmin, stub, fromAdmin } = require('./helpers/loadAdminTs');

// ---- stand-ins for what only exists inside Next.js; the page itself is the real file -------------------------
const adminReact = fromAdmin('react');
const { renderToStaticMarkup } = fromAdmin('react-dom/server');
stub('next/link', { __esModule: true, default: ({ href, children, ...rest }) => adminReact.createElement('a', { href, ...rest }, children) });
stub('@/components/layout/AdminLayout', { AdminLayout: ({ children }) => adminReact.createElement('div', { 'data-layout': true }, children) });

// icons are only pictures here
stub('lucide-react', new Proxy({ __esModule: true }, { get: (target, name) => (name in target ? target[name] : () => adminReact.createElement('svg', { 'data-icon': String(name) })) }));

let currentService = null;
let currentCrops = [];
stub('@/lib/counties/server', {
  countyService: { insights: (...a) => currentService.insights(...a), detail: (...a) => currentService.detail(...a) },
  listCrops: async () => currentCrops,
});

const S = loadAdmin('lib/counties/service.ts');
const page = loadAdmin('app/dashboard/counties/page.tsx').default;

function clientFor(db, uid) {
  const sqlFor = {
    is_insights_admin: ['SELECT public.is_insights_admin() AS r', () => []],
    admin_county_insights: ['SELECT public.admin_county_insights($1::int, $2::uuid, $3::boolean) AS r', (a) => [a.p_year, a.p_crop, a.p_approved_only]],
    admin_county_detail: ['SELECT public.admin_county_detail($1::uuid, $2::int, $3::uuid, $4::boolean) AS r', (a) => [a.p_county, a.p_year, a.p_crop, a.p_approved_only]],
  };
  return {
    auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null } }) },
    rpc: async (name, args = {}) => {
      const [sql, params] = sqlFor[name];
      try {
        await db.query(`SELECT set_config('test.uid', $1, false)`, [uid || '']);
        return { data: (await db.query(sql, params(args))).rows[0].r, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: /not_allowed/.test(e.message) ? '42501' : undefined } };
      }
    },
  };
}

async function render(db, uid, params = { year: '2026' }) {
  currentService = S.createCountyService(async () => clientFor(db, uid));
  const element = await page({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(element);
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const cell = (html, rowName, colIndex) => {
  const row = html.match(new RegExp(`<tr[^>]*><th scope="row"[^>]*><a[^>]*>${rowName}</a></th>(.*?)</tr>`, 's'));
  assert.ok(row, `row ${rowName}`);
  return text(row[1].split('</td>')[colIndex - 1] + '</td>').trim();
};

test('the page shows the cards, the table, the gender bars and the notes with the real numbers', async () => {
  const html = await render(await makeDb(), ID.admin);
  const t = text(html);
  // cards, including the ties
  assert.match(t, /County with most farmers Bong and Nimba tied 4 farmers/);
  assert.match(t, /County with most harvest Lofa and Nimba tied 800 kg/);
  assert.match(t, /County with most farms Nimba 6 farms/);
  assert.match(t, /Gender with most farms Male 9 farms \(64\.3% of all farms\) Owner gender is not recorded for 1 of these farms\./);
  assert.match(t, /County where women own the most farms Bong 2 farms/);
  assert.match(t, /County where men own the most farms Nimba 5 farms/);
  // table cells: farmers, farms, harvest, male, female, not recorded
  assert.equal(cell(html, 'Nimba', 1), '4');
  assert.equal(cell(html, 'Nimba', 2), '6');
  assert.equal(cell(html, 'Nimba', 3), '800');
  assert.equal(cell(html, 'Bong', 6), '1', 'Bong has 1 farmer with no gender recorded');
  assert.equal(cell(html, 'Sinoe', 3), '0', 'a county with no records shows 0');
  assert.equal(cell(html, 'Unassigned county', 3), '25');
  // the totals row
  assert.match(t, /All counties 10 14 2,325/);
  // gender bars have written labels and a text description
  assert.match(html, /aria-label="Bong: 4 farmers\. Male 2, female 1, not recorded 1\."/);
  assert.match(t, /Male 2 \(50\.0%\)\s+·\s+Female 1 \(25\.0%\)\s+·\s+Gender not recorded 1 \(25\.0%\)/);
  // what is counted
  assert.match(t, /Sample records are not counted: 1 farmers, 1 farms, 1 harvests\./);
  assert.match(t, /Deleted harvests \(1\) and harvests replaced by a newer edit \(1\) are not counted\./);
  assert.match(t, /1 harvests have no weight in kg/);
  assert.match(t, /Last updated: .* UTC/);
});

test('the table is sorted by harvest, highest first, by default, with proper header markup', async () => {
  const html = await render(await makeDb(), ID.admin);
  const order = [...html.matchAll(/<th scope="row"[^>]*><a[^>]*>([^<]+)<\/a><\/th>/g)].map((m) => m[1]);
  assert.deepEqual(order, ['Lofa', 'Nimba', 'Bong', 'Sinoe', 'Unassigned county']);
  assert.match(html, /<th scope="col" aria-sort="descending"[^>]*><a[^>]*>Harvest \(kg\)/);
  assert.match(html, /<caption class="sr-only">/);
  const sorted = await render(await makeDb(), ID.admin, { year: '2026', sort: 'farmers', dir: 'asc' });
  assert.deepEqual([...sorted.matchAll(/<th scope="row"[^>]*><a[^>]*>([^<]+)<\/a><\/th>/g)].map((m) => m[1]), ['Sinoe', 'Lofa', 'Bong', 'Nimba', 'Unassigned county']);
});

test('filters in the address change the numbers, and the same address shows the same numbers again', async () => {
  const db = await makeDb();
  const a = await render(db, ID.admin, { year: '2025' });
  assert.equal(cell(a, 'Nimba', 3), '40');
  assert.match(text(a), /County with most harvest Nimba 40 kg/);
  const b1 = await render(db, ID.admin, { year: 'all', crop: ID.cassava, status: 'all' });
  const b2 = await render(db, ID.admin, { year: 'all', crop: ID.cassava, status: 'all' });
  assert.equal(b1.replace(/Last updated.*$/s, ''), b2.replace(/Last updated.*$/s, ''), 'a reload shows the same page');
  assert.equal(cell(b1, 'Nimba', 3), '50');
  const c = await render(db, ID.admin, { year: '2026', status: 'approved' });
  assert.equal(cell(c, 'Nimba', 3), '200');
  // the filter form shows what is applied, and the sort and export links carry the filters
  assert.match(c, /<option value="approved" selected="">/);
  assert.match(c, /href="\/dashboard\/counties\/export\?year=2026&amp;status=approved&amp;sort=harvest_kg&amp;dir=desc"/);
});

test('opening a county shows its districts, "Fewer than 5" for small groups, and its top crops', async () => {
  const db = await makeDb();
  const html = await render(db, ID.admin, { year: '2026', county: ID.nimba });
  const t = text(html);
  assert.match(t, /Nimba: districts/);
  assert.match(t, /Sanniquellie-Mahn 2 4 300 Fewer than 5/);
  assert.match(t, /Gbehlageh 2 2 500 Fewer than 5/);
  assert.match(t, /Top crops by harvest Rice 750 kg Cassava 50 kg/);
  assert.match(html, /Back to all counties/);
  const un = await render(db, ID.admin, { year: '2026', county: 'unassigned' });
  assert.match(text(un), /Unassigned county: districts/);
});

test('no personal details appear anywhere on the page', async () => {
  const db = await makeDb();
  const html = await render(db, ID.admin, { year: '2026', county: ID.nimba });
  for (const secret of ['Test m1', 'Test f1', 'phone', '0000-4000-8000-000000000100', 'verified', 'tamper-proof', 'cryptographic']) assert.ok(!html.includes(secret), secret);
});

test('the empty state, the signed-out and no-access states, and the error state with a retry', async () => {
  const empty = await makeDb();
  await empty.exec('DELETE FROM harvest_batches; DELETE FROM farms; DELETE FROM farmers');
  assert.match(text(await render(empty, ID.admin)), /No records match these filters/);

  const db = await makeDb();
  const out = text(await render(db, null));
  assert.match(out, /Sign in to see this section/);
  assert.ok(!/Nimba|Bong|Lofa|County with most|\d/.test(out), 'no county, card or number for a signed-out user');
  assert.match(text(await render(db, ID.inspector)), /You do not have access to this section/);
  assert.match(text(await render(db, ID.farmerUser)), /You do not have access to this section/);

  currentService = S.createCountyService(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ID.admin } } }) },
    rpc: async (name) => (name === 'is_insights_admin' ? { data: true, error: null } : { data: null, error: { message: 'connection refused' } }),
  }));
  const failed = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ year: '2026' }) }));
  assert.match(text(failed), /The county numbers could not be loaded/);
  assert.match(failed, /<a href="\/dashboard\/counties\?year=2026&amp;status=all&amp;sort=harvest_kg&amp;dir=desc"[^>]*>Try again<\/a>/);
});

test('every control that can be pressed is at least 44 px tall and every number uses tabular figures', async () => {
  const html = await render(await makeDb(), ID.admin);
  for (const control of html.match(/<(select|button)[^>]*class="[^"]*"/g)) assert.match(control, /min-h-\[44px\]/);
  assert.match(html, /class="space-y-6 tabular-nums"/);
  assert.ok((html.match(/tabular-nums/g) || []).length > 50);
});
