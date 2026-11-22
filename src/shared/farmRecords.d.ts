// Type declarations for the shared CommonJS module ./farmRecords.js
// (used by both the Expo app and the Node USSD server).

export interface SharedCrop {
  id: string;
  name: string;
  code: string;
  default_unit: string;
  category: string;
}

export interface SharedCounty {
  name: string;
  code: string;
  latitude: number;
  longitude: number;
}

export interface SimpleExpenseCategory {
  key: string;
  label: string;
  category: string;
}

export interface SeasonSummary {
  year: number;
  byCrop: Array<{ name: string; unit: string; quantity: number }>;
  totalExpenses: number;
  estimatedRevenue: number;
  net: number;
  harvestCount: number;
  expenseCount: number;
}

export const CROPS: SharedCrop[];
export function findCropById(id: string | null | undefined): SharedCrop | null;
export const LIBERIA_COUNTIES: SharedCounty[];
export const COUNTY_COORDINATES: Record<string, { latitude: number; longitude: number }>;
export function findCounty(name: string | null | undefined): SharedCounty | null;
export const SIMPLE_EXPENSE_CATEGORIES: SimpleExpenseCategory[];
export const DEFAULT_FARM_PHOTO: string;
export const DEFAULT_HARVEST_PHOTO: string;
export const USSD_TAG: string;

export function generateUUID(): string;
export function generateBatchReference(
  cropCode: string,
  optionsOrSeq?:
    | number
    | {
        countyCode?: string;
        districtCode?: string;
        sequenceNum?: number;
        isOfflinePending?: boolean;
      }
): string;
export function generateQrToken(): string;
export function generateFarmerCode(): string;

export function normalizePhone(phone: string | null | undefined): string;
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean;
export function formatLiberianPhone(phone: string | null | undefined): string;

export const REFERENCE_RATES_USD: { cropPerUnit: number; livestockPerHead: number };
export function isLivestockHarvest(h: any): boolean;
export function estimateHarvestValue(h: any): number;
export function harvestRevenueLRD(harvests: any[]): number;
export function estimateHarvestRevenue(harvests: any[] | null | undefined): number;
export function summarizeSeason(input?: { harvests?: any[]; expenses?: any[]; year?: number | string }): SeasonSummary;

export function buildFarmerRecord(input: {
  fullName: string;
  phone: string;
  county: string;
  district?: string;
  community?: string;
  farmerCode?: string;
  now?: Date;
}): any;
export interface FarmOption {
  value: string;
  label: string;
}
export const SOIL_TYPES: string[];
export const TENURE_TYPES: string[];
export const WATER_SOURCES: string[];
export const HOUSING_TYPES: string[];
export const GRAZING_ARRANGEMENTS: string[];
export const FEEDING_SYSTEMS: string[];
export const PRODUCTION_PURPOSES: string[];
export const MANAGEMENT_SYSTEMS: string[];
export const LIVESTOCK_ANIMALS: Array<{ label: string; defaultBreed: string }>;
export const FARM_OPTIONS: Record<string, FarmOption[]>;

export function buildLivestockDetails(d: {
  animals: string[];
  breed?: string;
  headCount: number | string;
  productionPurposes: string[];
  managementSystem: string;
  housingType: string;
  housingSize?: string;
  housingCapacity?: number | string;
  grazingAvailable: boolean;
  grazingArrangement?: string;
  grazingArea?: string;
  waterSource: string;
  feedingSystem: string;
}): any;
export function describeFarm(d: {
  farmingType?: string;
  crops?: string[];
  animals?: string[];
  headCount?: number | string;
  productionPurposes?: string[];
  managementSystem?: string;
}): string;
export function buildFarmRecord(input: {
  farmerId: string;
  name: string;
  farmingType?: 'crops' | 'livestock' | 'both';
  livestockDetails?: any;
  county: string;
  district?: string;
  countyId?: string | null;
  districtId?: string | null;
  community?: string;
  size?: number | string;
  sizeUnit?: 'acres' | 'hectares';
  latitude?: number | null;
  longitude?: number | null;
  ownershipType?: string;
  irrigation?: boolean;
  soilType?: string | null;
  description?: string;
  crops?: string[];
  mainCropName?: string;
  registrationDate?: string;
  now?: Date;
}): any;
export function buildSeasonRecord(input: { farmId: string; crop: SharedCrop; cultivatedArea?: number; now?: Date }): any;
export function buildHarvestRecord(input: {
  farmerId: string;
  farmId: string;
  seasonId?: string | null;
  crop: SharedCrop;
  quantity: number;
  unit?: string;
  countyCode?: string;
  storageLocation?: string;
  observations?: string;
  now?: Date;
}): any;
export function buildExpenseRecord(input: {
  farmId: string;
  seasonId?: string | null;
  category: string;
  amount: number;
  currency?: string;
  expenseDate?: string;
  description?: string;
  now?: Date;
}): {
  id: string;
  farm_id: string;
  season_id: string | null;
  category: string;
  amount: number;
  currency: string;
  expense_date: string;
  description: string;
  created_at: string;
};
export function recordSource(row: any): 'USSD' | 'App' | 'Seed';
