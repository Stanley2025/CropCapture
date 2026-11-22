const test = require('node:test');
const assert = require('node:assert/strict');
const { handleUssd, MAX_SCREEN_CHARS } = require('../server/ussd/menu');
const { createMemoryRepository } = require('../server/ussd/repository');
const { createLogSender } = require('../server/ussd/sms');
const { buildDemoRows } = require('../server/ussd/demoData');
const { hashPin, verifyPin, weakPinReason, lockMinutesLeft } = require('../server/ussd/pin');

let NOW = new Date('2026-11-21T10:00:00Z');
const PHONE = '+231771000009'; // not registered
const MUSU = '+231771000001'; // registered by the sample data, no PIN yet
const emptyRepo = () => createMemoryRepository({ farmers: [], farms: [], farm_seasons: [], harvest_batches: [], expenses: [], quality_inspections: [] });
const dial = async (repo, phone, inputs, extra = {}) => {
  const reply = await handleUssd(
    { sessionId: extra.sessionId || 's1', serviceCode: '*000#', phoneNumber: phone, text: inputs.join('*') },
    { repo, weather: { getForecast: async () => [] }, now: () => NOW, pins: true, sms: extra.sms }
  );
  assert.match(reply, /^(CON|END) /);
  assert.ok(reply.length - 4 <= MAX_SCREEN_CHARS, `too long (${reply.length - 4}): ${reply}`);
  return reply;
};

// every answer for creating an account: name, DOB, gender, county (12 = Nimba), town, PIN, PIN again, create
const ACCOUNT = ['Sarah Johnson', '15031985', '2', '12', 'Gbehley', '7392', '7392', '1'];

test('a new phone is asked to create an account first, with the details the app asks for', async () => {
  const repo = emptyRepo();
  assert.match(await dial(repo, PHONE, []), /^CON Welcome to FarmTori!\nCreate your account\.\nEnter your full name:/);
  assert.match(await dial(repo, PHONE, ['Sarah Johnson']), /^CON Date of birth/);
  assert.match(await dial(repo, PHONE, ['Sarah Johnson', '15031985']), /^CON Gender:/);
  assert.match(await dial(repo, PHONE, ['Sarah Johnson', '15031985', '2']), /^CON Which county/);
  assert.match(await dial(repo, PHONE, ['Sarah Johnson', '15031985', '2', '12']), /^CON Enter your community or town:/);
  assert.match(await dial(repo, PHONE, ['Sarah Johnson', '15031985', '2', '12', 'Gbehley']), /^CON Create a 4-digit PIN/);
  assert.match(await dial(repo, PHONE, ACCOUNT.slice(0, 6)), /^CON Enter the PIN again/);
  assert.match(await dial(repo, PHONE, ACCOUNT.slice(0, 7)), /^CON Create account\?\nSarah Johnson\nGbehley, Nimba\n1\. Create\n2\. Cancel/);
});

test('creating the account saves the farmer and the PIN hash, sends an SMS, and never stores the PIN digits', async () => {
  const repo = emptyRepo();
  const sms = createLogSender();
  const reply = await dial(repo, PHONE, ACCOUNT, { sms });
  assert.match(reply, /^END Account created!\nFarmer ID: \d{6}\nDial \*000# and enter your PIN to register your farm\.\nSMS sent\.$/);

  const farmer = await repo.findFarmerByPhone(PHONE);
  assert.deepEqual([farmer.full_name, farmer.gender, farmer.date_of_birth, farmer.county, farmer.community, farmer.source], ['Sarah Johnson', 'Female', '1985-03-15', 'Nimba', 'Gbehley', 'ussd']);
  const cred = await repo.getPin(farmer.id);
  assert.match(cred.pin_hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.ok(!JSON.stringify(repo.db).includes('7392'), 'the PIN digits are nowhere in the data');
  assert.ok(sms.messagesFor(PHONE)[0].text.includes(`Farmer ID: ${farmer.farmer_id_code}`));
  assert.ok(!sms.messagesFor(PHONE)[0].text.includes('7392'), 'the SMS never contains the PIN');
});

test('the PIN is checked on every dial, before any screen or record is shown', async () => {
  const repo = emptyRepo();
  await dial(repo, PHONE, ACCOUNT);
  assert.match(await dial(repo, PHONE, []), /^CON FarmTori - Hi Sarah\nEnter your 4-digit PIN:/);
  assert.match(await dial(repo, PHONE, ['abcd']), /^CON FarmTori - Hi Sarah\nEnter 4 digits\.\nEnter your 4-digit PIN:/);
  assert.match(await dial(repo, PHONE, ['7392']), /^CON FarmTori - Hi Sarah\n1\. Register farm/);
  // later screens carry the PIN as the first answer
  assert.match(await dial(repo, PHONE, ['7392', '6']), /You have no farm/);
  assert.match(await dial(repo, PHONE, ['7392', '1']), /^CON Enter farm name/);
});

test('a wrong PIN ends the session and counts; three wrong PINs lock the account for 30 minutes', async () => {
  const repo = emptyRepo();
  await dial(repo, PHONE, ACCOUNT);
  assert.match(await dial(repo, PHONE, ['1111']), /^END Wrong PIN\. 2 tries left\.$/);
  assert.match(await dial(repo, PHONE, ['2222']), /^END Wrong PIN\. 1 try left\.$/);
  assert.match(await dial(repo, PHONE, ['3333']), /^END Wrong PIN\.\nYour account is locked for 30 minutes\.$/);
  // even the right PIN is refused while locked, and nothing else is shown
  assert.match(await dial(repo, PHONE, ['7392']), /^END Too many wrong PINs\.\nTry again in 30 min\.$/);
  const before = NOW;
  NOW = new Date(before.getTime() + 31 * 60000);
  assert.match(await dial(repo, PHONE, ['7392']), /^CON FarmTori - Hi Sarah\n1\. Register farm/, 'after the lock runs out the right PIN works');
  NOW = before;
});

test('a right PIN clears earlier wrong tries', async () => {
  const repo = emptyRepo();
  await dial(repo, PHONE, ACCOUNT);
  await dial(repo, PHONE, ['1111']);
  await dial(repo, PHONE, ['2222']);
  assert.match(await dial(repo, PHONE, ['7392']), /^CON FarmTori - Hi Sarah/);
  assert.match(await dial(repo, PHONE, ['9999']), /^END Wrong PIN\. 2 tries left\.$/, 'the count started again from zero');
});

test('another farmer\'s PIN does not open this account', async () => {
  const repo = emptyRepo();
  await dial(repo, PHONE, ACCOUNT);
  const OTHER = '+231771000010';
  await dial(repo, OTHER, ['Peter Doe', '01011990', '1', '12', 'Sanniquellie', '8264', '8264', '1']);
  assert.match(await dial(repo, PHONE, ['8264']), /^END Wrong PIN/);
  assert.match(await dial(repo, OTHER, ['8264']), /^CON FarmTori - Hi Peter/);
});

test('PIN and account answers are checked: weak PINs, mismatches, impossible birth dates', async () => {
  const repo = emptyRepo();
  const upTo = (n) => ACCOUNT.slice(0, n);
  for (const bad of ['0000', '1234', '4321', '9999', 'abcd', '12']) {
    const r = await dial(repo, PHONE, [...upTo(5), bad]);
    assert.ok(r.startsWith('CON '), bad);
    assert.match(r, /too easy|exactly 4/i, bad);
  }
  assert.match(await dial(repo, PHONE, [...upTo(5), '0009']), /phone number/, 'the end of the phone number');
  assert.match(await dial(repo, PHONE, [...upTo(5), '1985']), /birth year/);
  assert.match(await dial(repo, PHONE, [...upTo(6), '7391']), /^CON The PINs did not match\.\nCreate a 4-digit PIN/);
  for (const dob of ['31022000', '15032030', '15032015', '15031900', '1503', 'tomorrow']) {
    assert.match(await dial(repo, PHONE, ['Sarah Johnson', dob]), /Use DDMMYYYY/, dob);
  }
  assert.match(await dial(repo, PHONE, [...upTo(7), '2']), /^END Cancelled/);
  assert.equal(repo.db.farmers.length, 0, 'cancelling saves nothing');
});

test('a farmer who already exists but has no PIN must choose one before anything else', async () => {
  const repo = createMemoryRepository(buildDemoRows(NOW));
  assert.match(await dial(repo, MUSU, []), /^CON For your security, create a 4-digit PIN\.\nKeep it secret:/);
  assert.match(await dial(repo, MUSU, ['1234']), /^CON That PIN is too easy/);
  assert.match(await dial(repo, MUSU, ['5821']), /^CON Enter the PIN again/);
  assert.match(await dial(repo, MUSU, ['5821', '5822']), /^CON The PINs did not match/);
  assert.match(await dial(repo, MUSU, ['5821', '5821']), /^END PIN saved\.\nDial \*000# and enter it to continue\.$/);
  assert.match(await dial(repo, MUSU, []), /^CON FarmTori - Hi Musu\nEnter your 4-digit PIN:/);
  assert.match(await dial(repo, MUSU, ['5821']), /^CON FarmTori - Hi Musu\n1\. Register farm/);
});

test('when PIN storage is not ready, nobody can create an account without a PIN', async () => {
  const repo = { ...emptyRepo(), pinsAvailable: async () => false };
  assert.match(await dial(repo, PHONE, []), /^END The account service is being updated/);
});

test('hashing: salted, checks digits only, and rejects tampered values', () => {
  const a = hashPin('7392');
  const b = hashPin('7392');
  assert.notEqual(a, b, 'a new salt each time');
  assert.ok(verifyPin('7392', a));
  assert.ok(!verifyPin('7393', a));
  assert.ok(!verifyPin('7392', 'scrypt$00$00'));
  assert.ok(!verifyPin('7392', 'plaintext'));
  assert.ok(!verifyPin('73920', a));
  // a server secret (pepper) changes every hash: a stolen database alone cannot be used
  const peppered = hashPin('7392', { USSD_PIN_PEPPER: 'secret' });
  assert.ok(verifyPin('7392', peppered, { USSD_PIN_PEPPER: 'secret' }));
  assert.ok(!verifyPin('7392', peppered, {}));
  assert.equal(weakPinReason('2580', {}), null);
  assert.equal(lockMinutesLeft({ locked_until: new Date(NOW.getTime() + 90000).toISOString() }, NOW), 2);
  assert.equal(lockMinutesLeft({ locked_until: null }, NOW), 0);
});
