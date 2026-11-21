/**
 * Centroid geographic coordinates for Liberian Counties and Districts.
 * Shared between Mobile client and Admin Portal.
 */

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export const LIBERIA_DEFAULT_COORDINATES: GeoCoordinate = {
  latitude: 6.4281,
  longitude: -9.4295,
};

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

export const DISTRICT_COORDINATES: Record<string, GeoCoordinate> = {
  'nimba:gbehley': { latitude: 7.412, longitude: -8.65 },
  'nimba:gbehley-geh': { latitude: 7.412, longitude: -8.65 },
  'nimba:sanniquellie-mahn': { latitude: 7.362, longitude: -8.712 },
  'nimba:sanniquellie': { latitude: 7.362, longitude: -8.712 },
  'nimba:bain-garr': { latitude: 7.238, longitude: -8.981 },
  'nimba:ganta': { latitude: 7.238, longitude: -8.981 },
  'nimba:twan river': { latitude: 7.18, longitude: -8.75 },
  'nimba:zoe-gbao': { latitude: 7.05, longitude: -8.7 },
  'bong:jorquelleh': { latitude: 7.004, longitude: -9.472 },
  'bong:gbarnga': { latitude: 7.004, longitude: -9.472 },
  'bong:suakoko': { latitude: 6.995, longitude: -9.58 },
  'bong:salala': { latitude: 6.745, longitude: -9.78 },
  'bong:fuamah': { latitude: 6.812, longitude: -10.15 },
  'montserrado:greater monrovia': { latitude: 6.3156, longitude: -10.8074 },
  'montserrado:monrovia': { latitude: 6.3156, longitude: -10.8074 },
  'montserrado:careysburg': { latitude: 6.402, longitude: -10.584 },
  'montserrado:todee': { latitude: 6.62, longitude: -10.51 },
  'lofa:voinjama': { latitude: 8.421, longitude: -9.747 },
  'lofa:foya': { latitude: 8.35, longitude: -10.21 },
  'lofa:zorzor': { latitude: 7.78, longitude: -9.43 },
  'margibi:kakata': { latitude: 6.531, longitude: -10.354 },
  'grand bassa:buchanan': { latitude: 5.881, longitude: -10.045 },
  'bomi:tubmanburg': { latitude: 6.87, longitude: -10.82 },
  'gbarpolu:bopolu': { latitude: 7.066, longitude: -10.487 },
  'grand cape mount:robertsport': { latitude: 6.753, longitude: -11.368 },
  'grand gedeh:zwedru': { latitude: 6.071, longitude: -8.13 },
  'grand kru:barclayville': { latitude: 4.673, longitude: -8.233 },
  'maryland:harper': { latitude: 4.376, longitude: -7.717 },
  'river gee:fish town': { latitude: 5.197, longitude: -7.876 },
  'river cess:cestos city': { latitude: 5.46, longitude: -9.58 },
  'sinoe:greenville': { latitude: 5.011, longitude: -9.039 },
};

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

  if (normDistrict) {
    for (const [key, coord] of Object.entries(DISTRICT_COORDINATES)) {
      if (key.endsWith(`:${normDistrict}`)) {
        return coord;
      }
    }
  }

  if (normCounty && COUNTY_COORDINATES[normCounty]) {
    return COUNTY_COORDINATES[normCounty];
  }

  return LIBERIA_DEFAULT_COORDINATES;
}
