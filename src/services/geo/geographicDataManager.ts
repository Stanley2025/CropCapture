import AsyncStorage from '@react-native-async-storage/async-storage';
import { County, District, COUNTIES as BASE_COUNTIES, DISTRICTS as BASE_DISTRICTS } from '../constants/liberiaGeographicData';

export interface GeographicDataset {
  version: number;
  updated_at: string;
  counties: County[];
  districts: District[];
}

const STORAGE_KEY = '@cropcapture_geographic_data_v1';
export const CURRENT_GEOGRAPHIC_BASELINE_VERSION = 1;

export class GeographicDataManager {
  private static instance: GeographicDataManager;
  private cachedData: GeographicDataset | null = null;

  private constructor() {}

  public static getInstance(): GeographicDataManager {
    if (!GeographicDataManager.instance) {
      GeographicDataManager.instance = new GeographicDataManager();
    }
    return GeographicDataManager.instance;
  }

  /**
   * Returns current active geographic dataset (from cache or baseline)
   */
  public async getGeographicData(): Promise<GeographicDataset> {
    if (this.cachedData) {
      return this.cachedData;
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GeographicDataset;
        if (parsed && parsed.version && parsed.counties && parsed.districts) {
          this.cachedData = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading cached geographic data:', e);
    }

    // Baseline fallback
    const baseline: GeographicDataset = {
      version: CURRENT_GEOGRAPHIC_BASELINE_VERSION,
      updated_at: '2026-11-20T00:00:00Z',
      counties: BASE_COUNTIES,
      districts: BASE_DISTRICTS,
    };
    this.cachedData = baseline;
    return baseline;
  }

  public async getCounties(): Promise<County[]> {
    const data = await this.getGeographicData();
    return data.counties;
  }

  public async getDistrictsByCounty(countyIdOrName: string): Promise<District[]> {
    const data = await this.getGeographicData();
    const cleanQuery = (countyIdOrName || '').toLowerCase().trim();

    // Match by ID or Name
    const matchedCounty = data.counties.find(
      (c) => c.id === countyIdOrName || c.name.toLowerCase() === cleanQuery
    );

    if (!matchedCounty) {
      return [];
    }

    return data.districts.filter((d) => d.county_id === matchedCounty.id);
  }

  /**
   * Synchronize counties & districts from server with version check
   * Only downloads if server version is newer than device version
   */
  public async syncFromServer(supabaseClient?: any): Promise<{
    updated: boolean;
    version: number;
    countiesCount: number;
    districtsCount: number;
  }> {
    const current = await this.getGeographicData();

    if (!supabaseClient) {
      return {
        updated: false,
        version: current.version,
        countiesCount: current.counties.length,
        districtsCount: current.districts.length,
      };
    }

    try {
      // 1. Check server version
      const { data: meta, error: metaErr } = await supabaseClient
        .from('geographic_metadata')
        .select('version, updated_at')
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (metaErr || !meta || meta.version <= current.version) {
        return {
          updated: false,
          version: current.version,
          countiesCount: current.counties.length,
          districtsCount: current.districts.length,
        };
      }

      // 2. Fetch new counties & districts
      const [countiesRes, districtsRes] = await Promise.all([
        supabaseClient.from('counties').select('id, name, code').order('name'),
        supabaseClient.from('districts').select('id, county_id, name').order('name'),
      ]);

      if (countiesRes.data && districtsRes.data) {
        const newDataset: GeographicDataset = {
          version: meta.version,
          updated_at: meta.updated_at || new Date().toISOString(),
          counties: countiesRes.data,
          districts: districtsRes.data,
        };

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDataset));
        this.cachedData = newDataset;

        return {
          updated: true,
          version: newDataset.version,
          countiesCount: newDataset.counties.length,
          districtsCount: newDataset.districts.length,
        };
      }
    } catch (e) {
      console.warn('Geographic server sync skipped (offline or network error):', e);
    }

    return {
      updated: false,
      version: current.version,
      countiesCount: current.counties.length,
      districtsCount: current.districts.length,
    };
  }
}

export const geographicDataManager = GeographicDataManager.getInstance();
