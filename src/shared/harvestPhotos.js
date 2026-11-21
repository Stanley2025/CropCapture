'use strict';
/**
 * Photos of the harvested product, and the view a buyer gets of a harvest.
 *
 * The buyer sees: the product photos, the crop, quantity and harvest date, the farm's name and county,
 * and what was done on the farm (the kind of activity, its date and the weather the farmer recorded).
 * The buyer never sees: the farmer's name or phone number, costs, the number of workers, or the
 * farmer's free-text notes (which could contain private details).
 */
const { generateUUID } = require('./farmRecords');
const { weatherLabel } = require('./activityWeather');

const MAX_PHOTOS_PER_HARVEST = 6;
const BUCKET = 'harvest-photos';
/** Farm activities shown to a buyer: those in the year before the harvest, up to the harvest date. */
const ACTIVITY_WINDOW_DAYS = 365;

/** Where the picture lives in the bucket. */
const photoStoragePath = (harvestId, photoId) => `${harvestId}/${photoId}.jpg`;

/** The web address of a stored picture, for the buyer. */
function publicPhotoUrl(supabaseUrl, storagePath) {
  return `${String(supabaseUrl).replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/**
 * A new photo, saved on the phone first. `uploaded` and `local_uri` only exist on the phone; the row that
 * goes to the server is made by toServerRow().
 */
function buildPhoto({ harvestId, farmId = null, localUri, now = new Date(), id = generateUUID() }) {
  if (!harvestId) throw new Error('Harvest is required');
  if (!localUri) throw new Error('Photo file is required');
  const ts = now.toISOString();
  return {
    id,
    harvest_id: harvestId,
    farm_id: farmId,
    storage_path: photoStoragePath(harvestId, id),
    public_url: null,
    local_uri: localUri,
    uploaded: false,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  };
}

/** What is sent to the server: the picture's record without the phone-only fields. */
function toServerRow(photo) {
  const { local_uri, uploaded, ...row } = photo; // eslint-disable-line no-unused-vars
  return row;
}

/** Can another photo be added to this harvest? */
const canAddPhoto = (photos) => (photos || []).filter((p) => !p.deleted_at).length < MAX_PHOTOS_PER_HARVEST;

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

/**
 * Everything a buyer is shown, and nothing more. Built field by field (not by copying records), so a new
 * private field added to the app later can never leak into the buyer's view by accident.
 */
function buildBuyerView({ harvest, farm, crop, photos, activities }) {
  if (!harvest) return null;
  return {
    batchReference: harvest.batch_reference || null,
    product: {
      crop: (crop && crop.name) || (harvest.crop && harvest.crop.name) || null,
      variety: harvest.crop_variety_id && !/^[0-9a-f]{8}-/i.test(String(harvest.crop_variety_id)) ? harvest.crop_variety_id : null,
      quantity: harvest.quantity === undefined ? null : harvest.quantity,
      unit: harvest.unit || null,
      harvestDate: harvest.harvest_date || null,
      status: harvest.status || null,
    },
    farm: farm ? { name: farm.name || null, county: farm.county || null } : null,
    photos: (photos || [])
      .filter((p) => p && !p.deleted_at && p.public_url)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((p) => ({ id: p.id, url: p.public_url })),
    activities: activitiesForBuyer(activities, harvest).map((a) => ({
      id: a.id,
      date: String(a.activity_date).slice(0, 10),
      type: a.activity_type,
      weather: weatherLabel(a),
    })),
  };
}

module.exports = {
  MAX_PHOTOS_PER_HARVEST,
  BUCKET,
  ACTIVITY_WINDOW_DAYS,
  photoStoragePath,
  publicPhotoUrl,
  buildPhoto,
  toServerRow,
  canAddPhoto,
  activitiesForBuyer,
  buildBuyerView,
};
