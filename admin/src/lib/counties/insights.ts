/**
 * Logic for the Counties section that needs no database: reading the filters from the address, ordering the
 * table, finding the county with the most of something (and showing ties), the gender bars and the CSV.
 * All the numbers themselves come from the database functions admin_county_insights() and
 * admin_county_detail(); nothing here counts rows.
 */
import { countyText as T, fill } from './en';

export interface CountyRow {
  county_id: string | null;
  county: string;
  is_unassigned: boolean;
  farmers: number; farmers_male: number; farmers_female: number; farmers_unrecorded: number;
  farms: number; farms_male: number; farms_female: number; farms_unrecorded: number;
  harvests: number; harvests_no_weight: number;
  harvest_kg: number; harvest_kg_male: number; harvest_kg_female: number; harvest_kg_unrecorded: number;
}
export interface CountyInsights {
  generated_at: string;
  filters: { year: number | null; crop: string | null; approved_only: boolean };
  counties: CountyRow[];
  national: {
    farmers: number; farmers_male: number; farmers_female: number; farmers_unrecorded: number;
    farms: number; farms_male: number; farms_female: number; farms_unrecorded: number;
    harvests: number; harvests_no_weight: number; harvest_kg: number;
  };
  excluded: { sample_farmers: number; sample_farms: number; sample_harvests: number; deleted_harvests: number; replaced_harvests: number };
}
export interface DistrictRow {
  district: string; farmers: number; farms: number; harvest_kg: number; harvests_no_weight: number; small_group: boolean;
  farmers_male: number | null; farmers_female: number | null; farmers_unrecorded: number | null;
}
export interface CountyDetail { generated_at: string; county: string; districts: DistrictRow[]; top_crops: Array<{ crop: string; harvest_kg: number }> }

// ---- filters (kept in the address, so a view can be shared and reloaded) ---------------------------------
export interface Filters {
  year: number | null; // null = all years
  crop: string | null;
  status: 'all' | 'approved';
  county: string | null; // a county id, or 'unassigned', for the detail view
  sort: SortKey;
  dir: 'asc' | 'desc';
}
export type SortKey =
  | 'county' | 'farmers' | 'farms' | 'harvest_kg' | 'farmers_male' | 'farmers_female' | 'farmers_unrecorded'
  | 'farms_male' | 'farms_female' | 'farms_unrecorded' | 'harvest_kg_male' | 'harvest_kg_female' | 'harvest_kg_unrecorded';

export interface Column { key: SortKey; label: string; numeric: boolean }
export const COLUMNS: Column[] = [
  { key: 'county', label: T.colCounty, numeric: false },
  { key: 'farmers', label: T.colFarmers, numeric: true },
  { key: 'farms', label: T.colFarms, numeric: true },
  { key: 'harvest_kg', label: T.colHarvest, numeric: true },
  { key: 'farmers_male', label: T.colFarmersMale, numeric: true },
  { key: 'farmers_female', label: T.colFarmersFemale, numeric: true },
  { key: 'farmers_unrecorded', label: T.colFarmersUnrecorded, numeric: true },
  { key: 'farms_male', label: T.colFarmsMale, numeric: true },
  { key: 'farms_female', label: T.colFarmsFemale, numeric: true },
  { key: 'farms_unrecorded', label: T.colFarmsUnrecorded, numeric: true },
  { key: 'harvest_kg_male', label: T.colKgMale, numeric: true },
  { key: 'harvest_kg_female', label: T.colKgFemale, numeric: true },
  { key: 'harvest_kg_unrecorded', label: T.colKgUnrecorded, numeric: true },
];
const SORT_KEYS = new Set<string>(COLUMNS.map((c) => c.key));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;
const one = (raw: Raw, key: string): string => {
  const v = raw instanceof URLSearchParams ? raw.get(key) : raw[key];
  return String(Array.isArray(v) ? v[0] : v ?? '').trim();
};

/** Read the filters from the address. Anything unexpected falls back to the default (current year, all crops). */
export function parseFilters(raw: Raw, now: Date = new Date()): Filters {
  const y = one(raw, 'year');
  const year = y === 'all' ? null : /^\d{4}$/.test(y) && Number(y) >= 2000 && Number(y) <= 2100 ? Number(y) : now.getUTCFullYear();
  const crop = UUID.test(one(raw, 'crop')) ? one(raw, 'crop') : null;
  const county = one(raw, 'county');
  const sort = SORT_KEYS.has(one(raw, 'sort')) ? (one(raw, 'sort') as SortKey) : 'harvest_kg';
  const dir = one(raw, 'dir') === 'asc' ? 'asc' : one(raw, 'dir') === 'desc' ? 'desc' : sort === 'county' ? 'asc' : 'desc';
  return { year, crop, status: one(raw, 'status') === 'approved' ? 'approved' : 'all', county: county === 'unassigned' || UUID.test(county) ? county : null, sort, dir };
}

/** The address for a view. The same filters always give the same address, so reloading shows the same numbers. */
export function filtersToQuery(f: Filters, override: Partial<Filters> = {}): string {
  const m = { ...f, ...override };
  const q = new URLSearchParams();
  q.set('year', m.year === null ? 'all' : String(m.year));
  if (m.crop) q.set('crop', m.crop);
  q.set('status', m.status);
  if (m.county) q.set('county', m.county);
  q.set('sort', m.sort);
  q.set('dir', m.dir);
  return q.toString();
}

// ---- the table ---------------------------------------------------------------------------------------------
/** Sort the counties. "Unassigned county" always stays last; ties are put in name order so the order is stable. */
export function sortRows(rows: CountyRow[], key: SortKey, dir: 'asc' | 'desc'): CountyRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  const real = rows.filter((r) => !r.is_unassigned);
  const un = rows.filter((r) => r.is_unassigned);
  real.sort((a, b) => {
    if (key === 'county') return sign * a.county.localeCompare(b.county);
    return sign * (Number(a[key]) - Number(b[key])) || a.county.localeCompare(b.county);
  });
  return [...real, ...un];
}

/** A harvest figure, or "Not recorded" when there are harvests but none has a weight (so the figure cannot be known). */
export function harvestCell(row: Pick<CountyRow, 'harvests' | 'harvests_no_weight' | 'harvest_kg'>, value: number): string | number {
  return row.harvests > 0 && row.harvests_no_weight === row.harvests ? T.notRecorded : value;
}

export const formatNumber = (n: number): string => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const percent = (part: number, whole: number): string => (whole > 0 ? `${(Math.round((part / whole) * 1000) / 10).toFixed(1)}%` : '0.0%');

// ---- highlight cards ---------------------------------------------------------------------------------------
export interface Highlight { title: string; names: string[]; value: string; tied: boolean; empty: boolean; note?: string }

/** The county (or counties, if tied) with the highest value. "Unassigned county" is not a county, so it never wins. */
function topCounties(rows: CountyRow[], key: keyof CountyRow): { names: string[]; value: number } {
  const real = rows.filter((r) => !r.is_unassigned);
  const max = real.reduce((m, r) => Math.max(m, Number(r[key])), 0);
  return { names: max > 0 ? real.filter((r) => Number(r[key]) === max).map((r) => r.county) : [], value: max };
}

export function buildHighlights(data: CountyInsights): Highlight[] {
  const card = (title: string, key: keyof CountyRow, unit: string): Highlight => {
    const { names, value } = topCounties(data.counties, key);
    return { title, names, value: names.length ? `${formatNumber(value)} ${unit}` : '', tied: names.length > 1, empty: names.length === 0 };
  };
  const n = data.national;
  const totalFarms = n.farms;
  let gender: Highlight;
  if (n.farms_male === 0 && n.farms_female === 0) {
    gender = { title: T.genderMostFarms, names: [], value: '', tied: false, empty: true };
  } else if (n.farms_male === n.farms_female) {
    gender = { title: T.genderMostFarms, names: [T.equal], value: `${formatNumber(n.farms_male)} ${T.farmsUnit} each (${percent(n.farms_male, totalFarms)})`, tied: false, empty: false };
  } else {
    const male = n.farms_male > n.farms_female;
    const count = male ? n.farms_male : n.farms_female;
    gender = { title: T.genderMostFarms, names: [male ? T.male : T.female], value: `${formatNumber(count)} ${T.farmsUnit} (${percent(count, totalFarms)} ${T.ofFarms})`, tied: false, empty: false };
  }
  if (n.farms_unrecorded > 0) gender.note = fill(T.genderNotRecordedFarms, { count: formatNumber(n.farms_unrecorded) });
  return [
    card(T.mostFarmers, 'farmers', T.farmersUnit),
    card(T.mostHarvest, 'harvest_kg', T.kgUnit),
    card(T.mostFarms, 'farms', T.farmsUnit),
    gender,
    card(T.womenMostFarms, 'farms_female', T.farmsUnit),
    card(T.menMostFarms, 'farms_male', T.farmsUnit),
  ];
}

// ---- gender bars -------------------------------------------------------------------------------------------
export interface Segment { key: 'male' | 'female' | 'unrecorded'; label: string; value: number; pct: number; text: string }

/** The three parts of a bar. Every part has a text label, so the bar never depends on colour alone. */
export function genderSegments(male: number, female: number, unrecorded: number): Segment[] {
  const total = male + female + unrecorded;
  const part = (key: Segment['key'], label: string, value: number): Segment => ({
    key, label, value, pct: total > 0 ? (value / total) * 100 : 0, text: `${label} ${formatNumber(value)} (${percent(value, total)})`,
  });
  return [part('male', T.male, male), part('female', T.female, female), part('unrecorded', T.notRecordedGender, unrecorded)];
}

export const genderDescription = (row: CountyRow): string =>
  fill(T.genderSummary, { county: row.county, total: formatNumber(row.farmers), male: row.farmers_male, female: row.farmers_female, unrecorded: row.farmers_unrecorded });

// ---- CSV ---------------------------------------------------------------------------------------------------------
const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function filtersLabel(f: Filters, cropName: string | null): string {
  return `Year=${f.year === null ? T.allYears : f.year}; Crop=${cropName || T.allCrops}; Status=${f.status === 'approved' ? T.approvedOnly : T.allStatuses}`;
}

/** The table as CSV: the same columns, in the same order, with the same sort. A last line names the filters and the time. */
export function toCsv(data: CountyInsights, f: Filters, cropName: string | null, createdAt: Date = new Date()): string {
  const rows = sortRows(data.counties, f.sort, f.dir);
  const lines = [COLUMNS.map((c) => csvCell(c.label)).join(',')];
  for (const r of rows) {
    lines.push(
      COLUMNS.map((c) => {
        if (c.key === 'county') return csvCell(r.county);
        const isKg = c.key.startsWith('harvest_kg');
        return csvCell(isKg ? harvestCell(r, r[c.key] as number) : (r[c.key] as number));
      }).join(',')
    );
  }
  lines.push(`${csvCell(T.csvFilters + ': ' + filtersLabel(f, cropName))},${csvCell(T.csvCreated + ': ' + createdAt.toISOString())}`);
  return lines.join('\r\n') + '\r\n';
}
