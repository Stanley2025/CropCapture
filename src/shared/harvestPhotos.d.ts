export type PhotoTag = 'bags' | 'grain' | 'heap' | 'field' | 'other';
export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface HarvestPhoto {
  id: string;
  harvest_id: string;
  farm_id: string;
  storage_path: string;
  public_url: null;
  tag: PhotoTag;
  taken_at: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  upload_status: UploadStatus;
  // phone only
  local_uri?: string | null;
  attempts?: number;
  next_attempt_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BuyerView {
  batchId: string | null;
  crop: string | null;
  variety: string | null;
  quantity: number | null;
  unit: string | null;
  harvestDate: string | null;
  approved: boolean;
  district: string | null;
  county: string | null;
  farmer: string | null;
  photos: { id: string; tag: PhotoTag; url: string | null }[];
  activities: { type: string; date: string }[];
}

export type Network = { connected: boolean; wifi: boolean };

export const MAX_PHOTOS_PER_HARVEST: number;
export const BUCKET: string;
export const PHOTO_TAGS: PhotoTag[];
export const UPLOAD_STATUSES: UploadStatus[];
export const MAX_LONG_SIDE: number;
export const TARGET_BYTES: number;
export const SERVER_LIMIT_BYTES: number;
export const ACTIVITY_WINDOW_DAYS: number;
export function photoStoragePath(farmId: string, harvestId: string, photoId: string): string;
export function buildPhoto(input: { harvestId: string; farmId: string; localUri: string; tag?: PhotoTag; takenAt?: string; width?: number | null; height?: number | null; sizeBytes?: number | null; now?: Date; id?: string }): HarvestPhoto;
export function toServerRow(photo: any): any;
export function canAddPhoto(photos: any[]): boolean;
export function photosOverLimit(photos: any[]): HarvestPhoto[];
export function planResize(width: number, height: number, maxSide?: number): { width: number; height: number } | null;
export function compressToTarget<T extends { size: number }>(encode: (quality: number) => Promise<T>, opts?: { targetBytes?: number; qualities?: number[] }): Promise<T & { quality: number; withinTarget: boolean; withinServerLimit: boolean }>;
export function stripJpegMetadata(bytes: Uint8Array | ArrayBuffer): Uint8Array;
export function hasExif(bytes: Uint8Array | ArrayBuffer): boolean;
export function backoffMs(attempts: number): number;
export function nextUploadAction(input: { photo: any; now?: number; network: Network | null; wifiOnly?: boolean }): 'upload' | 'wait_wifi' | 'wait_connection' | 'wait_retry' | 'skip';
export function photoStatusKey(photo: any, opts?: { wifiOnly?: boolean; network?: Network }): 'uploaded' | 'uploading' | 'failed' | 'waitingWifi' | 'waiting';
export function resumeInterrupted<T extends { upload_status: string }>(photo: T): T;
export function activitiesForBuyer(activities: any[], harvest: any): any[];
export function farmerLabel(fullName: string | null | undefined): string | null;
export function buildBuyerView(input: { harvest: any; farm?: any; farmer?: any; crop?: any; variety?: any; photos?: any[]; activities?: any[] }): BuyerView | null;
