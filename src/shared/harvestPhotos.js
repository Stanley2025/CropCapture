'use strict';
/**
 * Photos of the harvested product, and the view a buyer gets of a harvest.
 *
 * What a buyer sees: the product photos, the crop and variety, the batch ID, the weight, the harvest
 * date, the district and county, the farmer's first name and the first letter of the last name, and the
 * kind and date of the farm activities. Everything is entered by the farmer. "Approved" is shown only when
 * an inspector has approved the batch in the system.
 * What a buyer never sees: phone number, exact location, money, weather notes, free-text notes, user IDs.
 */
const { generateUUID } = require('./farmRecords');

const MAX_PHOTOS_PER_HARVEST = 4;
const BUCKET = 'harvest-photos';
const PHOTO_TAGS = ['bags', 'grain', 'heap', 'field', 'other'];
const UPLOAD_STATUSES = ['pending', 'uploading', 'uploaded', 'failed'];
const MAX_LONG_SIDE = 1600;
const TARGET_BYTES = 400 * 1024;
const SERVER_LIMIT_BYTES = 1024 * 1024;
/** Farm activities shown to a buyer: those in the year before the harvest, up to the harvest date. */
const ACTIVITY_WINDOW_DAYS = 365;

/** Where the picture lives in the private bucket: {farm_id}/{harvest_id}/{photo_id}.jpg */
const photoStoragePath = (farmId, harvestId, photoId) => `${farmId}/${harvestId}/${photoId}.jpg`;

const isTag = (t) => PHOTO_TAGS.includes(t);

/**
 * A new photo, saved on the phone first. Phone-only fields (local_uri, attempts, next_attempt_at,
 * last_error) never leave the phone: toServerRow() removes them.
 */
function buildPhoto({ harvestId, farmId, localUri, tag = 'other', takenAt, width = null, height = null, sizeBytes = null, now = new Date(), id = generateUUID() }) {
  if (!harvestId) throw new Error('Harvest is required');
  if (!farmId) throw new Error('Farm is required');
  if (!localUri) throw new Error('Photo file is required');
  const ts = now.toISOString();
  return {
    id,
    harvest_id: harvestId,
    farm_id: farmId,
    storage_path: photoStoragePath(farmId, harvestId, id),
    public_url: null,
    tag: isTag(tag) ? tag : 'other',
    taken_at: takenAt || ts,
    width,
    height,
    size_bytes: sizeBytes,
    upload_status: 'pending',
    local_uri: localUri,
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  };
}

const PHONE_ONLY_FIELDS = ['local_uri', 'attempts', 'next_attempt_at', 'last_error', 'uploaded'];

/** What is sent to the server: the picture's record without the phone-only fields. */
function toServerRow(photo) {
  const row = { ...photo };
  for (const f of PHONE_ONLY_FIELDS) delete row[f];
  return row;
}

const livePhotos = (photos) => (photos || []).filter((p) => p && !p.deleted_at);

/** Can another photo be added to this harvest? */
const canAddPhoto = (photos) => livePhotos(photos).length < MAX_PHOTOS_PER_HARVEST;

/**
 * Photos beyond the limit. Two phones can each add photos offline; when they meet, the oldest 4 stay and
 * the rest are returned here (oldest first, then by id so both phones choose the same ones).
 */
function photosOverLimit(photos) {
  return livePhotos(photos)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))
    .slice(MAX_PHOTOS_PER_HARVEST);
}

// ---------------------------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------------------------

/** The resize that makes the longest side 1600 px (or none when the picture is already small). */
function planResize(width, height, maxSide = MAX_LONG_SIDE) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0)) return null;
  const longest = Math.max(w, h);
  if (longest <= maxSide) return null;
  const scale = maxSide / longest;
  return w >= h ? { width: maxSide, height: Math.round(h * scale) } : { width: Math.round(w * scale), height: maxSide };
}

const QUALITY_STEPS = [0.7, 0.6, 0.5, 0.4, 0.3];

/**
 * Encode at quality 0.7 and lower it until the file is under the target size. `encode(quality)` returns
 * { size, ...anything }. Gives up at the lowest step (the result may still be above the target; the
 * server limit is 1 MB, so the caller must check `withinServerLimit`).
 */
async function compressToTarget(encode, { targetBytes = TARGET_BYTES, qualities = QUALITY_STEPS } = {}) {
  let last = null;
  for (const quality of qualities) {
    last = { ...(await encode(quality)), quality };
    if (last.size <= targetBytes) break;
  }
  return { ...last, withinTarget: last.size <= targetBytes, withinServerLimit: last.size <= SERVER_LIMIT_BYTES };
}

/**
 * Removes location and camera information from a JPEG: the Exif block (APP1, which holds GPS), other
 * XMP data, Photoshop/IPTC data (APP13) and comments. The picture itself is not touched. Works on bytes
 * so it can run on the phone right before upload, whatever the camera wrote.
 */
function stripJpegMetadata(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input; // not a JPEG
  const out = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) break; // not at a marker: copy the rest below
    const marker = input[i + 1];
    if (marker === 0xda) break; // start of scan: the image data follows
    if (marker === 0xd9) { out.push(0xff, 0xd9); i += 2; break; }
    const len = (input[i + 2] << 8) | input[i + 3];
    if (len < 2 || i + 2 + len > input.length) break;
    // drop Exif/XMP (E1), IPTC (ED), comments (FE) and the other metadata blocks; keep JFIF (E0), colour profile (E2), Adobe (EE)
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe || (marker >= 0xe3 && marker <= 0xec) || marker === 0xef;
    if (!drop) for (let k = 0; k < 2 + len; k++) out.push(input[i + k]);
    i += 2 + len;
  }
  const head = Uint8Array.from(out);
  const result = new Uint8Array(head.length + (input.length - i));
  result.set(head, 0);
  result.set(input.subarray(i), head.length);
  return result;
}

/** True when the JPEG still holds an Exif (APP1) block. */
function hasExif(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 2; i + 4 < b.length;) {
    if (b[i] !== 0xff) return false;
    if (b[i + 1] === 0xda) return false;
    if (b[i + 1] === 0xe1) return true;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return false;
    i += 2 + len;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Upload queue
// ---------------------------------------------------------------------------------------------

/** Wait before the next try: 30 s, 1 min, 2 min ... up to 1 hour. */
const backoffMs = (attempts) => Math.min(30000 * 2 ** Math.max(0, attempts - 1), 3600000);

/**
 * What the upload queue should do with one photo right now.
 *   network: { connected: boolean, wifi: boolean }
 * Returns 'upload', 'wait_wifi', 'wait_connection', 'wait_retry' or 'skip' (already uploaded / removed).
 */
function nextUploadAction({ photo, now = Date.now(), network, wifiOnly = true }) {
  if (!photo || photo.deleted_at || photo.upload_status === 'uploaded') return 'skip';
  if (!network || !network.connected) return 'wait_connection';
  if (wifiOnly && !network.wifi) return 'wait_wifi';
  if (photo.next_attempt_at && Date.parse(photo.next_attempt_at) > now) return 'wait_retry';
  return 'upload';
}

/** The chip the farmer sees for a photo. */
function photoStatusKey(photo, { wifiOnly = true, network } = {}) {
  if (photo.upload_status === 'uploaded') return 'uploaded';
  if (photo.upload_status === 'uploading') return 'uploading';
  if (photo.upload_status === 'failed') return 'failed';
  return wifiOnly && network && network.connected && !network.wifi ? 'waitingWifi' : 'waiting';
}

/** After a restart nothing is really uploading: those photos go back to the queue. */
const resumeInterrupted = (photo) => (photo.upload_status === 'uploading' ? { ...photo, upload_status: 'pending' } : photo);

// ---------------------------------------------------------------------------------------------
// The buyer's view
// ---------------------------------------------------------------------------------------------

const dayMs = (iso) => Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`);

/** The farm activities a buyer may see for a harvest, oldest first. */
function activitiesForBuyer(activities, harvest) {
  if (!harvest || !harvest.harvest_date) return [];
  const end = dayMs(harvest.harvest_date);
  const start = end - ACTIVITY_WINDOW_DAYS * 86400000;
  return (activities || [])
    .filter((a) => a && !a.deleted_at && a.farm_id === harvest.farm_id && a.activity_date)
    .filter((a) => {
      if (harvest.season_id && a.season_id && a.season_id !== harvest.season_id) return false;
      const t = dayMs(a.activity_date);
      return Number.isFinite(t) && t >= start && t <= end;
    })
    .sort((a, b) => String(a.activity_date).localeCompare(String(b.activity_date)));
}

/** "Emmanuel G." from "Emmanuel Gaye". Only the first name and the first letter of the last name. */
function farmerLabel(fullName) {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];
  return `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}

/**
 * Everything a buyer is shown, and nothing more. Built field by field (not by copying records), so a new
 * private field added later can never leak into the buyer's view by accident. This is the phone's copy of
 * the same list the server function get_buyer_page() returns.
 */
function buildBuyerView({ harvest, farm, farmer, crop, variety, photos, activities }) {
  if (!harvest) return null;
  return {
    batchId: harvest.batch_reference || null,
    crop: (crop && crop.name) || (harvest.crop && harvest.crop.name) || null,
    variety: (variety && variety.name) || null,
    quantity: harvest.quantity === undefined ? null : harvest.quantity,
    unit: harvest.unit || null,
    harvestDate: harvest.harvest_date ? String(harvest.harvest_date).slice(0, 10) : null,
    approved: harvest.status === 'approved',
    district: farm ? farm.district || null : null,
    county: farm ? farm.county || null : null,
    farmer: farmerLabel(farmer && farmer.full_name),
    photos: livePhotos(photos)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))
      .map((p) => ({ id: p.id, tag: p.tag || 'other', url: p.local_uri || null })),
    activities: activitiesForBuyer(activities, harvest).map((a) => ({
      type: a.activity_type,
      date: String(a.activity_date).slice(0, 10),
    })),
  };
}

module.exports = {
  MAX_PHOTOS_PER_HARVEST,
  BUCKET,
  PHOTO_TAGS,
  UPLOAD_STATUSES,
  MAX_LONG_SIDE,
  TARGET_BYTES,
  SERVER_LIMIT_BYTES,
  ACTIVITY_WINDOW_DAYS,
  photoStoragePath,
  buildPhoto,
  toServerRow,
  canAddPhoto,
  photosOverLimit,
  planResize,
  compressToTarget,
  stripJpegMetadata,
  hasExif,
  backoffMs,
  nextUploadAction,
  photoStatusKey,
  resumeInterrupted,
  activitiesForBuyer,
  farmerLabel,
  buildBuyerView,
};
