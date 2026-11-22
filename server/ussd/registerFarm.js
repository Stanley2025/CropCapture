'use strict';
/**
 * USSD "Register farm" flow. Collects the SAME information as the mobile app's
 * Register Farm screen (app/farm/register.tsx), and builds the database row with the
 * SAME shared builder (src/shared/farmRecords.js), so a farm registered over USSD is
 * indistinguishable from one registered in the app.
 *
 *   Farm name -> farm type (crops / livestock / both) -> county -> district -> community
 *   -> size + unit -> land ownership -> soil -> irrigation
 *   -> [crops grown]                                         (crops or both)
 *   -> [animals, breed, head count, purpose, management, housing (+size, capacity),
 *       grazing (+arrangement, area), water source, feeding]  (livestock or both)
 *   -> registration date -> confirm
 *
 * Every screen is 160 characters or fewer; long option names use the short labels from
 * shared FARM_OPTIONS (the full value is what gets stored).
 */
const shared = require('../../src/shared/farmRecords');
const geo = require('./geo');
const { registrationSms } = require('./sms');

const { CROPS, LIBERIA_COUNTIES, FARM_OPTIONS, USSD_TAG } = shared;

const labels = (opts) => opts.map((o) => o.label);
const labelOf = (opts, value) => {
  const o = opts.find((x) => x.value === value);
  return o ? o.label : value;
};
const cropById = (id) => CROPS.find((c) => c.id === id);

// --- input parsing ---------------------------------------------------------
/** Free text such as "10 x 4 m" or "2 acres": letters or digits, light punctuation, max 30. */
function parseText(input, max = 30) {
  const s = String(input).replace(/\s+/g, ' ').trim();
  if (s.length < 1 || s.length > max) return null;
  if (!/[A-Za-z0-9]/.test(s) || !/^[A-Za-z0-9 .,'\/#()&x-]+$/.test(s)) return null;
  return s;
}

/** Whole number 1..999999. */
function parseWhole(input) {
  const s = String(input).replace(/,/g, '').trim();
  return /^\d{1,6}$/.test(s) && Number(s) > 0 ? Number(s) : null;
}

/** DDMMYYYY (separators optional), a real date, not in the future. Returns YYYY-MM-DD. */
function parseDate(input, now) {
  const m = String(input).trim().match(/^(\d{2})[-/.]?(\d{2})[-/.]?(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (y < 1990 || date.getTime() > now.getTime() + 86400000) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "1,3" or "1 3" -> [0, 2] (zero-based, unique, sorted) or null. */
function parseMulti(input, count) {
  const tokens = String(input).split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const picked = new Set();
  for (const t of tokens) {
    if (!/^\d{1,2}$/.test(t)) return null;
    const i = Number(t) - 1;
    if (i < 0 || i >= count) return null;
    picked.add(i);
  }
  return [...picked].sort((a, b) => a - b);
}

function createRegistration(h) {
  const { go, end, err, short, numbered, pickIndex, parseName, parseAmount, firstName, fmtNum, stableId, MORE } = h;

  const hasCrops = (d) => d.farmingType !== 'livestock';
  const hasLivestock = (d) => d.farmingType !== 'crops';

  // --- screen builders -------------------------------------------------------
  /** Single choice with paging (98 = More). onPick(index, data, ctx) -> go() result. */
  function choice({ title, items, pageSize = 8, onPick }) {
    const text = (ctx, data) => (typeof title === 'function' ? title(ctx, data) : title);
    return {
      prompt: (ctx, data) => {
        const all = items(ctx, data);
        const start = (data.page || 0) * pageSize;
        const rows = all.slice(start, start + pageSize).map((r) => short(r, 26));
        const more = start + pageSize < all.length ? `\n${MORE}. More` : '';
        return `${text(ctx, data)}\n${numbered(rows, start + 1)}${more}`;
      },
      handle: (input, ctx, data) => {
        const all = items(ctx, data);
        const page = data.page || 0;
        if (input === MORE && (page + 1) * pageSize < all.length) return go(null, { ...data, page: page + 1 });
        const i = pickIndex(input, all.length);
        if (i < 0) return err('Invalid choice.');
        const { page: _p, ...rest } = data;
        return onPick(i, rest, ctx);
      },
    };
  }

  /** Several choices at once, typed like "1,3". onPick(indexes, data) -> go() result. */
  function multi({ title, items, onPick }) {
    return {
      prompt: () => `${title}\n${numbered(items())}`,
      handle: (input, ctx, data) => {
        const picked = parseMulti(input, items().length);
        return picked ? onPick(picked, data) : err('Type numbers like 1,3.');
      },
    };
  }

  const yesNo = (title, onPick) =>
    choice({ title, items: () => ['Yes', 'No'], onPick: (i, d) => onPick(i === 0, d) });

  /** Free-text / number entry. parse(input, ctx) -> value | null. */
  function entry({ prompt, parse, error, onValue }) {
    return {
      prompt: typeof prompt === 'function' ? prompt : () => prompt,
      handle: (input, ctx, data) => {
        const value = parse(input, ctx);
        return value == null ? err(error) : onValue(value, data);
      },
    };
  }

  const pickFrom = (opts) => ({ title, key, next, pageSize }) =>
    choice({
      title,
      pageSize,
      items: () => labels(opts),
      onPick: (i, d, ctx) => go(typeof next === 'function' ? next(d, ctx) : next, { ...d, [key]: opts[i].value, page: 0 }),
    });

  // --- screens -----------------------------------------------------------------
  const afterIrrigation = (d) => (hasCrops(d) ? 'f_crops' : 'l_animals');

  const screens = {
    f_name: {
      prompt: (ctx, data) => (data.fullName ? `Hi ${firstName(data.fullName)}! Enter your farm name:` : 'Enter farm name:'),
      handle: (input, ctx, data) => {
        const farmName = parseName(input, 30);
        return farmName ? go('f_type', { ...data, farmName }) : err('Please enter a farm name.');
      },
    },

    f_type: pickFrom(FARM_OPTIONS.farmingTypes)({ title: 'What do you farm?', key: 'farmingType', next: 'f_county' }),

    f_county: choice({
      title: 'Select county:',
      items: () => LIBERIA_COUNTIES.map((c) => c.name),
      onPick: (i, d) => go('f_district', { ...d, county: LIBERIA_COUNTIES[i].name, page: 0 }),
    }),

    f_district: choice({
      title: (ctx, d) => `${short(d.county, 18)} district:`,
      pageSize: 6,
      items: (ctx, d) => geo.getDistricts(d.county).map((x) => x.name),
      onPick: (i, d) => {
        const district = geo.getDistricts(d.county)[i];
        return go('f_community', { ...d, district: district.name, districtId: district.id });
      },
    }),

    f_community: entry({
      prompt: 'Enter your community or town:',
      parse: (input) => parseName(input, 40),
      error: 'Please enter a community or town.',
      onValue: (community, d) => go('f_size', { ...d, community }),
    }),

    f_size: entry({
      prompt: 'Enter farm size (number):',
      parse: parseAmount,
      error: 'Enter a number, e.g. 2.5.',
      onValue: (size, d) => go('f_unit', { ...d, size }),
    }),

    f_unit: pickFrom(FARM_OPTIONS.sizeUnits)({ title: 'Size is in:', key: 'sizeUnit', next: 'f_tenure' }),
    f_tenure: pickFrom(FARM_OPTIONS.tenureTypes)({ title: 'Land ownership:', key: 'tenure', next: 'f_soil' }),
    f_soil: pickFrom(FARM_OPTIONS.soilTypes)({ title: 'Soil type:', key: 'soil', next: 'f_irrig' }),
    f_irrig: yesNo('Irrigation or water control?', (yes, d) => go(afterIrrigation(d), { ...d, irrigation: yes })),

    f_crops: multi({
      title: 'Crops you grow? e.g. 1,2',
      items: () => CROPS.map((c) => c.name),
      onPick: (picked, d) => go(hasLivestock(d) ? 'l_animals' : 'f_date', { ...d, cropIds: picked.map((i) => CROPS[i].id) }),
    }),

    // --- livestock ---
    l_animals: multi({
      title: 'Animals you keep? e.g. 1,4',
      items: () => labels(FARM_OPTIONS.animals),
      onPick: (picked, d) => go('l_breed', { ...d, animals: picked.map((i) => shared.LIVESTOCK_ANIMALS[i].label) }),
    }),
    l_breed: {
      // One animal: show its common breed. Several: the common breed of each is used.
      prompt: (ctx, d) =>
        `Breed:\n1. ${(d.animals || []).length === 1 ? short(defaultBreed(d), 36) : 'Common breed of each'}\n2. Type my own`,
      handle: (input, ctx, d) => {
        if (input === '1') return go('l_count', { ...d, breed: defaultBreed(d) });
        if (input === '2') return go('l_breed_text', d);
        return err('Invalid choice.');
      },
    },
    l_breed_text: entry({
      prompt: 'Type the breed name:',
      parse: (input) => parseName(input, 40),
      error: 'Please enter a breed name.',
      onValue: (breed, d) => go('l_count', { ...d, breed }),
    }),
    l_count: entry({
      prompt: 'How many animals in total?',
      parse: parseWhole,
      error: 'Enter a whole number, e.g. 12.',
      onValue: (headCount, d) => go('l_purpose', { ...d, headCount }),
    }),
    l_purpose: multi({
      title: 'Purpose? e.g. 1,3',
      items: () => labels(FARM_OPTIONS.productionPurposes),
      onPick: (picked, d) => go('l_mgmt', { ...d, purposes: picked.map((i) => FARM_OPTIONS.productionPurposes[i].value) }),
    }),
    l_mgmt: pickFrom(FARM_OPTIONS.managementSystems)({ title: 'Management system:', key: 'mgmt', next: 'l_housing' }),
    l_housing: pickFrom(FARM_OPTIONS.housingTypes)({ title: 'Housing type:', key: 'housing', next: 'l_hq' }),
    l_hq: choice({
      title: 'Add housing size and capacity?',
      items: () => ['Yes', 'Skip'],
      onPick: (i, d) => go(i === 0 ? 'l_hsize' : 'l_grazing', d),
    }),
    l_hsize: entry({
      prompt: 'Housing size, e.g. 10x4 m:',
      parse: (input) => parseText(input, 30),
      error: 'Use letters or numbers only.',
      onValue: (housingSize, d) => go('l_hcap', { ...d, housingSize }),
    }),
    l_hcap: entry({
      prompt: 'Housing capacity (number of animals):',
      parse: parseWhole,
      error: 'Enter a whole number, e.g. 20.',
      onValue: (housingCapacity, d) => go('l_grazing', { ...d, housingCapacity }),
    }),
    l_grazing: yesNo('Grazing land available?', (yes, d) => go(yes ? 'l_garr' : 'l_water', { ...d, grazingAvailable: yes })),
    l_garr: pickFrom(FARM_OPTIONS.grazingArrangements)({ title: 'Grazing arrangement:', key: 'grazingArrangement', next: 'l_gq' }),
    l_gq: choice({
      title: 'Add the grazing area?',
      items: () => ['Yes', 'Skip'],
      onPick: (i, d) => go(i === 0 ? 'l_garea' : 'l_water', d),
    }),
    l_garea: entry({
      prompt: 'Grazing area, e.g. 2 acres:',
      parse: (input) => parseText(input, 30),
      error: 'Use letters or numbers only.',
      onValue: (grazingArea, d) => go('l_water', { ...d, grazingArea }),
    }),
    l_water: pickFrom(FARM_OPTIONS.waterSources)({ title: 'Water source:', key: 'water', next: 'l_feed' }),
    l_feed: pickFrom(FARM_OPTIONS.feedingSystems)({ title: 'Feeding system:', key: 'feeding', next: 'f_date' }),

    // --- registration date + confirm ---
    f_date: choice({
      title: 'Registration date:',
      items: () => ['Today', 'Another date'],
      onPick: (i, d) => go(i === 0 ? 'f_confirm' : 'f_date_text', i === 0 ? { ...d, registrationDate: null } : d),
    }),
    f_date_text: entry({
      prompt: 'Enter the date as DDMMYYYY:',
      parse: (input, ctx) => parseDate(input, ctx.now),
      error: 'Use DDMMYYYY, e.g. 15032026.',
      onValue: (registrationDate, d) => go('f_confirm', { ...d, registrationDate }),
    }),
    f_confirm: {
      prompt: (ctx, d) => {
        const type = labelOf(FARM_OPTIONS.farmingTypes, d.farmingType);
        const what = [
          hasCrops(d) && d.cropIds ? d.cropIds.map((id) => cropById(id).name).join(', ') : null,
          hasLivestock(d) && d.animals ? `${d.animals.join(', ')} (${d.headCount})` : null,
        ].filter(Boolean).join(' + ');
        return [
          'Save this farm?',
          `${short(d.farmName, 30)} - ${type}`,
          `${short(d.district, 20)}, ${d.county}`,
          `${fmtNum(d.size)} ${labelOf(FARM_OPTIONS.sizeUnits, d.sizeUnit)}`,
          short(what, 34),
          '1. Save  2. Cancel',
        ].join('\n');
      },
      handle: (input, ctx, d) =>
        input === '1' ? end('save_farm', d) : input === '2' ? end('cancel', {}) : err('Press 1 to save or 2 to cancel.'),
    },
  };

  function defaultBreed(d) {
    return (d.animals || [])
      .map((a) => (shared.LIVESTOCK_ANIMALS.find((x) => x.label === a) || {}).defaultBreed)
      .filter(Boolean)
      .join(', ');
  }

  // --- save ----------------------------------------------------------------------
  async function save(data, ctx, { repo, sms }) {
    const countyRec = geo.getCountyRecord(data.county);
    const crops = hasCrops(data) ? (data.cropIds || []).map(cropById).filter(Boolean) : [];
    const livestockDetails = hasLivestock(data)
      ? shared.buildLivestockDetails({
          animals: data.animals,
          breed: data.breed,
          headCount: data.headCount,
          productionPurposes: data.purposes,
          managementSystem: data.mgmt,
          housingType: data.housing,
          housingSize: data.housingSize,
          housingCapacity: data.housingCapacity,
          grazingAvailable: Boolean(data.grazingAvailable),
          grazingArrangement: data.grazingArrangement,
          grazingArea: data.grazingArea,
          waterSource: data.water,
          feedingSystem: data.feeding,
        })
      : null;

    let farmer = ctx.farmer;
    let isNewFarmer = false;
    if (!farmer) {
      farmer = {
        ...shared.buildFarmerRecord({
          fullName: data.fullName,
          phone: ctx.phone,
          county: data.county,
          district: data.district,
          community: data.community,
          now: ctx.now,
        }),
        id: stableId(ctx, 'farmer'),
      };
      farmer = await repo.createFarmer(farmer);
      isNewFarmer = true;
    }

    const record = shared.buildFarmRecord({
      farmerId: farmer.id,
      name: data.farmName,
      farmingType: data.farmingType,
      livestockDetails,
      county: data.county,
      district: data.district,
      countyId: countyRec ? countyRec.id : null,
      districtId: data.districtId || null,
      community: data.community,
      size: data.size,
      sizeUnit: data.sizeUnit,
      ownershipType: data.tenure,
      irrigation: data.irrigation,
      soilType: data.soil,
      crops: crops.map((c) => c.name),
      registrationDate: data.registrationDate || undefined,
      now: ctx.now,
    });
    // The aggregator may repeat a request. The farm id is the same each time, so a repeat saves nothing new,
    // and then no second SMS is sent either.
    const farmId = stableId(ctx, 'farm');
    const alreadySaved = !isNewFarmer && (await repo.getFarms(farmer.id)).some((f) => f.id === farmId);
    const farm = await repo.createFarm({ ...record, id: farmId, description: `${record.description} ${USSD_TAG}.` });

    // One active season per crop, so harvests recorded later are linked to the crop.
    for (const crop of crops) {
      await repo.createSeason({
        ...shared.buildSeasonRecord({ farmId: farm.id, crop, cultivatedArea: farm.size, now: ctx.now }),
        id: stableId(ctx, `season-${crop.id}`),
      });
    }

    // SMS confirmation to the farmer's own phone. A failed SMS never changes the answer on the phone.
    let smsNote = '';
    if (sms && !alreadySaved) {
      const sent = await sms.send(
        ctx.phone,
        registrationSms({ farmerName: farmer.full_name, farmName: farm.name, county: farm.county, farmerId: farmer.farmer_id_code, serviceCode: ctx.serviceCode, isNewFarmer })
      );
      if (sent.ok) smsNote = '\nSMS sent.';
      else console.warn('[ussd] SMS not sent:', sent.error);
    }

    if (isNewFarmer) {
      return `Welcome ${firstName(farmer.full_name)}! Farm "${short(farm.name, 30)}" saved.\nYour Farm ID: ${farmer.farmer_id_code}\nDial ${ctx.serviceCode}, then 6 to see it.${smsNote}`;
    }
    return `Farm saved!\n${short(farm.name, 30)}\n${short(farm.district, 20)}, ${farm.county}\nTo see your farms: dial ${ctx.serviceCode}, then 6.${smsNote}`;
  }

  return { screens, save };
}

module.exports = { createRegistration, parseText, parseWhole, parseDate, parseMulti, labelOf };
