/**
 * English text for the public buyer page (/b/{code}). Every word a buyer reads is here, so the page can be
 * translated in one place. Placeholders look like {name}.
 */
export const buyerText = {
  siteName: 'FarmTori',
  pageTitle: '{crop} · Batch {batchId}',
  pageTitleNoCrop: 'Harvest · Batch {batchId}',
  ogDescription: '{weight} harvested on {date}. Photos and farm activity entered by the farmer.',
  photosHeading: 'Photos',
  noPhotos: 'No photos added yet',
  photoAlt: 'Photo of the harvested product ({tag})',
  statusApproved: 'Approved',
  statusAwaiting: 'Awaiting approval',
  factsHeading: 'Facts',
  batchId: 'Batch ID',
  weight: 'Weight',
  harvestDate: 'Harvest date',
  grownIn: 'Grown in',
  farmer: 'Farmer',
  howGrown: 'How it was grown',
  noActivities: 'No farm activities recorded.',
  footerNote: 'These details and photos were entered by the farmer. Ask the farmer, or your own inspector, if you need to check them.',
  reportLink: 'Report a problem',
  reportHeading: 'Report a problem',
  reportHelp: 'Tell us what looks wrong. An administrator will read it.',
  reportMessage: 'What is the problem?',
  reportContact: 'Your phone or email (optional)',
  reportSend: 'Send report',
  reportThanks: 'Thank you. Your report was sent for review.',
  notFoundTitle: 'Product not found',
  notFoundBody: 'This link does not match a product. Check the code on the package or ask the seller.',
  tooMany: 'Too many requests. Please wait a minute and try again.',
  tags: { bags: 'Bags', grain: 'Grain', heap: 'Heap', field: 'Field', other: 'Other' } as Record<string, string>,
} as const;

export type BuyerText = typeof buyerText;

/** Fill in {placeholders}. */
export function fill(text: string, params: Record<string, string | number> = {}): string {
  let out = text;
  for (const [key, value] of Object.entries(params)) out = out.split(`{${key}}`).join(String(value));
  return out;
}
