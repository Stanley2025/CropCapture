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

  // Harvest photos (farmer)
  harvestPhotosTitle: 'Harvest photos',
  photosBuyersNote: 'Buyers see these photos when they scan your QR code.',
  photosCount: '{count} of {max} photos',
  photoTake: 'Take photo',
  photoGallery: 'From gallery',
  photoAddTile: 'Add photo',
  photoOfProduct: 'Photo of the harvested product',
  tagBags: 'Bags',
  tagGrain: 'Grain',
  tagHeap: 'Heap',
  tagField: 'Field',
  tagOther: 'Other',
  tagForNext: 'Tag for the next photo',
  tagChange: 'Change tag',
  statusUploaded: 'Uploaded',
  statusWaitingWifi: 'Waiting for Wi-Fi',
  statusWaiting: 'Waiting to upload',
  statusUploading: 'Uploading',
  statusFailed: 'Failed',
  photoRetry: 'Retry',
  photoDelete: 'Delete',
  photoDeleteTitle: 'Delete this photo?',
  photoDeleteAsk: 'Buyers will no longer see it.',
  photoLimit: 'You can add up to {count} photos for one harvest.',
  photoFailed: 'The photo could not be saved. Please try again.',
  photoTooLarge: 'This photo is too large to send. Please take another one.',
  photoPermissionTitle: 'Permission needed',
  photoPermissionCamera: 'Allow the camera so you can take a photo of your harvest.',
  photoPermissionLibrary: 'Allow access to your photos so you can choose a picture of your harvest.',
  photoMobileData: 'Upload on mobile data too',
  photoMobileDataHelp: 'Photos are sent on Wi-Fi only, unless you turn this on.',
  seeBuyerView: 'See what buyers see',
  harvestNotFound: 'This harvest was not found on this phone.',

  // QR passport
  shareLink: 'Share link',
  passportPhotosCard: 'Harvest photos',
  passportPhotosSub: '{count} of {max} photos. Buyers see them when they scan the QR code.',
  shareMessage: 'Harvest {batch}: {crop}, {quantity}. Photos and details: {url}',
  statusApproved: 'Approved',
  statusAwaitingApproval: 'Awaiting approval',
  batchNumberPending: 'Pending number',

  // What a buyer sees
  buyerTitle: 'Harvest details',
  buyerNoPhotos: 'No photos added yet',
  buyerBatchId: 'Batch ID',
  buyerWeight: 'Weight',
  buyerHarvestDate: 'Harvest date',
  buyerGrownIn: 'Grown in',
  buyerFarmer: 'Farmer',
  buyerHowGrown: 'How it was grown',
  buyerNoActivities: 'No farm activities recorded.',
  buyerNote: 'These details and photos were entered by the farmer. Ask the farmer, or your own inspector, if you need to check them.',
  buyerNotFound: 'Product not found',
  buyerOwnCopy: 'This is the copy saved on this phone.',
  buyerPhotoMissing: 'Photo is not on this phone',
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
