export interface MonthRain {
  month: number;
  recordedDays: number;
  /** null = no weather recorded that month (not recorded); 0 = weather recorded, no rainy days */
  rainyDays: number | null;
}
export interface YearSummary {
  year: number;
  hasData: boolean;
  harvestKg: number | null;
  activityCount: number | null;
  firstPlantingDate: string | null;
  lastHarvestDate: string | null;
  rainyDaysTotal: number | null;
  weedingCount: number | null;
  fertilizerCount: number | null;
  months: MonthRain[];
}
export function yearOf(dateText: string | null | undefined): number | null;
export function yearsWithData(input?: { activities?: any[]; harvests?: any[]; now?: Date }): number[];
export function activitiesInYear<T extends { activity_date?: string }>(activities: T[], year: number): T[];
export function harvestsInYear<T extends { harvest_date?: string }>(harvests: T[], year: number): T[];
export function totalHarvestKg(harvests: any[]): number | null;
export function firstPlantingDate(activities: any[]): string | null;
export function lastHarvestDate(harvests: any[]): string | null;
export function countInGroup(activities: any[], group: string): number | null;
export function rainyDaysByMonth(activities: any[], year: number): MonthRain[];
export function summarizeYear(input: { activities?: any[]; harvests?: any[]; year: number }): YearSummary;
export function showMeasure(value: number | string | null | undefined, notRecorded: string, unit?: string): string;
export function buildYearPdfHtml(input: {
  farmName: string;
  year: number;
  createdOn: string;
  summary: YearSummary;
  activities: any[];
  labels: Record<string, any>;
  notRecorded: string;
  weatherText: (activity: any) => string | null;
}): string;
