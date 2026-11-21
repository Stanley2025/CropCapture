export interface FarmPlan {
  id: string;
  farm_id: string;
  plan_year: number;
  crop: string | null;
  planting_date: string | null;
  change_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export const MAX_CROP_LENGTH: number;
export const MAX_NOTE_LENGTH: number;
export function planYearFor(now?: Date): number;
export function planIdFor(farmId: string, year: number): string;
export function buildPlan(input: {
  farmId: string;
  year: number;
  crop?: string | null;
  plantingDate?: string | null;
  changeNote?: string | null;
  existing?: { created_at?: string } | null;
  now?: Date;
}): FarmPlan;
export function comparePreviousYears(input: { activities?: any[]; harvests?: any[]; planYear: number }): {
  years: number[];
  rows: Array<{ key: 'harvest' | 'planting' | 'rainyDays' | 'weeding' | 'fertilizer'; values: Array<number | string | null> }>;
};
