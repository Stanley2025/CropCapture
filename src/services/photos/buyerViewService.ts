/**
 * What a buyer sees for a harvest. When a buyer scans the QR code inside the app, the data comes from the
 * public page's own data address (/b/{code}/data), which returns only the allowed fields with short-lived
 * photo links. The farmer's own preview, and a scan with no connection, use this phone's copy built by the
 * same allowlist (buildBuyerView).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDb } from '../storage/localDatabase';
import { findCropById } from '../../shared/farmRecords';
import { buildBuyerView, BuyerView } from '../../shared/harvestPhotos';
import { parseScanned } from '../../shared/buyerLink';
import { BUYER_BASE_URL } from '../../constants/buyerLink';

export interface BuyerData {
  view: BuyerView;
  /** "server" = what a buyer sees; "phone" = this phone's own copy (farmer preview or no connection) */
  source: 'server' | 'phone';
}

async function fromServer(code: string): Promise<BuyerData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BUYER_BASE_URL.replace(/\/+$/, '')}/b/${encodeURIComponent(code)}/data`, { signal: controller.signal });
    if (!res.ok) return null;
    return { view: (await res.json()) as BuyerView, source: 'server' };
  } finally {
    clearTimeout(timer);
  }
}

async function fromPhone(value: string): Promise<BuyerData | null> {
  const harvests = await localDb.getHarvests();
  const harvest = harvests.find((h) => h.public_code === value || h.qr_token === value || h.id === value || h.batch_reference === value);
  if (!harvest) return null;
  const [farms, farmers, photos, activities] = await Promise.all([
    localDb.getFarms(),
    localDb.getFarmers(),
    localDb.getHarvestPhotos(harvest.id),
    localDb.getActivities(undefined, [harvest.farm_id]),
  ]);
  const crop = findCropById(harvest.crop_id) || harvest.crop || null;
  const varietyName = harvest.crop_variety_id && !/^[0-9a-f]{8}-/i.test(String(harvest.crop_variety_id)) ? { name: harvest.crop_variety_id } : null;
  const view = buildBuyerView({
    harvest,
    farm: farms.find((f) => f.id === harvest.farm_id) || null,
    farmer: farmers.find((f) => f.id === harvest.farmer_id) || null,
    crop,
    variety: varietyName,
    photos,
    activities,
  });
  return view ? { view, source: 'phone' } : null;
}

/** `value` is whatever was scanned or typed: a buyer link, an old /verify/ link, a code or a batch reference. */
export async function loadBuyerData(value: string, { offline = false, preferPhone = false } = {}): Promise<BuyerData | null> {
  const scanned = parseScanned(value);
  if (!offline && !preferPhone && scanned.kind === 'code') {
    try {
      const server = await fromServer(scanned.value);
      if (server) return server;
    } catch (e) {
      console.warn('Buyer page could not be read from the server, using this phone:', (e as Error).message);
    }
  }
  return fromPhone(scanned.value);
}

// --- harvests this buyer has looked at, kept on their own phone ---------------------------------------------

const VIEWED_KEY = '@farmtori_buyer_viewed';
const MAX_VIEWED = 10;

export interface ViewedHarvest {
  /** what to open again: the code or reference that was scanned or typed */
  value: string;
  crop: string | null;
  batchId: string | null;
  place: string | null;
  viewedAt: string;
}

export async function getViewedHarvests(): Promise<ViewedHarvest[]> {
  try {
    const raw = await AsyncStorage.getItem(VIEWED_KEY);
    return raw ? (JSON.parse(raw) as ViewedHarvest[]) : [];
  } catch {
    return [];
  }
}

/** Remember a harvest the buyer opened (newest first, at most 10, no repeats). */
export async function rememberViewedHarvest(value: string, view: BuyerView): Promise<void> {
  try {
    const scanned = parseScanned(value).value;
    const entry: ViewedHarvest = {
      value: scanned,
      crop: view.crop,
      batchId: view.batchId,
      place: [view.district, view.county].filter(Boolean).join(', ') || null,
      viewedAt: new Date().toISOString(),
    };
    const rest = (await getViewedHarvests()).filter((v) => v.value !== scanned);
    await AsyncStorage.setItem(VIEWED_KEY, JSON.stringify([entry, ...rest].slice(0, MAX_VIEWED)));
  } catch {
    // remembering is a convenience; the page itself still opens
  }
}
