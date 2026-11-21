/**
 * Photos of the harvested product, so a buyer can see them on the harvest's QR passport.
 *
 * Offline first: a photo is saved on the phone straight away (in the app's own folder, so the system
 * cannot clear it). When there is a connection the picture file is uploaded to the `harvest-photos`
 * bucket, and only THEN is the photo's record queued for the normal sync, so a buyer is never shown a
 * picture that is not there yet.
 */
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { localDb } from '../storage/localDatabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { HarvestBatch, HarvestPhoto } from '../../types/database';
import { buildPhoto, canAddPhoto, publicPhotoUrl, BUCKET } from '../../shared/harvestPhotos';

export type PhotoSource = 'camera' | 'library';
export type CaptureResult = { ok: true; photo: HarvestPhoto } | { ok: false; reason: 'permission' | 'cancelled' | 'limit' | 'error'; message?: string };

const FOLDER = () => `${FileSystem.documentDirectory}harvest-photos/`;

async function keepOnPhone(pickedUri: string, photoId: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(FOLDER(), { intermediates: true }).catch(() => undefined);
  const target = `${FOLDER()}${photoId}.jpg`;
  await FileSystem.copyAsync({ from: pickedUri, to: target });
  return target;
}

/** Take (or choose) a picture of the product and save it for this harvest. */
export async function captureHarvestPhoto(harvest: Pick<HarvestBatch, 'id' | 'farm_id'>, source: PhotoSource, offline = false): Promise<CaptureResult> {
  try {
    if (!canAddPhoto(await localDb.getHarvestPhotos(harvest.id))) return { ok: false, reason: 'limit' };

    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') return { ok: false, reason: 'permission' };

    const options: ImagePicker.ImagePickerOptions = { quality: 0.6, allowsEditing: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets || result.assets.length === 0) return { ok: false, reason: 'cancelled' };

    const draft = buildPhoto({ harvestId: harvest.id, farmId: harvest.farm_id, localUri: result.assets[0].uri });
    const kept = await keepOnPhone(result.assets[0].uri, draft.id);
    const photo = await localDb.saveHarvestPhoto({ ...draft, local_uri: kept }, false);
    uploadPendingHarvestPhotos(offline).catch((e) => console.warn('Photo upload waiting:', e));
    return { ok: true, photo };
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message };
  }
}

let uploading = false;

/** Upload every picture that has not reached the server yet. Safe to call often; does nothing offline. */
export async function uploadPendingHarvestPhotos(offline = false): Promise<number> {
  if (offline || uploading || !isSupabaseConfigured()) return 0;
  uploading = true;
  let done = 0;
  try {
    const waiting = (await localDb.getHarvestPhotos()).filter((p) => !p.uploaded && p.local_uri);
    for (const photo of waiting) {
      try {
        const body = await (await fetch(photo.local_uri as string)).arrayBuffer();
        const { error } = await supabase.storage.from(BUCKET).upload(photo.storage_path, body, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const url = publicPhotoUrl(process.env.EXPO_PUBLIC_SUPABASE_URL || '', photo.storage_path);
        // The picture is on the server: now its record can be synced.
        await localDb.saveHarvestPhoto({ ...photo, uploaded: true, public_url: url, updated_at: new Date().toISOString() }, true);
        done++;
      } catch (e) {
        console.warn('Photo will upload later:', (e as Error).message);
      }
    }
  } finally {
    uploading = false;
  }
  return done;
}

/** Remove a picture here and, if it had been uploaded, on the server (the record is kept as a tombstone). */
export async function removeHarvestPhoto(photo: HarvestPhoto): Promise<void> {
  await localDb.deleteHarvestPhoto(photo.id, Boolean(photo.uploaded));
  if (photo.local_uri) await FileSystem.deleteAsync(photo.local_uri, { idempotent: true }).catch(() => undefined);
  if (photo.uploaded && isSupabaseConfigured()) {
    supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(() => undefined);
  }
}
