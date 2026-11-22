'use strict';
/**
 * SMS for USSD farmers: a text message to the farmer's own phone after they register a farm, so they
 * keep their Farmer ID and know how to see their records again.
 *
 * Two senders behind one small interface, send(phone, text) -> { ok, id?, error? }:
 *   - "africastalking": the real gateway. Needs AT_USERNAME and AT_API_KEY (AT_SENDER_ID is optional,
 *     AT_SANDBOX=1 uses their test environment).
 *   - "log": no gateway configured (demo / memory mode). Messages are kept in memory and shown by the
 *     browser simulator, so a demo can show the SMS arriving.
 * A failed SMS must NEVER break the USSD answer: send() never throws.
 */

const GSM_REPLACEMENTS = [
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, '-'],
  [/•/g, '-'],
  [/…/g, '...'],
];

/** Plain characters only, so the message stays a single 160-character SMS. */
function gsmSafe(text) {
  let out = String(text || '');
  for (const [re, to] of GSM_REPLACEMENTS) out = out.replace(re, to);
  return out.replace(/[^\x20-\x7E\n]/g, '').replace(/[ \t]+/g, ' ').trim();
}

const SMS_MAX = 160;
const clamp = (text) => (text.length <= SMS_MAX ? text : `${text.slice(0, SMS_MAX - 3).trimEnd()}...`);

/**
 * The confirmation text. New farmer: includes the Farmer ID. Always: the farm, where, and how to see it.
 * Kept under 160 characters.
 */
function registrationSms({ farmerName, farmName, county, farmerId, serviceCode, isNewFarmer }) {
  const first = String(farmerName || '').trim().split(/\s+/)[0] || 'Farmer';
  const farm = gsmSafe(farmName).slice(0, 30);
  const place = gsmSafe(county);
  const idPart = isNewFarmer && farmerId ? ` Your Farmer ID: ${farmerId}.` : '';
  const text = `FarmTori: Hi ${gsmSafe(first)}, farm "${farm}"${place ? ` (${place})` : ''} is saved.${idPart} Dial ${serviceCode || '*000#'} then 6 to see your farms.`;
  return clamp(gsmSafe(text));
}

/** Sent when an account is created by USSD: the Farmer ID, and a reminder that the PIN is private. */
function accountSms({ farmerName, farmerId }) {
  const first = String(farmerName || '').trim().split(/\s+/)[0] || 'Farmer';
  return clamp(gsmSafe(`FarmTori: Welcome ${first}! Your account is created. Farmer ID: ${farmerId}. Keep your PIN secret. We never ask for it.`));
}

function toE164(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

function createLogSender() {
  const outbox = [];
  return {
    kind: 'log',
    outbox,
    async send(phone, text) {
      const message = { id: `log-${outbox.length + 1}`, to: toE164(phone), text: clamp(gsmSafe(text)), at: new Date().toISOString() };
      outbox.push(message);
      if (outbox.length > 200) outbox.shift();
      return { ok: true, id: message.id };
    },
    /** Messages sent to one phone, newest last (for the demo simulator). */
    messagesFor(phone) {
      const to = toE164(phone);
      return outbox.filter((m) => m.to === to);
    },
  };
}

function createAfricasTalkingSender({ username, apiKey, senderId, sandbox, fetchImpl = globalThis.fetch }) {
  const base = sandbox ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  return {
    kind: 'africastalking',
    async send(phone, text) {
      try {
        const body = new URLSearchParams({ username, to: toE164(phone), message: clamp(gsmSafe(text)) });
        if (senderId) body.set('from', senderId);
        const res = await fetchImpl(`${base}/version1/messaging`, {
          method: 'POST',
          headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok) return { ok: false, error: `gateway answered ${res.status}` };
        const json = await res.json().catch(() => null);
        const recipient = json && json.SMSMessageData && json.SMSMessageData.Recipients && json.SMSMessageData.Recipients[0];
        if (recipient && recipient.status && recipient.status !== 'Success') return { ok: false, error: recipient.status };
        return { ok: true, id: recipient ? recipient.messageId : undefined };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
}

/** The gateway when its keys are set, otherwise the demo "log" sender. */
function createSmsSender(env = process.env, fetchImpl) {
  if (env.AT_USERNAME && env.AT_API_KEY) {
    return createAfricasTalkingSender({ username: env.AT_USERNAME, apiKey: env.AT_API_KEY, senderId: env.AT_SENDER_ID, sandbox: env.AT_SANDBOX === '1', fetchImpl });
  }
  return createLogSender();
}

module.exports = { createSmsSender, createLogSender, createAfricasTalkingSender, registrationSms, accountSms, gsmSafe, toE164, SMS_MAX };
