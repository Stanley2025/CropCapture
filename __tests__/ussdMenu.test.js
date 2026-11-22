const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { handleUssd, MAX_SCREEN_CHARS, BUSY_MESSAGE } = require('../server/ussd/menu');
const { createMemoryRepository } = require('../server/ussd/repository');
const { createWeatherService } = require('../server/ussd/weather');
const { buildDemoRows, EXISTING_APP_FARMER } = require('../server/ussd/demoData');
const { createRequestHandler } = require('../server/index');
const shared = require('../src/shared/farmRecords');
const geo = require('../server/ussd/geo');
const { parseDate, parseMulti, parseText } = require('../server/ussd/registerFarm');
const { createSupabaseRepository } = require('../server/ussd/repository');

const NOW = new Date('2026-11-21T10:00:00Z');
const MUSU = '+231771000001'; // 1 farm (Rice), seeded
const JOSEPH = '+231881000002'; // 2 farms (Cocoa, Cassava), seeded
const NEW_PHONE = '+231771000009'; // not registered

function freshRepo() {
  const rows = buildDemoRows(NOW);
  // An account created by the mobile app, stored in the app's phone format.
  rows.farmers.push({
    ...EXISTING_APP_FARMER, farmer_id_code: 'AGR-F-000001', county: 'Nimba', district: 'Sanniquellie-Mahn',
    community: 'Gbehley', source: 'app', created_at: '2026-08-01T00:00:00Z',
  });
  return createMemoryRepository(rows);
}

function fakeWeather(overrides = {}) {
  return { getForecast: async () => [
    { day: 'Sat', label: 'Rain', tMin: 22, tMax: 30, rainChance: 80 },
    { day: 'Sun', label: 'Showers', tMin: 23, tMax: 31, rainChance: 60 },
    { day: 'Mon', label: 'Some sun', tMin: 23, tMax: 32, rainChance: 20 },
  ], ...overrides };
}

/** One request, like the gateway sends it. Asserts protocol + 160-char rule on every screen. */
async function dial(repo, phone, inputs, { sessionId = 'test-session', weather = fakeWeather() } = {}) {
  const text = Array.isArray(inputs) ? inputs.join('*') : inputs;
  const reply = await handleUssd({ sessionId, serviceCode: '*123#', phoneNumber: phone, text }, { repo, weather, now: () => NOW });
  assert.match(reply, /^(CON|END) /, `bad prefix: ${reply}`);
  const body = reply.slice(4);
  assert.ok(body.length <= MAX_SCREEN_CHARS, `screen is ${body.length} chars:\n${body}`);
  return { reply, body, isEnd: reply.startsWith('END'), isCon: reply.startsWith('CON') };
}

/** Full session: every prefix of the inputs, exactly like a real gateway. Returns the last reply. */
async function session(repo, phone, inputs, opts = {}) {
  let last = await dial(repo, phone, [], opts);
  for (let i = 1; i <= inputs.length; i++) {
    assert.ok(last.isCon, `session ended early at step ${i}: ${last.body}`);
    last = await dial(repo, phone, inputs.slice(0, i), opts);
  }
  return last;
}

// ---------------------------------------------------------------------------
// Identification
// ---------------------------------------------------------------------------
test('unregistered phone is routed to registration first', async () => {
  const repo = freshRepo();
  const r = await dial(repo, NEW_PHONE, []);
  assert.ok(r.isCon);
  assert.match(r.body, /not registered/);
  assert.match(r.body, /Enter your full name/);
});

test('phone matching an existing app account uses that account (any phone format)', async () => {
  const repo = freshRepo();
  for (const phone of ['+231776543210', '0776543210', '231776543210']) {
    const r = await dial(repo, phone, []);
    assert.match(r.body, /Hi Emmanuel/, phone);
    assert.match(r.body, /1\. Register farm/);
  }
});

// ---------------------------------------------------------------------------
// Register farm
// ---------------------------------------------------------------------------
// Full registration, same questions as the app's Register Farm screen:
// name, type, county, district, community, size, unit, ownership, soil, irrigation, then crops / livestock, date.
const CROPS_FARM = (name) => [name, '1', '98', '12', '1', 'Gbehley', '2.5', '1', '1', '1', '2', '1,2', '1', '1'];
//                              ^name ^crops ^Nimba ^district1 ^community ^size ^acres ^tenure1 ^soil1 ^irrig:No ^Rice,Cassava ^today ^save

test('new farmer registration saves every field the app saves, tagged source=ussd', async () => {
  const repo = freshRepo();
  const r = await session(repo, NEW_PHONE, ['Sarah Johnson', ...CROPS_FARM('Sarah Rice Farm')]);
  assert.ok(r.isEnd);
  assert.match(r.body, /Welcome Sarah! Farm "Sarah Rice Farm" saved/);
  assert.match(r.body, /Your Farm ID: \d{6}/);

  const farmer = await repo.findFarmerByPhone(NEW_PHONE);
  assert.equal(farmer.full_name, 'Sarah Johnson');
  assert.equal(farmer.phone_number, '+231-77-100-0009', 'stored in the app phone format');
  assert.equal(farmer.community, 'Gbehley');
  assert.equal(farmer.source, 'ussd');

  const [farm] = await repo.getFarms(farmer.id);
  const nimba = geo.getCountyRecord('Nimba');
  const district = geo.getDistricts('Nimba')[0];
  assert.equal(farm.name, 'Sarah Rice Farm');
  assert.equal(farm.farming_type, 'crops');
  assert.equal(farm.livestock_details, null);
  assert.equal(farm.county, 'Nimba');
  assert.equal(farm.county_id, nimba.id);
  assert.equal(farm.district, district.name);
  assert.equal(farm.district_id, district.id);
  assert.equal(farm.community, 'Gbehley');
  assert.equal(farm.size, 2.5);
  assert.equal(farm.size_unit, 'acres');
  assert.equal(farm.ownership_type, 'Family Customary Land');
  assert.equal(farm.soil_type, 'Clay Loam (Swamp Basin)');
  assert.equal(farm.irrigation, false);
  assert.equal(farm.registration_date, '2026-11-21');
  assert.equal(farm.latitude, 6.842);
  assert.equal(farm.description, 'Crops parcel cultivating Rice, Cassava. Recorded via USSD.');
  assert.equal(farm.source, 'ussd');
  const seasons = await repo.getSeasons([farm.id]);
  assert.deepEqual(seasons.map((x) => x.crop_id).sort(), [shared.CROPS[0].id, shared.CROPS[1].id].sort());

  const again = await dial(repo, NEW_PHONE, [], { sessionId: 'next' });
  assert.match(again.body, /Hi Sarah/);
});

test('the USSD farm row has exactly the same fields as the app builds', async () => {
  const repo = freshRepo();
  await session(repo, MUSU, ['1', ...CROPS_FARM('Fields check')]);
  const farm = repo.db.farms.at(-1);
  const appFields = ['id', 'farmer_id', 'name', 'farming_type', 'livestock_details', 'county', 'district', 'county_id', 'district_id',
    'community', 'size', 'size_unit', 'latitude', 'longitude', 'ownership_type', 'irrigation', 'soil_type', 'photo_url',
    'description', 'registration_date', 'is_active', 'created_at', 'updated_at'];
  assert.deepEqual(Object.keys(farm).filter((k) => k !== 'source').sort(), appFields.sort());
});

test('registered farmer can register an additional farm', async () => {
  const repo = freshRepo();
  const r = await session(repo, MUSU, ['1', ...CROPS_FARM('Kollie Upland')]);
  assert.ok(r.isEnd);
  assert.match(r.body, /^Farm saved!\nKollie Upland\n.+, Nimba\nTo see your farms/);
  const farmer = await repo.findFarmerByPhone(MUSU);
  assert.equal((await repo.getFarms(farmer.id)).length, 2);
});

test('livestock farm: every livestock field is saved, no crop seasons', async () => {
  const repo = freshRepo();
  const inputs = [
    '1', 'Goat Pen', '2', '2', '1', 'Suakoko', '4', '2', '3', '2', '1', // name, Livestock, Bong, district, community, size 4 hectares, Leasehold, soil 2, irrigation yes
    '1,4', '2', 'Local Cross', '40', '1,2', '3', '4', // Goats+Chickens, type own breed, 40 head, Meat+Eggs, Intensive, Poultry coop
    '1', '8x3 m', '50', // housing details: size, capacity
    '1', '3', '1', '2 acres', // grazing yes, Rotational paddock, area
    '4', '3', // water Borehole, feeding Pasture only
    '1', '1', // today, save
  ];
  const r = await session(repo, MUSU, inputs);
  assert.ok(r.isEnd, r.body);
  const farm = repo.db.farms.at(-1);
  assert.equal(farm.farming_type, 'livestock');
  assert.equal(farm.size, 4);
  assert.equal(farm.size_unit, 'hectares');
  assert.equal(farm.ownership_type, 'Leasehold Agreement');
  assert.equal(farm.soil_type, 'Sandy Clay Loam');
  assert.equal(farm.irrigation, true);
  assert.deepEqual(farm.livestock_details, {
    animal_type: 'Goats, Chickens',
    selected_animals: ['Goats', 'Chickens'],
    breed: 'Local Cross',
    head_count: 40,
    production_purpose: ['Meat production', 'Egg production'],
    management_system: 'Intensive',
    housing_type: 'Poultry Coop / Run',
    housing_size: '8x3 m',
    housing_capacity: 50,
    grazing_availability: true,
    grazing_arrangement: 'Rotational Grazing Paddock',
    grazing_area: '2 acres',
    water_source: 'Borehole',
    feeding_system: 'Natural Pasture Grazing Only',
  });
  assert.equal(farm.description, 'Goats & Chickens holding (40 head) raised for Meat production, Egg production under Intensive management. Recorded via USSD.');
  assert.equal(repo.db.farm_seasons.filter((x) => x.farm_id === farm.id).length, 0);
});

test('crops + livestock farm with skipped optional questions and another registration date', async () => {
  const repo = freshRepo();
  const inputs = [
    '1', 'Mixed Farm', '3', '12', '2', 'Saclepea', '10', '1', '2', '4', '2', // Both, Nimba, district 2, size 10 acres, Freehold, soil 4, irrigation no
    '1', // crops: Rice
    '5', '1', '5', '3', '1', '3', // Cow, common breed, 5 head, Milk, Free-range, Open kraal
    '2', // skip housing size/capacity
    '2', // no grazing land
    '1', '4', // water Well, feeding Pasture + feed
    '2', '01032026', // another date
    '1',
  ];
  const r = await session(repo, MUSU, inputs);
  assert.ok(r.isEnd, r.body);
  const farm = repo.db.farms.at(-1);
  assert.equal(farm.farming_type, 'both');
  assert.equal(farm.ownership_type, 'Freehold / Titled Deed');
  assert.equal(farm.soil_type, 'Red Lateritic Soil');
  assert.equal(farm.registration_date, '2026-03-01');
  assert.equal(farm.created_at, '2026-03-01T12:00:00.000Z');
  assert.equal(farm.livestock_details.breed, 'Ndama / Muturu');
  assert.equal(farm.livestock_details.housing_size, undefined);
  assert.equal(farm.livestock_details.grazing_availability, false);
  assert.equal(farm.livestock_details.grazing_arrangement, undefined);
  assert.equal(farm.description, 'Integrated farm: Cultivating Rice and rearing Cow (5 head). Recorded via USSD.');
  assert.equal(repo.db.farm_seasons.filter((x) => x.farm_id === farm.id).length, 1, 'one season per crop');
});

test('registration answers are validated', async () => {
  const repo = freshRepo();
  const base = ['1', 'Valid Farm', '3', '12', '1']; // up to the community question
  const cases = [
    [[...base.slice(0, 2), '9'], /Invalid choice\./],
    [[...base, '123'], /Please enter a community or town\./],
    [[...base, 'Town', 'abc'], /Enter a number, e\.g\. 2\.5\./],
    [[...base, 'Town', '-5'], /Enter a number, e\.g\. 2\.5\./],
    [[...base, 'Town', '2', '5'], /Invalid choice\./],
    [[...base, 'Town', '2', '1', '1', '1', '2', '1,99'], /Type numbers like 1,3\./],
    [[...base, 'Town', '2', '1', '1', '1', '2', 'rice'], /Type numbers like 1,3\./],
  ];
  for (const [inputs, expected] of cases) {
    const r = await dial(repo, MUSU, inputs);
    assert.ok(r.isCon, inputs.join('*'));
    assert.match(r.body, expected, inputs.join('*'));
  }
  const livestock = ['1', 'Valid Farm', '2', '2', '1', 'Town', '2', '1', '1', '1', '1', '1,2'];
  assert.match((await dial(repo, MUSU, [...livestock, '1', '-1'])).body, /Enter a whole number, e\.g\. 12\./);
  assert.match((await dial(repo, MUSU, [...livestock, '1', 'many'])).body, /Enter a whole number, e\.g\. 12\./);
  assert.match((await dial(repo, MUSU, [...livestock, '2', '??'])).body, /Please enter a breed name\./);
  const toDate = [...livestock, '1', '5', '1', '1', '1', '2', '2', '1', '1']; // up to the registration date question
  assert.match((await dial(repo, MUSU, toDate)).body, /Registration date:/);
  for (const bad of ['31022026', '01012099', 'tomorrow', '1/1/26']) {
    assert.match((await dial(repo, MUSU, [...toDate, '2', bad])).body, /Use DDMMYYYY/, bad);
  }
  assert.match((await dial(repo, MUSU, [...toDate, '2', '15/03/2026'])).body, /Save this farm\?/);
});

test('0 goes back inside the registration, 00 returns to the menu, 2 cancels without saving', async () => {
  const repo = freshRepo();
  const before = repo.db.farms.length;
  assert.match((await dial(repo, MUSU, ['1', 'Farm', '3', '12', '1', 'Town', '2', '1', '1', '0'])).body, /^Land ownership:/);
  assert.match((await dial(repo, MUSU, ['1', 'Farm', '3', '12', '0'])).body, /^Select county:/);
  assert.match((await dial(repo, MUSU, ['1', 'Farm', '3', '12', '1', 'Town', '00'])).body, /^FarmTori - Hi Musu/);
  const cancelled = await session(repo, MUSU, ['1', ...CROPS_FARM('Never Saved').slice(0, -1), '2']);
  assert.match(cancelled.body, /Cancelled/);
  assert.equal(repo.db.farms.length, before);
});

test('registration confirm screen summarises the farm before saving', async () => {
  const repo = freshRepo();
  const r = await dial(repo, MUSU, ['1', ...CROPS_FARM('Summary Farm').slice(0, -1)]);
  assert.match(r.body, /^Save this farm\?\nSummary Farm - Crops\n.+, Nimba\n2\.5 Acres\nRice, Cassava\n1\. Save  2\. Cancel/);
});

test('district list follows the app data and pages through long counties', async () => {
  const repo = freshRepo();
  const kru = geo.getDistricts('Grand Kru');
  assert.equal(kru.length, 19);
  const p1 = await dial(repo, MUSU, ['1', 'Farm', '1', '7']);
  assert.match(p1.body, /^Grand Kru district:\n1\. /);
  assert.match(p1.body, /98\. More/);
  const p3 = await dial(repo, MUSU, ['1', 'Farm', '1', '7', '98', '98']);
  assert.match(p3.body, /^Grand Kru district:\n13\. /);
  const picked = await dial(repo, MUSU, ['1', 'Farm', '1', '7', '98', '98', '19']);
  assert.match(picked.body, /Enter your community or town:/);
  for (const county of shared.LIBERIA_COUNTIES) {
    assert.ok(geo.getDistricts(county.name).length > 0, `${county.name} has districts`);
    assert.ok(geo.getCountyRecord(county.name), `${county.name} exists in the app data`);
  }
});

test('every registration screen (and its error variant) stays within 160 characters', async () => {
  const repo = freshRepo();
  const path = [
    '1', 'A Long Farm Name Of 30 Chars Okay'.slice(0, 30), '3', '5', '4', 'A Very Long Community Name Of Forty Chars Here'.slice(0, 40), '99999.99', '2', '5', '7', '1',
    '1,2,3,4,5,6,7,8,9,10', '1,2,3,4,5', '2', 'A Very Long Breed Name Of Forty Characters Ok'.slice(0, 40), '999999', '1,2,3,4', '3', '6', '1',
    'A very long housing size 30 ch', '999999', '1', '5', '1', 'A very long grazing area 30 chars'.slice(0, 30), '6', '5', '2', '15032026',
  ];
  for (let i = 0; i <= path.length; i++) {
    const prefix = path.slice(0, i);
    await dial(repo, MUSU, prefix);
    await dial(repo, MUSU, [...prefix, '@@']); // invalid input: error + prompt
  }
  const last = await dial(repo, MUSU, path);
  assert.match(last.body, /^Save this farm\?/);
});

test('farm details and livestock details can be viewed after registration', async () => {
  const repo = freshRepo();
  const inputs = [
    'Joy Kamara', 'Joy Mixed Farm', '3', '12', '1', 'Gbehley', '10', '1', '2', '4', '1',
    '1', '1,4', '1', '25', '1,3', '2', '4', '1', '6x3 m', '30', '1', '1', '1', '2 acres', '3', '2', '1', '1',
  ];
  const saved = await session(repo, NEW_PHONE, inputs);
  assert.ok(saved.isEnd, saved.body);

  const farm = await dial(repo, NEW_PHONE, ['6', '1'], { sessionId: 'v' });
  assert.match(farm.body, /^Joy Mixed Farm\nNimba, Boe & Quilla\n10 acres - Mixed\nHarvests: 0  Spent: \$0\n1\. Harvests  2\. Expenses\n3\. Details  4\. Livestock/);

  const d1 = await dial(repo, NEW_PHONE, ['6', '1', '3'], { sessionId: 'v' });
  assert.match(d1.body, /^Community: Gbehley\nLand: Freehold \/ deed\nSoil: Red lateritic\nIrrigation: Yes\n98\. More/);
  const d2 = await dial(repo, NEW_PHONE, ['6', '1', '3', '98'], { sessionId: 'v' });
  assert.match(d2.body, /^Crops: Rice\nRegistered: 21 Nov/);

  const a1 = await dial(repo, NEW_PHONE, ['6', '1', '4'], { sessionId: 'v' });
  assert.match(a1.body, /^Goats, Chickens: 25 head\nBreed: West African Dwarf, Local/);
  assert.match(a1.body, /Purpose: Meat, Milk/);
  const a2 = await dial(repo, NEW_PHONE, ['6', '1', '4', '98'], { sessionId: 'v' });
  assert.match(a2.body, /Housing: Poultry coop/);
  assert.match(a2.body, /Pen: 6x3 m, 30 animals/);
  const a3 = await dial(repo, NEW_PHONE, ['6', '1', '4', '98', '98'], { sessionId: 'v' });
  assert.match(a3.body, /Feed: Commercial feed|Feed: Pasture only|Water: /);
  // back from a detail screen returns to the farm
  assert.match((await dial(repo, NEW_PHONE, ['6', '1', '3', '0'], { sessionId: 'v' })).body, /^Joy Mixed Farm/);
});

test('record harvest (single farm) saves to the shared store, linked to the active season', async () => {
  const repo = freshRepo();
  const before = repo.db.harvest_batches.length;
  const r = await session(repo, MUSU, ['2', '1', '250', '1']);
  assert.ok(r.isEnd);
  assert.match(r.body, /Harvest saved!\nRice: 250 kg\nRef: LR-BON-GEN-RICE-2026-\d{6}/);

  assert.equal(repo.db.harvest_batches.length, before + 1);
  const h = repo.db.harvest_batches.at(-1);
  assert.equal(h.quantity, 250);
  assert.equal(h.unit, 'kg');
  assert.equal(h.status, 'submitted');
  assert.equal(h.source, 'ussd');
  assert.equal(h.season_id, 'd2000000-0000-4000-8000-000000000001');
  assert.ok(h.qr_token.startsWith('cropcapture_'));
});

test('record harvest asks which farm when the farmer has several', async () => {
  const repo = freshRepo();
  const pick = await dial(repo, JOSEPH, ['2']);
  assert.match(pick.body, /Select farm:\n1\. Flomo Cocoa Farm\n2\. Flomo Cassava Plot/);
  const r = await session(repo, JOSEPH, ['2', '2', '2', '400', '1']);
  assert.match(r.body, /Cassava: 400 kg/);
  assert.equal(repo.db.harvest_batches.at(-1).farm_id, 'd1000000-0000-4000-8000-000000000003');
});

test('retrying the same request does not create a duplicate record', async () => {
  const repo = freshRepo();
  const before = repo.db.harvest_batches.length;
  await dial(repo, MUSU, ['2', '1', '100', '1'], { sessionId: 'retry-1' });
  await dial(repo, MUSU, ['2', '1', '100', '1'], { sessionId: 'retry-1' });
  assert.equal(repo.db.harvest_batches.length, before + 1);
  await dial(repo, MUSU, ['2', '1', '100', '1'], { sessionId: 'retry-2' });
  assert.equal(repo.db.harvest_batches.length, before + 2, 'a new session is a new record');
});

// ---------------------------------------------------------------------------
// Record expense
// ---------------------------------------------------------------------------
test('record expense maps the simple category onto the app category', async () => {
  const repo = freshRepo();
  const cats = await dial(repo, MUSU, ['3']);
  assert.match(cats.body, /1\. Seeds\n2\. Labour\n3\. Fertilizer\n4\. Transport\n5\. Other/);
  const r = await session(repo, MUSU, ['3', '2', '40.50', '1']);
  assert.match(r.body, /Expense saved!\nLabour: \$40\.5\nFarm: Kollie Rice Farm/);
  const e = repo.db.expenses.at(-1);
  assert.equal(e.category, 'Labour & Wages');
  assert.equal(e.amount, 40.5);
  assert.equal(e.currency, 'USD');
  assert.equal(e.source, 'ussd');
});

test('confirm screen: 2 cancels without saving', async () => {
  const repo = freshRepo();
  const before = repo.db.expenses.length;
  const r = await session(repo, MUSU, ['3', '1', '20', '2']);
  assert.ok(r.isEnd);
  assert.match(r.body, /Cancelled/);
  assert.equal(repo.db.expenses.length, before);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
test('farm summary shows harvest per crop, expenses and net for the current season', async () => {
  const repo = freshRepo();
  const r = await dial(repo, MUSU, ['4']);
  assert.ok(r.isEnd);
  // Seed: rice 450 + 300 kg; expenses 60 + 35 + 80 = 175; est. sales 750 x 0.45 = 337.5
  assert.match(r.body, /^2026: Kollie Rice Farm/);
  assert.match(r.body, /Rice: 750 kg/);
  assert.match(r.body, /Expenses: \$175/);
  assert.match(r.body, /Est\. sales: \$338/);
  assert.match(r.body, /Net: \+\$163/);
});

test('summary includes records just saved via USSD and covers all farms', async () => {
  const repo = freshRepo();
  await session(repo, JOSEPH, ['2', '2', '2', '100', '1'], { sessionId: 's1' }); // farm 2, Cassava 100
  await session(repo, JOSEPH, ['3', '1', '4', '500', '1'], { sessionId: 's2' }); // farm 1, Transport $500
  const r = await dial(repo, JOSEPH, ['4'], { sessionId: 's3' });
  assert.match(r.body, /^2026: 2 farms/);
  assert.match(r.body, /Cassava: 1,000 kg/);
  assert.match(r.body, /Cocoa: 620 kg/);
  assert.match(r.body, /Expenses: \$665/); // 45 + 120 + 500
});

// ---------------------------------------------------------------------------
// Validation & navigation
// ---------------------------------------------------------------------------
test('invalid menu choice re-prompts with a short error instead of ending', async () => {
  const repo = freshRepo();
  const r = await dial(repo, MUSU, ['9']);
  assert.ok(r.isCon);
  assert.match(r.body, /^Invalid choice\.\nFarmTori/);
  // ...and the session continues normally after the bad input
  const next = await dial(repo, MUSU, ['9', '2']);
  assert.match(next.body, /Which crop did you harvest\?/);
});

test('non-numeric and zero quantities are rejected', async () => {
  const repo = freshRepo();
  for (const bad of ['abc', '1.234', '', '-5', '2000000']) {
    const r = await dial(repo, MUSU, ['2', '1', bad]);
    assert.ok(r.isCon, bad);
    assert.match(r.body, /Enter a number, e\.g\. 250\./, `input "${bad}"`);
  }
  const ok = await dial(repo, MUSU, ['2', '1', 'abc', '75']);
  assert.match(ok.body, /Save harvest\?\nRice: 75 kg/);
});

test('invalid names are rejected', async () => {
  const repo = freshRepo();
  for (const bad of ['A', '12345', '@@@']) {
    const r = await dial(repo, NEW_PHONE, [bad]);
    assert.match(r.body, /Please enter your name\./, bad);
  }
});

test('0 goes back one screen, 00 returns to the main menu', async () => {
  const repo = freshRepo();
  assert.match((await dial(repo, MUSU, ['2', '0'])).body, /^FarmTori - Hi Musu/);
  assert.match((await dial(repo, MUSU, ['2', '1', '0'])).body, /^Which crop did you harvest\?/);
  assert.match((await dial(repo, MUSU, ['2', '1', '250', '00'])).body, /^FarmTori - Hi Musu/);
  // back at root stays on root
  assert.match((await dial(repo, MUSU, ['0'])).body, /^FarmTori - Hi Musu/);
  // after going back the flow continues from the earlier screen
  const r = await dial(repo, MUSU, ['2', '1', '0', '2']);
  assert.match(r.body, /Enter Cassava quantity in kg:/);
});

test('inner screens show the back / menu hint, root does not', async () => {
  const repo = freshRepo();
  assert.doesNotMatch((await dial(repo, MUSU, [])).body, /0 Back/);
  assert.match((await dial(repo, MUSU, ['3'])).body, /0 Back  00 Menu$/);
});

test('county list is paginated and back works between pages', async () => {
  const repo = freshRepo();
  const p1 = await dial(repo, MUSU, ['1', 'Test Farm', '1']);
  assert.match(p1.body, /1\. Bomi/);
  assert.match(p1.body, /98\. More/);
  assert.doesNotMatch(p1.body, /Nimba/);
  const p2 = await dial(repo, MUSU, ['1', 'Test Farm', '1', '98']);
  assert.match(p2.body, /12\. Nimba/);
  assert.match(p2.body, /14\. Rivercess/);
  const back = await dial(repo, MUSU, ['1', 'Test Farm', '1', '98', '0']);
  assert.match(back.body, /1\. Bomi/);
  const picked = await dial(repo, MUSU, ['1', 'Test Farm', '1', '98', '15']);
  assert.match(picked.body, /^Sinoe district:/);
});

test('flows needing a farm tell farmers without one to register', async () => {
  const repo = freshRepo();
  await repo.createFarmer(shared.buildFarmerRecord({ fullName: 'No Farm Yet', phone: '+231770000777', county: 'Bomi' }));
  for (const choice of ['2', '3', '4']) {
    const r = await dial(repo, '+231770000777', [choice]);
    assert.match(r.body, /You have no farm yet\.\n1\. Register farm/);
  }
  assert.match((await dial(repo, '+231770000777', ['2', '1'])).body, /Enter farm name:/);
});

test('every screen stays within 160 characters, including error variants', async () => {
  const repo = freshRepo();
  const paths = [
    [], ['1'], ['1', 'x'], ['1', 'Farm Name That Is Thirty Chars'], ['1', 'Farm', '1'], ['1', 'Farm', '99'],
    ['1', 'Farm', '98'], ['1', 'Farm', '98', '99'], ['1', 'Farm', '5'], ['1', 'Farm', '5', '99'], ['1', 'Farm', '5', '8'],
    ['1', 'Farm', '5', '8', '3'], ['2'], ['2', '99'], ['2', '8'], ['2', '8', 'x'], ['2', '8', '99999.5'], ['2', '8', '99999.5', '7'],
    ['3'], ['3', '9'], ['3', '5'], ['3', '5', 'x'], ['3', '5', '123456.78'], ['3', '5', '123456.78', '9'],
    ['5'], ['5', '99'], ['5', '98'], ['5', '98', '99'], ['5', '5'], ['4'],
  ];
  for (const p of paths) await dial(repo, MUSU, p); // dial() asserts the limit
  for (const p of [[], ['x'], ['Long Name Person', 'F'], ['Long Name Person', 'Farm', '98', '13', '9', '7']]) {
    await dial(repo, NEW_PHONE, p);
  }
  for (const p of [['2'], ['2', '9'], ['3', '9'], ['4']]) await dial(repo, JOSEPH, p);
});

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------
test('weather: county menu then a 3-day forecast', async () => {
  const repo = freshRepo();
  const r = await dial(repo, MUSU, ['5', '98', '12']);
  assert.ok(r.isEnd);
  assert.match(r.body, /^Nimba weather:\nSat: Rain 22-30C, rain 80%\nSun: Showers/);
});

test('weather: friendly message when the forecast is unavailable', async () => {
  const repo = freshRepo();
  const r = await dial(repo, MUSU, ['5', '2'], { weather: { getForecast: async () => null } });
  assert.match(r.body, /Weather is not available right now/);
});

test('weather service: Open-Meteo params, 15-minute cache, stale fallback', async () => {
  let calls = 0;
  let lastUrl = '';
  let fail = false;
  let clock = 0;
  const fetchImpl = async (url) => {
    calls++;
    lastUrl = url;
    if (fail) throw new Error('network down');
    return { ok: true, json: async () => ({ daily: {
      time: ['2026-11-21', '2026-11-22', '2026-11-23'], weather_code: [61, 80, 2],
      temperature_2m_max: [30.4, 31, 32], temperature_2m_min: [22.2, 23, 23], precipitation_probability_max: [80, 60, 20],
    } }) };
  };
  const svc = createWeatherService({ fetchImpl, now: () => clock });
  const days = await svc.getForecast('Nimba');
  assert.equal(days.length, 3);
  assert.deepEqual(days[0], { date: '2026-11-21', day: 'Sat', label: 'Rain', tMin: 22, tMax: 30, rainChance: 80 });
  assert.match(lastUrl, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.match(lastUrl, /timezone=auto/);
  assert.match(lastUrl, /latitude=6\.842&longitude=-8\.66/);

  clock = 14 * 60 * 1000;
  await svc.getForecast('Nimba');
  assert.equal(calls, 1, 'served from cache within 15 minutes');

  clock = 16 * 60 * 1000;
  fail = true;
  const stale = await svc.getForecast('Nimba');
  assert.equal(calls, 2, 'refetched after 15 minutes');
  assert.equal(stale[0].label, 'Rain', 'stale cache served when the API fails');

  assert.equal(await svc.getForecast('Bomi'), null, 'no cache and API down -> null');
  assert.equal(await svc.getForecast('Atlantis'), null);
});

// ---------------------------------------------------------------------------
// Robustness & HTTP
// ---------------------------------------------------------------------------
test('database failure ends the session with a friendly message', async () => {
  const repo = { findFarmerByPhone: async () => { throw new Error('db down'); } };
  const orig = console.error;
  console.error = () => {};
  try {
    const r = await handleUssd({ sessionId: 'x', phoneNumber: MUSU, text: '' }, { repo });
    assert.equal(r, `END ${BUSY_MESSAGE}`);
  } finally {
    console.error = orig;
  }
});

test('POST /ussd accepts an Africa\'s Talking style form payload and returns text/plain', async () => {
  const repo = freshRepo();
  const server = http.createServer(createRequestHandler({ repo, weather: fakeWeather(), pins: false }));
  await new Promise((r) => server.listen(0, r));
  const origLog = console.log;
  console.log = () => {};
  try {
    const { port } = server.address();
    const body = new URLSearchParams({ sessionId: 'AT-1', serviceCode: '*123#', phoneNumber: MUSU, text: '2*1' });
    const res = await fetch(`http://localhost:${port}/ussd`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/plain/);
    assert.match(await res.text(), /^CON Enter Rice quantity in kg:/);

    const json = await fetch(`http://localhost:${port}/ussd`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'AT-2', serviceCode: '*123#', phoneNumber: MUSU, text: '' }),
    });
    assert.match(await json.text(), /^CON FarmTori - Hi Musu/);

    const act = await (await fetch(`http://localhost:${port}/api/activity`)).json();
    assert.ok(act.items.length > 0);
    assert.ok(act.items.every((i) => ['USSD', 'App', 'Seed'].includes(i.source)));
  } finally {
    console.log = origLog;
    server.close();
  }
});

test('activity log labels USSD records after a USSD save', async () => {
  const repo = freshRepo();
  await dial(repo, MUSU, ['3', '4', '15', '1']);
  const [latest] = await repo.getRecentActivity(5);
  assert.equal(latest.source, 'USSD');
  assert.equal(latest.type, 'Expense');
  assert.equal(latest.farmer, 'Musu Kollie');
});

// ---------------------------------------------------------------------------
// Shared module (used by the app too)
// ---------------------------------------------------------------------------
test('shared: phone normalisation matches app-stored numbers', () => {
  assert.equal(shared.normalizePhone('+231-77-654-3210'), '776543210');
  assert.ok(shared.phonesMatch('+231776543210', '+231-77-654-3210'));
  assert.ok(shared.phonesMatch('0776543210', '+231-77-654-3210'));
  assert.ok(!shared.phonesMatch('+231776543211', '+231-77-654-3210'));
  assert.equal(shared.formatLiberianPhone('0881000002'), '+231-88-100-0002');
});

test('shared: harvest revenue estimate keeps the app formula', () => {
  const harvests = [
    { quantity: 100, unit: 'kg' }, // 45
    { quantity: 2, unit: 'heads' }, // 100
    { quantity: 50, unit: 'kg', total_value: 70 }, // recorded value wins
    { quantity: 3, unit: 'crates / trays', crop: { category: 'Livestock Offtake' } }, // 150
  ];
  assert.equal(shared.estimateHarvestRevenue(harvests), 45 + 100 + 70 + 150);
});

test('shared: source label falls back to the text marker when the column is missing', () => {
  assert.equal(shared.recordSource({ source: 'ussd' }), 'USSD');
  assert.equal(shared.recordSource({ description: 'Labour expense. Recorded via USSD.' }), 'USSD');
  assert.equal(shared.recordSource({ observations: 'x. Demo seed data.' }), 'Seed');
  assert.equal(shared.recordSource({ description: 'Land preparation' }), 'App');
});

// ---------------------------------------------------------------------------
// View my records (6)
// ---------------------------------------------------------------------------
test('a farm registered over USSD can be viewed over USSD on the next dial', async () => {
  const repo = freshRepo();
  const saved = await session(repo, NEW_PHONE, ['Sarah Johnson', ...CROPS_FARM('Sarah Rice Farm')], { sessionId: 'reg' });
  assert.match(saved.body, /then 6 to see it/);

  const menu = await dial(repo, NEW_PHONE, [], { sessionId: 'view' });
  assert.match(menu.body, /6\. My records/);
  assert.match((await dial(repo, NEW_PHONE, ['6'], { sessionId: 'view' })).body, /^My records:\n1\. My farms\n2\. Recent harvests\n3\. Recent expenses/);

  // One farm -> straight to its details
  const farm = await dial(repo, NEW_PHONE, ['6', '1'], { sessionId: 'view' });
  assert.ok(farm.isCon);
  assert.match(farm.body, /^Sarah Rice Farm\nNimba, Boe & Quilla\n2\.5 acres - Crops\nHarvests: 0  Spent: \$0\n1\. Harvests  2\. Expenses\n3\. Farm details/);
  assert.match((await dial(repo, NEW_PHONE, ['6', '1', '1'], { sessionId: 'view' })).body, /No harvests recorded yet/);
});

test('farmer with several farms picks one, then sees its harvests and expenses', async () => {
  const repo = freshRepo();
  assert.match((await dial(repo, JOSEPH, ['6', '1'])).body, /^My farms:\n1\. Flomo Cocoa Farm\n2\. Flomo Cassava Plot/);
  const cocoa = await dial(repo, JOSEPH, ['6', '1', '1']);
  assert.match(cocoa.body, /Flomo Cocoa Farm\nLofa, Foya\n5 acres - Crops/);
  assert.match(cocoa.body, /Harvests: 1  Spent: \$165/);
  const h = await dial(repo, JOSEPH, ['6', '1', '1', '1']);
  assert.match(h.body, /^Harvests 1-1 of 1:\n\d+ \w{3} Cocoa 620 kg/);
  assert.doesNotMatch(h.body, /Cassava/, 'only this farm');
  const e = await dial(repo, JOSEPH, ['6', '1', '1', '2']);
  assert.match(e.body, /^Expenses 1-2 of 2:/);
  assert.match(e.body, /Transport \$45/);
  assert.match(e.body, /Labour \$120/);
  // back from the list returns to the farm
  assert.match((await dial(repo, JOSEPH, ['6', '1', '1', '2', '0'])).body, /^Flomo Cocoa Farm/);
});

test('records saved over USSD show up in the lists, newest first, with paging', async () => {
  const repo = freshRepo();
  for (const [i, qty] of [10, 20, 30].entries()) {
    await session(repo, MUSU, ['2', '1', String(qty), '1'], { sessionId: `h${i}` });
  }
  await session(repo, MUSU, ['3', '4', '12', '1'], { sessionId: 'e1' });

  const p1 = await dial(repo, MUSU, ['6', '2']);
  assert.match(p1.body, /^Harvests 1-4 of 5:/);
  assert.match(p1.body, /98\. More/);
  assert.match(p1.body.split('\n')[1], /^21 Nov Rice (10|20|30) kg$/, 'today first');
  const p2 = await dial(repo, MUSU, ['6', '2', '98']);
  assert.match(p2.body, /^Harvests 5-5 of 5:/);
  assert.match((await dial(repo, MUSU, ['6', '2', '98', '0'])).body, /^Harvests 1-4 of 5:/);
  assert.match((await dial(repo, MUSU, ['6', '2', '7'])).body, /^Press 98 for more\./);

  const ex = await dial(repo, MUSU, ['6', '3']);
  assert.match(ex.body, /^Expenses 1-4 of 4:\n21 Nov Transport \$12/);
});

test('records menu needs a farm, and view screens stay within 160 characters', async () => {
  const repo = freshRepo();
  await repo.createFarmer(shared.buildFarmerRecord({ fullName: 'No Farm Yet', phone: '+231770000777', county: 'Bomi' }));
  assert.match((await dial(repo, '+231770000777', ['6'])).body, /You have no farm yet/);

  // Long names and big numbers
  const farmer = await repo.findFarmerByPhone(MUSU);
  const farm = shared.buildFarmRecord({ farmerId: farmer.id, name: 'A Very Long Farm Name Here Ok', county: 'Grand Cape Mount', size: 12345.75 });
  await repo.createFarm(farm);
  for (const crop of shared.CROPS) {
    await repo.createSeason(shared.buildSeasonRecord({ farmId: farm.id, crop }));
    await repo.createHarvest(shared.buildHarvestRecord({ farmerId: farmer.id, farmId: farm.id, crop, quantity: 123456.78 }));
  }
  await repo.createExpense(shared.buildExpenseRecord({ farmId: farm.id, category: 'Equipment Rental & Maintenance', amount: 999999.99 }));
  for (const p of [['6'], ['6', '1'], ['6', '1', '2'], ['6', '1', '2', '1'], ['6', '1', '2', '1', '98'], ['6', '1', '2', '1', '9'], ['6', '1', '2', '2'], ['6', '1', '2', '9'], ['6', '2'], ['6', '3']]) {
    await dial(repo, MUSU, p); // asserts <= 160
  }
});

// ---------------------------------------------------------------------------
// Registration helpers + database tolerance
// ---------------------------------------------------------------------------
test('registration input parsers', () => {
  assert.deepEqual(parseMulti('1,3', 5), [0, 2]);
  assert.deepEqual(parseMulti('3 1 1', 5), [0, 2]);
  assert.deepEqual(parseMulti('10', 10), [9]);
  assert.equal(parseMulti('1,6', 5), null);
  assert.equal(parseMulti('a', 5), null);
  assert.equal(parseMulti('', 5), null);
  const now = new Date('2026-11-21T10:00:00Z');
  assert.equal(parseDate('15032026', now), '2026-03-15');
  assert.equal(parseDate('15/03/2026', now), '2026-03-15');
  assert.equal(parseDate('31022026', now), null, 'no such day');
  assert.equal(parseDate('22112026', now), null, 'future');
  assert.equal(parseDate('15031980', now), null, 'too old');
  assert.equal(parseText('10x4 m'), '10x4 m');
  assert.equal(parseText('<script>'), null);
});

test('saving a farm still works when the database has not got the newer columns yet', async () => {
  const calls = [];
  const missing = new Set(['farming_type', 'livestock_details', 'registration_date', 'county_id']);
  const client = {
    from: (table) => ({
      upsert: async (rows) => {
        calls.push({ table, rows });
        const bad = Object.keys(rows[0]).find((k) => missing.has(k));
        if (bad && bad === 'county_id') return { error: { message: 'insert or update on table "farms" violates foreign key constraint "farms_county_id_fkey"' } };
        if (bad) return { error: { message: `Could not find the '${bad}' column of '${table}' in the schema cache` } };
        return { error: null };
      },
    }),
  };
  const repo = createSupabaseRepository({ client });
  const farm = shared.buildFarmRecord({ farmerId: 'f1', name: 'Test', county: 'Nimba', countyId: 'c1', crops: ['Rice'] });
  const saved = await repo.createFarm(farm);
  const last = calls.at(-1).rows[0];
  for (const col of missing) assert.ok(!(col in last), `${col} dropped`);
  assert.equal(last.source, 'ussd');
  assert.equal(last.ownership_type, 'Family Customary Land', 'columns that exist are kept');
  assert.equal(saved.name, 'Test');
  assert.deepEqual(repo.skippedColumns().farms.sort(), [...missing].sort());

  // A genuine error is still reported, not swallowed.
  const broken = createSupabaseRepository({ client: { from: () => ({ upsert: async () => ({ error: { message: 'permission denied for table farms' } }) }) } });
  await assert.rejects(() => broken.createFarm(farm), /permission denied/);
});

test('shared: default farm descriptions match the app wording', () => {
  assert.equal(shared.describeFarm({ farmingType: 'crops', crops: [] }), 'Crops parcel cultivating crops.');
  assert.equal(
    shared.describeFarm({ farmingType: 'livestock', animals: ['Goats', 'Pigs'], headCount: 12, productionPurposes: ['Breeding'], managementSystem: 'Intensive' }),
    'Goats & Pigs holding (12 head) raised for Breeding under Intensive management.'
  );
});
