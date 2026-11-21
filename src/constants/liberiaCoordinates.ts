/**
 * Centroid geographic coordinates for Liberian Counties and Districts.
 * Used as fallback GPS coordinates when a farm is registered without hardware GPS,
 * ensuring accurate district-level weather forecasts and microclimate alerts.
 */

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

// Default Liberia centroid (near Totota / Central Bong)
export const LIBERIA_DEFAULT_COORDINATES: GeoCoordinate = {
  latitude: 6.4281,
  longitude: -9.4295,
};

// 15 County Centroid Coordinates
export const COUNTY_COORDINATES: Record<string, GeoCoordinate> = {
  bomi: { latitude: 6.758, longitude: -10.845 },
  bong: { latitude: 7.004, longitude: -9.472 },
  gbarpolu: { latitude: 7.495, longitude: -10.08 },
  'grand bassa': { latitude: 6.231, longitude: -9.816 },
  'grand cape mount': { latitude: 7.047, longitude: -11.071 },
  'grand gedeh': { latitude: 5.922, longitude: -8.222 },
  'grand kru': { latitude: 4.754, longitude: -8.222 },
  lofa: { latitude: 8.191, longitude: -9.723 },
  margibi: { latitude: 6.515, longitude: -10.305 },
  maryland: { latitude: 4.724, longitude: -7.717 },
  montserrado: { latitude: 6.444, longitude: -10.655 },
  nimba: { latitude: 6.842, longitude: -8.66 },
  'river cess': { latitude: 5.904, longitude: -9.456 },
  'rivercess': { latitude: 5.904, longitude: -9.456 },
  'river gee': { latitude: 5.26, longitude: -7.664 },
  sinoe: { latitude: 5.25, longitude: -8.66 },
};

// District-level specific coordinates (key: normalized "county:district" or "district")
export const DISTRICT_COORDINATES: Record<string, GeoCoordinate> = {
  // Nimba County
  'nimba:gbehley': { latitude: 7.412, longitude: -8.65 },
  'nimba:gbehley-geh': { latitude: 7.412, longitude: -8.65 },
  'nimba:sanniquellie-mahn': { latitude: 7.362, longitude: -8.712 },
  'nimba:sanniquellie': { latitude: 7.362, longitude: -8.712 },
  'nimba:bain-garr': { latitude: 7.238, longitude: -8.981 },
  'nimba:ganta': { latitude: 7.238, longitude: -8.981 },
  'nimba:twan river': { latitude: 7.18, longitude: -8.75 },
  'nimba:zoe-gbao': { latitude: 7.05, longitude: -8.7 },
  'nimba:boe & quilla': { latitude: 6.88, longitude: -8.55 },
  'nimba:buu-yao': { latitude: 6.72, longitude: -8.45 },
  'nimba:doe': { latitude: 6.65, longitude: -8.75 },
  'nimba:garr-bain': { latitude: 7.15, longitude: -8.92 },
  'nimba:kparblee': { latitude: 6.55, longitude: -8.38 },
  'nimba:meinpea-mahn': { latitude: 6.95, longitude: -8.85 },
  'nimba:yarpea mahn': { latitude: 6.82, longitude: -8.78 },
  'nimba:yarwein mehnsonnoh': { latitude: 6.45, longitude: -8.95 },
  'nimba:wee-gbehy-mahn': { latitude: 6.88, longitude: -8.82 },
  'nimba:leewehpea-mahn': { latitude: 6.78, longitude: -8.88 },
  'nimba:yarmonneh': { latitude: 7.08, longitude: -8.82 },

  // Bong County
  'bong:jorquelleh': { latitude: 7.004, longitude: -9.472 },
  'bong:gbarnga': { latitude: 7.004, longitude: -9.472 },
  'bong:suakoko': { latitude: 6.995, longitude: -9.58 },
  'bong:salala': { latitude: 6.745, longitude: -9.78 },
  'bong:fuamah': { latitude: 6.812, longitude: -10.15 },
  'bong:panta': { latitude: 7.25, longitude: -9.32 },
  'bong:kpaai': { latitude: 7.18, longitude: -9.28 },
  'bong:kokoyah': { latitude: 6.62, longitude: -9.45 },
  'bong:sanoyea': { latitude: 6.95, longitude: -9.98 },
  'bong:yeallequellah': { latitude: 6.85, longitude: -9.65 },
  'bong:zota': { latitude: 7.32, longitude: -9.45 },
  'bong:boinsen': { latitude: 6.52, longitude: -9.35 },
  'bong:tukpahblee': { latitude: 6.58, longitude: -9.25 },

  // Montserrado County
  'montserrado:greater monrovia': { latitude: 6.3156, longitude: -10.8074 },
  'montserrado:monrovia': { latitude: 6.3156, longitude: -10.8074 },
  'montserrado:careysburg': { latitude: 6.402, longitude: -10.584 },
  'montserrado:todee': { latitude: 6.62, longitude: -10.51 },
  'montserrado:st. paul river': { latitude: 6.48, longitude: -10.75 },
  'montserrado:commonwealth': { latitude: 6.38, longitude: -10.68 },

  // Lofa County
  'lofa:voinjama': { latitude: 8.421, longitude: -9.747 },
  'lofa:foya': { latitude: 8.35, longitude: -10.21 },
  'lofa:zorzor': { latitude: 7.78, longitude: -9.43 },
  'lofa:kolahun': { latitude: 8.28, longitude: -10.08 },
  'lofa:quardu gboni': { latitude: 8.52, longitude: -9.58 },
  'lofa:salayea': { latitude: 7.65, longitude: -9.55 },
  'lofa:vahun': { latitude: 8.05, longitude: -10.52 },

  // Margibi County
  'margibi:kakata': { latitude: 6.531, longitude: -10.354 },
  'margibi:firestone': { latitude: 6.36, longitude: -10.35 },
  'margibi:gibi': { latitude: 6.72, longitude: -10.15 },
  'margibi:mambah-kaba': { latitude: 6.25, longitude: -10.42 },

  // Grand Bassa County
  'grand bassa:buchanan': { latitude: 5.881, longitude: -10.045 },
  'grand bassa:district 1': { latitude: 6.12, longitude: -10.05 },
  'grand bassa:district 2': { latitude: 6.18, longitude: -9.85 },
  'grand bassa:district 3': { latitude: 5.95, longitude: -9.75 },
  'grand bassa:district 4': { latitude: 6.05, longitude: -9.55 },
  'grand bassa:owensgrove': { latitude: 6.22, longitude: -10.25 },

  // Bomi County
  'bomi:tubmanburg': { latitude: 6.87, longitude: -10.82 },
  'bomi:klay': { latitude: 6.69, longitude: -10.78 },
  'bomi:suehn mecca': { latitude: 6.78, longitude: -10.52 },
  'bomi:dewoin': { latitude: 6.61, longitude: -10.95 },

  // Gbarpolu County
  'gbarpolu:bopolu': { latitude: 7.066, longitude: -10.487 },
  'gbarpolu:belleh': { latitude: 7.35, longitude: -10.25 },
  'gbarpolu:bokomu': { latitude: 7.28, longitude: -10.02 },
  'gbarpolu:gounwolaila': { latitude: 7.15, longitude: -10.32 },
  'gbarpolu:kongba': { latitude: 7.62, longitude: -10.38 },

  // Grand Cape Mount County
  'grand cape mount:robertsport': { latitude: 6.753, longitude: -11.368 },
  'grand cape mount:tewor': { latitude: 6.95, longitude: -11.22 },
  'grand cape mount:porkpa': { latitude: 7.2, longitude: -11.15 },
  'grand cape mount:garwula': { latitude: 6.82, longitude: -11.18 },
  'grand cape mount:golakonneh': { latitude: 7.05, longitude: -11.05 },

  // Grand Gedeh County
  'grand gedeh:zwedru': { latitude: 6.071, longitude: -8.13 },
  'grand gedeh:tchien': { latitude: 6.071, longitude: -8.13 },
  'grand gedeh:konobo': { latitude: 5.85, longitude: -8.2 },
  'grand gedeh:gbarzon': { latitude: 6.25, longitude: -8.35 },
  'grand gedeh:cavalla': { latitude: 5.95, longitude: -8.05 },

  // Grand Kru County
  'grand kru:barclayville': { latitude: 4.673, longitude: -8.233 },
  'grand kru:sasstown': { latitude: 4.68, longitude: -8.45 },
  'grand kru:buah': { latitude: 4.85, longitude: -8.15 },
  'grand kru:forpoh': { latitude: 4.95, longitude: -8.25 },
  'grand kru:jloh': { latitude: 4.62, longitude: -8.52 },

  // Maryland County
  'maryland:harper': { latitude: 4.376, longitude: -7.717 },
  'maryland:pleebo sodoken': { latitude: 4.59, longitude: -7.68 },
  'maryland:karluway': { latitude: 4.8, longitude: -7.75 },
  'maryland:barrobo': { latitude: 5.02, longitude: -7.82 },

  // River Gee County
  'river gee:fish town': { latitude: 5.197, longitude: -7.876 },
  'river gee:karforh': { latitude: 5.25, longitude: -7.7 },
  'river gee:webbo': { latitude: 5.1, longitude: -7.6 },
  'river gee:nyenawliken': { latitude: 5.35, longitude: -7.85 },
  'river gee:gedebo': { latitude: 5.05, longitude: -7.75 },

  // River Cess County
  'river cess:cestos city': { latitude: 5.46, longitude: -9.58 },
  'river cess:morweh': { latitude: 5.85, longitude: -9.4 },
  'river cess:jo river': { latitude: 5.65, longitude: -9.3 },
  'rivercess:cestos city': { latitude: 5.46, longitude: -9.58 },
  'rivercess:morweh': { latitude: 5.85, longitude: -9.4 },

  // Sinoe County
  'sinoe:greenville': { latitude: 5.011, longitude: -9.039 },
  'sinoe:juarzon': { latitude: 5.4, longitude: -8.85 },
  'sinoe:kpayan': { latitude: 5.15, longitude: -8.95 },
  'sinoe:sanquin': { latitude: 5.35, longitude: -9.15 },
  'sinoe:tarjuowon': { latitude: 5.25, longitude: -8.98 },
};

/**
 * Resolves latitude and longitude for a given district and county.
 * Priority:
 * 1. Exact "county:district" coordinate
 * 2. District name alone
 * 3. County centroid coordinate
 * 4. Liberia overall national centroid
 */
export function getDistrictCoordinates(
  districtName?: string | null,
  countyName?: string | null
): GeoCoordinate {
  const normDistrict = (districtName || '').trim().toLowerCase();
  const normCounty = (countyName || '').trim().toLowerCase();

  if (normCounty && normDistrict) {
    const combinedKey = `${normCounty}:${normDistrict}`;
    if (DISTRICT_COORDINATES[combinedKey]) {
      return DISTRICT_COORDINATES[combinedKey];
    }
  }

  // Look for any district match
  if (normDistrict) {
    for (const [key, coord] of Object.entries(DISTRICT_COORDINATES)) {
      if (key.endsWith(`:${normDistrict}`)) {
        return coord;
      }
    }
  }

  // Fallback to county
  if (normCounty && COUNTY_COORDINATES[normCounty]) {
    return COUNTY_COORDINATES[normCounty];
  }

  return LIBERIA_DEFAULT_COORDINATES;
}
