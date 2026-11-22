/**
 * English text for the admin "Counties" section. Every word on that page comes from here.
 * Numbers are described as "recorded in the system".
 */
export const countyText = {
  title: 'Counties',
  subtitle: 'Farmers, farms and harvest recorded in the system, by county.',
  lastUpdated: 'Last updated',
  filtersHeading: 'Filters',
  year: 'Year',
  allYears: 'All years',
  crop: 'Crop',
  allCrops: 'All crops',
  status: 'Status',
  allStatuses: 'All records',
  approvedOnly: 'Approved records only',
  apply: 'Apply filters',
  filterNote: 'Year, crop and status filter the harvest numbers. Farmers and farms are all those recorded in the system.',

  // highlight cards
  mostFarmers: 'County with most farmers',
  mostHarvest: 'County with most harvest',
  mostFarms: 'County with most farms',
  genderMostFarms: 'Gender with most farms',
  womenMostFarms: 'County where women own the most farms',
  menMostFarms: 'County where men own the most farms',
  noRecords: 'No records yet',
  equal: 'Equal',
  male: 'Male',
  female: 'Female',
  notRecordedGender: 'Gender not recorded',
  tied: 'tied',
  farmersUnit: 'farmers',
  farmsUnit: 'farms',
  kgUnit: 'kg',
  ofFarms: 'of all farms',
  genderNotRecordedFarms: 'Owner gender is not recorded for {count} of these farms.',

  // table
  tableHeading: 'All counties',
  tableCaption: 'Farmers, farms and harvest by county. Select a column heading to sort.',
  colCounty: 'County',
  colFarmers: 'Farmers',
  colFarms: 'Farms',
  colHarvest: 'Harvest (kg)',
  colFarmersMale: 'Male farmers',
  colFarmersFemale: 'Female farmers',
  colFarmersUnrecorded: 'Gender not recorded',
  colFarmsMale: 'Farms owned by men',
  colFarmsFemale: 'Farms owned by women',
  colFarmsUnrecorded: 'Farms, owner gender not recorded',
  colKgMale: 'Harvest (kg), men',
  colKgFemale: 'Harvest (kg), women',
  colKgUnrecorded: 'Harvest (kg), gender not recorded',
  notRecorded: 'Not recorded',
  nationalTotal: 'All counties',
  sortedBy: 'Sorted by {column}, {direction}',
  ascending: 'lowest first',
  descending: 'highest first',

  // gender view
  genderHeading: 'Gender of farmers, by county',
  genderHelp: 'Each bar shows the farmers of one county. The numbers are written next to each bar.',
  genderSummary: '{county}: {total} farmers. Male {male}, female {female}, not recorded {unrecorded}.',

  // detail
  detailHeading: '{county}: districts',
  detailClose: 'Back to all counties',
  detailOpen: 'Open {county}',
  colDistrict: 'District',
  fewerThan5: 'Fewer than 5',
  detailSmallGroupNote: 'A district with fewer than 5 farmers shows no gender split, so no one can be identified.',
  topCrops: 'Top crops by harvest',
  noCrops: 'No harvest recorded for these filters.',
  noDistricts: 'No farms recorded in this county.',

  // notes about what is counted
  notesHeading: 'What is counted',
  excludedSamples: 'Sample records are not counted: {farmers} farmers, {farms} farms, {harvests} harvests.',
  excludedHarvests: 'Deleted harvests ({deleted}) and harvests replaced by a newer edit ({replaced}) are not counted.',
  noWeight: '{count} harvests have no weight in kg (for example bags with no weight recorded). They are counted as harvests but add no kg.',
  unassignedNote: 'Unassigned county: records whose county is missing or could not be matched to a county name.',

  // states
  empty: 'No records match these filters',
  errorTitle: 'The county numbers could not be loaded',
  errorBody: 'Check your connection and try again.',
  retry: 'Try again',
  signedOutTitle: 'Sign in to see this section',
  signedOutBody: 'This section is for signed-in administrators. Sign in with an administrator account.',
  forbiddenTitle: 'You do not have access to this section',
  forbiddenBody: 'Only administrators can see county numbers.',
  loading: 'Loading county numbers',

  // export
  download: 'Download CSV',
  csvFilters: 'Filters',
  csvCreated: 'Created',
} as const;

export const fill = (text: string, params: Record<string, string | number> = {}): string => {
  let out = text;
  for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v));
  return out;
};
