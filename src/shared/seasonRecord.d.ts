// Types for ./seasonRecord.js (shared by the Expo app and node tests).

export interface Option<T = string> {
  value: T;
  label: string;
}

export const FIELD_TYPES: Option[];
export const LAND_PREPARATION: Option[];
export const FALLOW_LENGTHS: Option<number>[];
export const SEED_SOURCES: Option[];
export const LABOR_TYPES: Option[];
export const PROBLEM_TYPES: Option[];
export const DISEASE_SUGGESTIONS: Record<string, string[]>;
export const SEVERITIES: Option[];
export const DESTINATIONS: Option[];
export const LOSS_REASONS: Option[];
export const STORAGE_METHODS: Option[];
export const STORAGE_MONTHS: number[];
export const REFLECTION_CHOICES: Option[];
export const CURRENCIES: Array<'LRD' | 'USD'>;
export const DEFAULT_CURRENCY: 'USD';
export const LOCAL_UNITS: Option[];
export const VARIETIES_BY_CROP_CODE: Readonly<Record<string, readonly string[]>>;
export const KG_PER_UNIT: Readonly<Record<string, number>>;
export const KG_PER_UNIT_BY_CROP_CODE: Readonly<Record<string, Record<string, number>>>;
export const ESTIMATED_UNITS: readonly string[];
export const DETAIL_FIELDS: string[];

export function labelOf(list: Option<any>[], value: any): string;
export function stableRowId(kind: 'details' | 'weather', seasonId: string): string;
export function normalizeUnit(unit: string | null | undefined): string | null;
export function toKg(input: {
  quantity: number | string;
  unit: string | null | undefined;
  cropCode?: string;
}): { kg: number; kgPerUnit: number; unit: string; estimated: boolean } | null;

export interface SeasonDetails {
  id: string;
  season_id: string;
  field_type?: string | null;
  previous_crop_id?: string | null;
  previous_crop_name?: string | null;
  fallow_months?: number | null;
  land_preparation?: string[];
  variety_label?: string | null;
  seed_source?: string | null;
  seed_qty_local?: number | null;
  seed_unit_local?: string | null;
  seed_kg_per_unit?: number | null;
  seed_kg?: number | null;
  intercropped?: boolean | null;
  storage_method?: string | null;
  storage_months?: number | null;
  storage_loss_kg?: number | null;
  home_price_per_kg?: number | null;
  home_price_currency?: string | null;
  reflection_choice?: string | null;
  reflection_audio_path?: string | null;
  created_at: string;
  updated_at: string;
}
export function mergeSeasonDetails(
  existing: SeasonDetails | null | undefined,
  patch: Partial<Omit<SeasonDetails, 'id' | 'season_id' | 'created_at' | 'updated_at'>>,
  opts?: { seasonId?: string; cropCode?: string; now?: Date }
): SeasonDetails;

export interface SeasonLabor {
  id: string;
  season_id: string;
  labor_type: string;
  days: number;
  cost: number;
  currency: 'LRD' | 'USD';
  note?: string | null;
  created_at: string;
  updated_at: string;
}
export function buildLaborEntry(input: {
  seasonId: string;
  laborType: string;
  days: number | string;
  cost?: number | string | null;
  currency?: string;
  note?: string;
  now?: Date;
}): SeasonLabor;

export interface SeasonProblem {
  id: string;
  season_id: string;
  problem_type: string;
  severity: 'small' | 'medium' | 'big';
  problem_date: string;
  detail?: string | null;
  created_at: string;
  updated_at: string;
}
export function buildProblem(input: {
  seasonId: string;
  problemType: string;
  severity?: string;
  date?: string;
  detail?: string;
  now?: Date;
}): SeasonProblem;

export interface SeasonDisposal {
  id: string;
  season_id: string;
  harvest_id?: string | null;
  destination: 'sold' | 'eaten' | 'seed' | 'lost';
  qty_local: number;
  unit_local: string;
  kg_per_unit: number | null;
  qty_kg: number | null;
  loss_reason: string | null;
  price_per_unit: number | null;
  sale_currency: 'LRD' | 'USD' | null;
  sold_month: string | null;
  buyer_market: string | null;
  transport_cost: number | null;
  created_at: string;
  updated_at: string;
}
export function buildDisposal(input: {
  seasonId: string;
  harvestId?: string | null;
  destination: string;
  quantity: number | string;
  unit: string;
  cropCode?: string;
  lossReason?: string | null;
  sale?: { pricePerUnit?: number | string | null; currency?: string; month?: string; buyerMarket?: string; transportCost?: number | string | null };
  now?: Date;
}): SeasonDisposal;
export function summarizeHarvestUse(
  disposals: SeasonDisposal[],
  harvestedKg?: number | null
): {
  kg: Record<'sold' | 'eaten' | 'seed' | 'lost', number>;
  lostBy: Record<string, number>;
  accounted: number;
  unaccounted: number | null;
  over: boolean;
  withoutKg: number;
};

export function seasonPeriod(season: any, harvests?: any[], now?: Date): { start: string; end: string };
export function attributeSeasonCosts(input: {
  season: any;
  seasonsOnFarm?: any[];
  harvests?: any[];
  expenses?: any[];
  inputs?: any[];
  activities?: any[];
  now?: Date;
}): { expenses: any[]; inputs: any[]; activities: any[]; sharedCount: number; period: { start: string; end: string } };

export interface CurrencyProfit {
  currency: 'LRD' | 'USD';
  revenue: number;
  transportCost: number;
  laborCost: number;
  expenseCost: number;
  inputCost: number;
  activityCost: number;
  cashCosts: number;
  cashProfit: number;
}
export interface HomeFood {
  kg: number;
  pricePerKg: number | null;
  currency: string;
  value: number | null;
  needsPrice: boolean;
}
export function summarizeSeasonProfit(input: {
  details?: SeasonDetails | null;
  disposals?: SeasonDisposal[];
  labor?: SeasonLabor[];
  costs?: { expenses?: any[]; inputs?: any[]; activities?: any[] };
}): { currencies: CurrencyProfit[]; homeFood: HomeFood };
