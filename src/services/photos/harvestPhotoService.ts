/**
 * Photos of the harvested product, so a buyer can see them when they scan the harvest's QR code.
 *
 * Offline first: a photo is saved on the phone straight away (in the app's own folder, so the system
 * cannot clear it) and the farmer can carry on. The upload queue sends the picture file to the private
 * `harvest-photos` bucket, by default only on Wi-Fi, retrying with a growing wait. Only when the file is
 * on the server is the photo's record queued for the normal sync, so a buyer is never pointed at a
 * picture that is not there. Interrupted uploads go back to the queue when the app starts again.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDb } from '../storage/localDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { HarvestBatch, HarvestPhoto } from '../../types/database';
import {
  buildPhoto,
  canAddPhoto,
  planResize,
  compressToTarget,
  stripJpegMetadata,
  nextUploadAction,
  backoffMs,
  resumeInterrupted,
  BUCKET,
  MAX_LONG_SIDE,
  PhotoTag,
  Network as NetworkInfo,
} from '../../shared/harvestPhotos';

export type PhotoSource = 'camera' | 'library';
export type CaptureResult =
  | { ok: true; photo: HarvestPhoto }
  | { ok: false; reason: 'permission' | 'cancelled' | 'limit' | 'too_large' | 'error'; message?: string };

const MOBILE_DATA_KEY = '@farmtori_photos_allow_mobile_data';
const FOLDER = () => `${FileSystem.documentDirectory}harvest-photos/`;

/** Setting: may photos upload on mobile data? Off by default (Wi-Fi only). */
export async function getAllowMobileData(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MOBILE_DATA_KEY)) === 'true';
  } catch {
    return false;
  }
}
export async function setAllowMobileData(allow: boolean): Promise<void> {
  await AsyncStorage.setItem(MOBILE_DATA_KEY, allow ? 'true' : 'false');
}

export async function currentNetwork(): Promise<NetworkInfo> {
  try {
    const s = await Network.getNetworkStateAsync();
    const connected = Boolean(s.isConnected) && s.isInternetReachable !== false;
    const wifi = s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET;
    return { connected, wifi };
  } catch {
    return { connected: false, wifi: false };
  }
}

/** Resize to 1600 px on the long side and re-encode as JPEG, lowering quality until it is under 400 KB. */
async function compress(uri: string, width: number, height: number) {
  const resize = planResize(width, height, MAX_LONG_SIDE);
  const actions = resize ? [{ resize }] : [];
  return compressToTarget(async (quality) => {
    const out = await ImageManipulator.manipulateAsync(uri, actions, { compress: quality, format: ImageManipulator.SaveFormat.JPEG });
    const info = await FileSystem.getInfoAsync(out.uri);
    return { uri: out.uri, width: out.width, height: out.height, size: info.exists && 'size' in info ? Number(info.size) : 0 };
  });
}

/** Take (or choose) a picture of the product and save it for this harvest. */
export async function captureHarvestPhoto(
  harvest: Pick<HarvestBatch, 'id' | 'farm_id'>,
  source: PhotoSource,
  offline = false,
  tag: PhotoTag = 'other'
): Promise<CaptureResult> {
  try {
    if (!canAddPhoto(await localDb.getHarvestPhotos(harvest.id))) return { ok: false, reason: 'limit' };

    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') return { ok: false, reason: 'permission' };

    const options: ImagePicker.ImagePickerOptions = { quality: 1, allowsEditing: false, exif: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets || result.assets.length === 0) return { ok: false, reason: 'cancelled' };
    const asset = result.assets[0];

    const packed = await compress(asset.uri, asset.width, asset.height);
    if (!packed.withinServerLimit) return { ok: false, reason: 'too_large' };

    const draft = buildPhoto({
      harvestId: harvest.id,
      farmId: harvest.farm_id,
      localUri: packed.uri,
      tag,
      width: packed.width,
      height: packed.height,
      sizeBytes: packed.size,
    });
    await FileSystem.makeDirectoryAsync(FOLDER(), { intermediates: true }).catch(() => undefined);
    const kept = `${FOLDER()}${draft.id}.jpg`;
    await FileSystem.copyAsync({ from: packed.uri, to: kept });
    const photo = await localDb.saveHarvestPhoto({ ...draft, local_uri: kept }, false);
    uploadPendingHarvestPhotos(offline).catch((e) => console.warn('Photo upload waiting:', e));
    return { ok: true, photo };
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message };
  }
}

let uploading = false;
let resumed = false;

/**
 * Upload every picture that is waiting. Safe to call often: it does nothing while another run is going,
 * while offline, on mobile data when that is not allowed, or before a failed photo's wait is over.
 */
export async function uploadPendingHarvestPhotos(offline = false): Promise<number> {
  if (uploading || !isSupabaseConfigured()) return 0;
  uploading = true;
  let done = 0;
  try {
    if (!resumed) {
      // the app was closed during an upload: those photos go back to the queue
      resumed = true;
      for (const p of await localDb.getHarvestPhotos()) {
        const fixed = resumeInterrupted(p);
        if (fixed !== p) await localDb.saveHarvestPhoto(fixed, false);
      }
    }
    if (offline) return 0;
    const wifiOnly = !(await getAllowMobileData());
    const network = await currentNetwork();
    for (const photo of await localDb.getHarvestPhotos()) {
      if (!photo.local_uri) continue;
      if (nextUploadAction({ photo, network, wifiOnly }) !== 'upload') continue;
      if (await sendOne(photo)) done++;
    }
  } finally {
    uploading = false;
  }
  return done;
}

async function sendOne(photo: HarvestPhoto): Promise<boolean> {
  await localDb.saveHarvestPhoto({ ...photo, upload_status: 'uploading' }, false);
  try {
    const raw = new Uint8Array(await (await fetch(photo.local_uri as string)).arrayBuffer());
    const body = stripJpegMetadata(raw); // no location or camera data leaves the phone
    const { error } = await supabase.storage.from(BUCKET).upload(photo.storage_path, body, { contentType: 'image/jpeg', upsert: false });
    // "already exists": an earlier try got the file there before the app was closed
    if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    // The picture is on the server: now its record can be synced.
    await localDb.saveHarvestPhoto(
      { ...photo, upload_status: 'uploaded', size_bytes: body.length, attempts: 0, next_attempt_at: null, last_error: null, updated_at: new Date().toISOString() },
      true
    );
    return true;
  } catch (e) {
    const attempts = (photo.attempts || 0) + 1;
    await localDb.saveHarvestPhoto(
      {
        ...photo,
        upload_status: 'failed',
        attempts,
        next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
        last_error: (e as Error).message,
      },
      false
    );
    return false;
  }
}

/** "Retry" on a failed photo: try again now, without waiting for the backoff. */
export async function retryHarvestPhoto(photo: HarvestPhoto, offline = false): Promise<void> {
  await localDb.saveHarvestPhoto({ ...photo, upload_status: 'pending', attempts: 0, next_attempt_at: null }, false);
  await uploadPendingHarvestPhotos(offline);
}

/** Change the tag of a photo; a photo already on the server is queued so the server gets the new tag. */
export async function setHarvestPhotoTag(photo: HarvestPhoto, tag: PhotoTag): Promise<void> {
  await localDb.saveHarvestPhoto({ ...photo, tag, updated_at: new Date().toISOString() }, photo.upload_status === 'uploaded');
}

/**
 * Remove a picture here. If it had reached the server, a tombstone (deleted_at) is queued so the buyer
 * page stops showing it, and the stored file is removed when the app is allowed to (see the migration).
 */
export async function removeHarvestPhoto(photo: HarvestPhoto): Promise<void> {
  const wasOnServer = photo.upload_status === 'uploaded';
  await localDb.deleteHarvestPhoto(photo.id, wasOnServer);
  if (photo.local_uri) await FileSystem.deleteAsync(photo.local_uri, { idempotent: true }).catch(() => undefined);
  if (wasOnServer && isSupabaseConfigured()) {
    supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(() => undefined);
  }
}
