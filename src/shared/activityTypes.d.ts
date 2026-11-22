export interface ActivitySection {
  title?: string;
  items: readonly string[];
}
export const PLANTING_ACTIVITIES: readonly string[];
export const CROP_ACTIVITY_SECTIONS: readonly ActivitySection[];
export const CROP_ACTIVITY_TYPES: readonly string[];
export const CROP_ACTIVITY_FILTERS: readonly string[];
export const LEGACY_GROUP: Readonly<Record<string, string>>;
export function groupOf(activityType: string | null | undefined): string | null;
export function matchesCategory(activityType: string | null | undefined, category: string | null | undefined): boolean;
