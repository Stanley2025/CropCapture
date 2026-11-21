export interface HarvestPhoto {
  id: string;
  harvest_id: string;
  farm_id: string | null;
  storage_path: string;
  public_url: string | null;
  /** only on the phone */
  local_uri?: string;
  /** only on the phone: has the picture reached the server? */
  uploaded?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface BuyerView {
  batchReference: string | null;
  product: { crop: string | null; variety: string | null; quantity: number | null; unit: string | null; harvestDate: string | null; status: string | null };
  farm: { name: string | null; county: string | null } | null;
  photos: Array<{ id: string; url: string }>;
  activities: Array<{ id: string; date: string; type: string; weather: string | null }>;
}
export const MAX_PHOTOS_PER_HARVEST: number;
export const BUCKET: string;
export const ACTIVITY_WINDOW_DAYS: number;
export function photoStoragePath(harvestId: string, photoId: string): string;
export function publicPhotoUrl(supabaseUrl: string, storagePath: string): string;
export function buildPhoto(input: { harvestId: string; farmId?: string | null; localUri: string; now?: Date; id?: string }): HarvestPhoto;
export function toServerRow(photo: HarvestPhoto): Omit<HarvestPhoto, 'local_uri' | 'uploaded'>;
export function canAddPhoto(photos: Array<{ deleted_at?: string | null }>): boolean;
export function activitiesForBuyer(activities: any[], harvest: any): any[];
export function buildBuyerView(input: { harvest: any; farm?: any; crop?: any; photos?: any[]; activities?: any[] }): BuyerView | null;
