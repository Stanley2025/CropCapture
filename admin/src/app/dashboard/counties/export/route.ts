import { countyService, listCrops } from '@/lib/counties/server';
import { parseFilters, toCsv } from '@/lib/counties/insights';

export const dynamic = 'force-dynamic';

/**
 * "Download CSV": the table for the filters in the address. Same access rule as the page: a signed-in
 * administrator only. The file has the table's columns and, on the last line, the filters and the time.
 */
export async function GET(request: Request) {
  const f = parseFilters(new URL(request.url).searchParams);
  const result = await countyService.insights(f);
  if (result.status === 'signed_out') return new Response('Sign in with an administrator account.', { status: 401 });
  if (result.status === 'forbidden') return new Response('Only administrators can download this.', { status: 403 });
  if (result.status === 'error') return new Response('The county numbers could not be loaded.', { status: 502 });

  const crops = f.crop ? await listCrops() : [];
  const cropName = f.crop ? crops.find((c) => c.id === f.crop)?.name || null : null;
  const created = new Date();
  const csv = toCsv(result.data, f, cropName, created);
  const stamp = created.toISOString().slice(0, 10);
  return new Response('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="farmtori-counties-${f.year === null ? 'all-years' : f.year}-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
