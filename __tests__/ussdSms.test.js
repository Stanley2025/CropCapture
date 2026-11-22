const test = require('node:test');
const assert = require('node:assert/strict');
const { registrationSms, gsmSafe, createLogSender, createSmsSender, createAfricasTalkingSender, toE164, SMS_MAX } = require('../server/ussd/sms');

test('the registration SMS: farm, place, Farmer ID for a new farmer, how to see the farms, one SMS long', () => {
  const text = registrationSms({ farmerName: 'Musu Kollie', farmName: 'Kollie Rice Farm', county: 'Bong', farmerId: '482913', serviceCode: '*000#', isNewFarmer: true });
  assert.equal(text, 'FarmTori: Hi Musu, farm "Kollie Rice Farm" (Bong) is saved. Your Farmer ID: 482913. Dial *000# then 6 to see your farms.');
  assert.ok(text.length <= SMS_MAX);
  const returning = registrationSms({ farmerName: 'Musu Kollie', farmName: 'Second Farm', county: 'Bong', farmerId: '482913', serviceCode: '*000#', isNewFarmer: false });
  assert.ok(!returning.includes('Farmer ID'), 'a returning farmer is not sent their ID again');
});

test('the SMS stays under 160 plain characters even for long or unusual names', () => {
  const text = registrationSms({ farmerName: 'Ngafua Karnley Wleh-Boakai', farmName: 'The very long and fancy name of the Farm — “quoted” • ok', county: 'Grand Cape Mount', farmerId: '123456', serviceCode: '*000#', isNewFarmer: true });
  assert.ok(text.length <= SMS_MAX, `${text.length} characters`);
  assert.ok(/^[\x20-\x7E]+$/.test(text), 'plain characters only');
  assert.equal(gsmSafe('café — “x”'), 'caf - "x"');
});

test('with no gateway keys the demo sender keeps the message so the simulator can show it', async () => {
  const sender = createSmsSender({});
  assert.equal(sender.kind, 'log');
  const r = await sender.send('231771000001', 'FarmTori: hello');
  assert.equal(r.ok, true);
  assert.deepEqual(sender.messagesFor('+231 77 100 0001').map((m) => m.text), ['FarmTori: hello'], 'the same number, written another way');
  assert.deepEqual(sender.messagesFor('+231771000002'), [], 'another phone sees nothing');
  assert.deepEqual(sender.messagesFor('+231771000001').map((m) => m.text), ['FarmTori: hello']);
  assert.equal(toE164('231-77-100-0001'), '+231771000001');
});

test('with gateway keys the real sender posts to Africa\'s Talking, and a failure never throws', async () => {
  const calls = [];
  const ok = createAfricasTalkingSender({
    username: 'farmtori', apiKey: 'KEY', senderId: 'FarmTori', sandbox: false,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201, json: async () => ({ SMSMessageData: { Recipients: [{ status: 'Success', messageId: 'ATXid_1' }] } }) }; },
  });
  const r = await ok.send('231771000001', 'FarmTori: hi');
  assert.deepEqual(r, { ok: true, id: 'ATXid_1' });
  assert.equal(calls[0].url, 'https://api.africastalking.com/version1/messaging');
  assert.equal(calls[0].init.headers.apiKey, 'KEY');
  const body = new URLSearchParams(calls[0].init.body);
  assert.deepEqual([body.get('username'), body.get('to'), body.get('message'), body.get('from')], ['farmtori', '+231771000001', 'FarmTori: hi', 'FarmTori']);

  const down = createAfricasTalkingSender({ username: 'u', apiKey: 'k', fetchImpl: async () => { throw new Error('network down'); } });
  assert.deepEqual(await down.send('231771000001', 'x'), { ok: false, error: 'network down' });
  const refused = createAfricasTalkingSender({ username: 'u', apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.equal((await refused.send('231771000001', 'x')).ok, false);
  const rejected = createAfricasTalkingSender({ username: 'u', apiKey: 'k', fetchImpl: async () => ({ ok: true, status: 201, json: async () => ({ SMSMessageData: { Recipients: [{ status: 'InvalidPhoneNumber' }] } }) }) });
  assert.deepEqual(await rejected.send('1', 'x'), { ok: false, error: 'InvalidPhoneNumber' });

  const sandbox = createSmsSender({ AT_USERNAME: 'sandbox', AT_API_KEY: 'k', AT_SANDBOX: '1' });
  assert.equal(sandbox.kind, 'africastalking');
});

// ---- the SMS after registration, through the real USSD flow -----------------------------------------
const { handleUssd } = require('../server/ussd/menu');
const { createMemoryRepository } = require('../server/ussd/repository');
const { buildDemoRows } = require('../server/ussd/demoData');
const NOW = new Date('2026-11-21T10:00:00Z');
const NEW_PHONE = '+231771000009';

const INPUTS = ['Sarah Johnson', 'Sarah Rice Farm', '1', '98', '12', '1', 'Gbehley', '2.5', '1', '1', '1', '2', '1,2', '1', '1'];
const dialAll = (deps, phone = NEW_PHONE, inputs = INPUTS, sessionId = 's1') =>
  handleUssd({ sessionId, serviceCode: '*000#', phoneNumber: phone, text: inputs.join('*') }, { weather: { getForecast: async () => [] }, now: () => NOW, ...deps });
const freshRepo = () => createMemoryRepository(buildDemoRows(NOW));

test('registering a farm by USSD sends the farmer one SMS and tells them on the phone', async () => {
  const repo = freshRepo();
  const sms = createLogSender();
  const reply = await dialAll({ repo, sms });
  assert.match(reply, /^END Welcome Sarah! Farm "Sarah Rice Farm" saved/);
  assert.match(reply, /SMS sent\.$/);
  const farmer = await repo.findFarmerByPhone(NEW_PHONE);
  const [message] = sms.messagesFor(NEW_PHONE);
  assert.equal(sms.outbox.length, 1);
  assert.ok(message.text.includes('"Sarah Rice Farm"'));
  assert.ok(message.text.includes(`Your Farmer ID: ${farmer.farmer_id_code}`));
  assert.ok(message.text.length <= SMS_MAX);
  assert.ok(reply.length - 4 <= 182, 'the USSD screen is still short enough');
});

test('the gateway repeating the same request does not send a second SMS', async () => {
  const repo = freshRepo();
  const sms = createLogSender();
  await dialAll({ repo, sms });
  await dialAll({ repo, sms });
  await dialAll({ repo, sms });
  assert.equal(sms.outbox.length, 1);
});

test('a returning farmer registering another farm gets an SMS without the Farmer ID again', async () => {
  const repo = freshRepo();
  const sms = createLogSender();
  const MUSU = '+231771000001'; // already registered, 1 farm
  const reply = await dialAll({ repo, sms }, MUSU, ['1', 'Second Farm', '1', '98', '12', '1', 'Gbehley', '2.5', '1', '1', '1', '2', '1,2', '1', '1'], 's3');
  assert.match(reply, /^END Farm saved!/);
  assert.match(reply, /SMS sent\.$/);
  const [message] = sms.messagesFor(MUSU);
  assert.equal(sms.outbox.length, 1);
  assert.ok(message.text.includes('"Second Farm"') && !message.text.includes('Farmer ID'));
});

test('if the SMS cannot be sent, the farm is still saved and the farmer is not told an SMS was sent', async () => {
  const repo = freshRepo();
  const reply = await dialAll({ repo, sms: { kind: 'x', send: async () => ({ ok: false, error: 'gateway down' }) } });
  assert.match(reply, /^END Welcome Sarah! Farm "Sarah Rice Farm" saved/);
  assert.ok(!/SMS sent/.test(reply));
  assert.equal((await repo.getFarms((await repo.findFarmerByPhone(NEW_PHONE)).id)).length, 1);
});

test('with no SMS sender at all the registration answer is unchanged', async () => {
  const repo = freshRepo();
  const reply = await dialAll({ repo });
  assert.ok(!/SMS sent/.test(reply));
  assert.match(reply, /Dial \*000#, then 6 to see it\.$/);
});
