/**
 * English text for the weather log, the farm record by year and the plan for next season.
 * Every string the farmer reads on those screens is here, so it can be translated in one place.
 * Placeholders look like {year}.
 */
export const en = {
  // Shared
  notRecorded: 'Not recorded',
  plTitle: 'Profit and loss',
  plProfit: 'Profit',
  plLoss: 'Loss',
  plMoneyIn: 'Money in (harvest value)',
  plMoneyOut: 'Money out (costs)',
  plEstimate: '{count} harvest(s) have no sale value, so the app price is used for them: about ${amount}. Enter the sale value on the harvest to make it exact.',
  plOtherCurrency: '{count} entry(ies) in Liberian dollars are not counted here.',
  plEmpty: 'Record a harvest or a cost to see your profit or loss.',
  close: 'Close',
  kg: 'kg',

  // Weather on an activity
  weatherToday: 'Weather today',
  weatherOptional: 'Optional',
  skySunny: 'Sunny',
  skyCloudy: 'Cloudy',
  skyRain: 'Rain',
  skyHeavyRain: 'Heavy rain',
  tapAgainToClear: 'Tap again to clear',
  rainMeasured: 'Rain you measured (mm)',
  rainPlaceholder: 'For example 12',
  dayFeels: 'Day feels',
  feelCool: 'Cool',
  feelWarm: 'Warm',
  feelHot: 'Hot',
  weatherHelper: 'No rain gauge? Leave rain blank and just pick the sky.',
  rainNotNumber: 'Type a number, for example 12 or 12.5.',
  rainOutOfRange: 'Rain must be between 0 and 500 mm.',
  weatherSelected: '{option}, selected. Tap to clear.',
  weatherNotSelected: '{option}, not selected. Tap to choose.',

  // Activity details
  activityDetails: 'Activity details',
  detailDate: 'Date',
  detailFarm: 'Farm',
  detailNotes: 'Notes',
  detailCost: 'Cost',
  detailWorkers: 'Workers',
  detailWeather: 'Weather',
  tapForDetails: 'Tap to see details',

  // Farm record by year
  farmRecord: 'Farm record',
  openFarmRecord: 'Farm record by year',
  yearTab: 'Year {year}',
  tileHarvest: 'Total harvest',
  tileActivities: 'Activities',
  tileFirstPlanting: 'First planting',
  tileLastHarvest: 'Last harvest',
  rainyDaysChart: 'Rainy days recorded each month',
  rainyDaysChartLabel: 'Rainy days recorded each month in {year}. {details}',
  chartMonthValue: '{month}: {value}',
  chartDays: '{count} rainy days',
  chartOneDay: '1 rainy day',
  noRecordsYear: 'No records for this year yet.',
  timeline: 'Activity timeline',
  noWeatherOnEntry: 'No weather recorded',
  savePdf: 'Save PDF',
  pdfWorking: 'Making your PDF...',
  pdfFailed: 'The PDF could not be made. Please try again.',
  pdfTitle: '{farm} - Farm record {year}',
  pdfCreatedOn: 'Created on {date}',
  pdfFooter: 'This record contains only what the farmer recorded.',
  month1: 'Jan', month2: 'Feb', month3: 'Mar', month4: 'Apr', month5: 'May', month6: 'Jun',
  month7: 'Jul', month8: 'Aug', month9: 'Sep', month10: 'Oct', month11: 'Nov', month12: 'Dec',

  // Plan next season
  planNext: 'Plan {year}',
  openPlanNext: 'Plan {year}',
  yourLastTwoYears: 'Your last two years',
  rowHarvest: 'Harvest',
  rowPlanting: 'First planting',
  rowRainyDays: 'Rainy days recorded',
  rowWeeding: 'Weeding',
  rowFertilizer: 'Fertilizer',
  timesCount: '{count} times',
  onceCount: '1 time',
  yourDecisions: 'Your decisions',
  fieldCrop: 'Crop',
  fieldCropPlaceholder: 'Type the crop you choose',
  fieldPlantingDate: 'Planting date',
  fieldChange: 'Change from last year',
  fieldChangePlaceholder: 'Write what you want to do differently',
  savePlan: 'Save my plan',
  planSaved: 'Your plan is saved.',
  removePlan: 'Remove my plan',
  planRemoved: 'Your plan is removed.',
  ownRecordsNote: 'These figures come from your own records.',
  noPlanYet: 'You have not saved a plan for {year} yet.',

  // Harvest photos for buyers
  photosForBuyers: 'Photos for buyers',
  photosForBuyersHelp: 'Take photos of your harvest. Buyers who scan the QR code of this harvest can see them, together with what you did on your farm.',
  photoTake: 'Take a photo',
  photoChoose: 'Choose a photo',
  photoNone: 'No photos yet.',
  photoOfProduct: 'Photo of the harvested product',
  photoShared: 'Buyers can see this',
  photoWaiting: 'Waiting for a connection',
  photoRemove: 'Remove',
  photoRemoveTitle: 'Remove this photo?',
  photoRemoveAsk: 'Buyers will no longer see it.',
  photoLimit: 'You can add up to {count} photos for one harvest.',
  photoFailed: 'The photo could not be saved. Please try again.',
  photoPermissionTitle: 'Permission needed',
  photoPermissionCamera: 'Allow the camera so you can take a photo of your harvest.',
  photoPermissionLibrary: 'Allow access to your photos so you can choose a picture of your harvest.',

  // What a buyer sees
  buyerPhotos: 'Product photos',
  buyerNoPhotos: 'The farmer has not added photos yet.',
  buyerActivities: 'What was done on the farm',
  buyerNoActivities: 'No farm activities recorded for this harvest.',
  buyerOwnCopy: 'This is the copy saved on this phone.',
  buyerFarm: 'Farm',
  buyerCounty: 'County',
} as const;

export type StringKey = keyof typeof en;

/** Look up a string and fill in {placeholders}. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  let text: string = en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}
