import Link from 'next/link';
import { Download, MapPin, AlertTriangle } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { countyService, listCrops } from '@/lib/counties/server';
import {
  COLUMNS, buildHighlights, filtersToQuery, formatNumber, genderDescription, genderSegments, harvestCell, parseFilters, sortRows,
  type CountyDetail, type CountyInsights, type CountyRow, type Filters, type Highlight,
} from '@/lib/counties/insights';
import { countyText as T, fill } from '@/lib/counties/en';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const CARD = 'rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm';
const SELECT = 'min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#1E293B]';

const SEGMENT_STYLE: Record<string, string> = {
  male: 'bg-[#15803D]',
  female: 'bg-[#0E7490]',
  // diagonal stripes so the "not recorded" part is not told apart by colour alone
  unrecorded: 'bg-[repeating-linear-gradient(45deg,#94A3B8,#94A3B8_4px,#E2E8F0_4px,#E2E8F0_8px)]',
};

function Message({ title, body, retryHref }: { title: string; body: string; retryHref?: string }) {
  return (
    <div role="alert" className={`${CARD} flex items-start gap-3`}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div>
        <h2 className="text-base font-bold text-[#1E293B]">{title}</h2>
        <p className="mt-1 text-sm text-[#475569]">{body}</p>
        {retryHref ? (
          <a href={retryHref} className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-[#0A1C14] px-4 text-sm font-semibold text-white">
            {T.retry}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function HighlightCard({ h }: { h: Highlight }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-[#64748B]">{h.title}</p>
      {h.empty ? (
        <p className="mt-2 text-lg font-semibold text-[#64748B]">{T.noRecords}</p>
      ) : (
        <>
          <p className="mt-2 text-lg font-bold text-[#1E293B]">
            {h.names.join(' and ')}
            {h.tied ? <span className="ml-2 rounded-full bg-[#DDF0D8] px-2 py-0.5 align-middle text-[11px] font-semibold text-[#0F3D22]">{T.tied}</span> : null}
          </p>
          <p className="mt-1 text-sm font-medium tabular-nums text-[#15803D]">{h.value}</p>
          {h.note ? <p className="mt-2 text-xs text-[#64748B]">{h.note}</p> : null}
        </>
      )}
    </div>
  );
}

function GenderBars({ rows }: { rows: CountyRow[] }) {
  return (
    <section className={CARD} aria-labelledby="gender-heading">
      <h2 id="gender-heading" className="text-base font-bold text-[#1E293B]">{T.genderHeading}</h2>
      <p className="mt-1 text-xs text-[#64748B]">{T.genderHelp}</p>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => {
          const parts = genderSegments(r.farmers_male, r.farmers_female, r.farmers_unrecorded);
          return (
            <li key={r.county_id || 'unassigned'}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-[#1E293B]">{r.county}</span>
                <span className="text-xs tabular-nums text-[#64748B]">{formatNumber(r.farmers)} {T.farmersUnit}</span>
              </div>
              <div role="img" aria-label={genderDescription(r)} className="mt-1 flex h-4 overflow-hidden rounded-full bg-[#F1F5F9]">
                {parts.map((p) => (p.value > 0 ? <div key={p.key} className={SEGMENT_STYLE[p.key]} style={{ width: `${p.pct}%` }} /> : null))}
              </div>
              <p className="mt-1 text-xs tabular-nums text-[#475569]">{parts.map((p) => p.text).join('  ·  ')}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SortHeader({ col, f }: { col: (typeof COLUMNS)[number]; f: Filters }) {
  const active = f.sort === col.key;
  const next = active && f.dir === 'desc' ? 'asc' : active ? 'desc' : col.numeric ? 'desc' : 'asc';
  return (
    <th scope="col" aria-sort={active ? (f.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`whitespace-nowrap px-3 py-3 text-xs font-semibold text-[#475569] ${col.numeric ? 'text-right' : 'text-left'}`}>
      <Link href={`/dashboard/counties?${filtersToQuery(f, { sort: col.key, dir: next as 'asc' | 'desc', county: null })}`} className="inline-flex min-h-[44px] items-center gap-1 hover:text-[#15803D]">
        {col.label}
        {active ? <span aria-hidden="true">{f.dir === 'asc' ? '▲' : '▼'}</span> : null}
      </Link>
    </th>
  );
}

function CountyTable({ data, f }: { data: CountyInsights; f: Filters }) {
  const rows = sortRows(data.counties, f.sort, f.dir);
  const n = data.national;
  const sortLabel = COLUMNS.find((c) => c.key === f.sort)?.label || '';
  const totals: Record<string, number> = {
    farmers: n.farmers, farms: n.farms, harvest_kg: n.harvest_kg, farmers_male: n.farmers_male, farmers_female: n.farmers_female, farmers_unrecorded: n.farmers_unrecorded,
    farms_male: n.farms_male, farms_female: n.farms_female, farms_unrecorded: n.farms_unrecorded,
  };
  return (
    <section className={CARD} aria-labelledby="table-heading">
      <h2 id="table-heading" className="text-base font-bold text-[#1E293B]">{T.tableHeading}</h2>
      <p className="mt-1 text-xs text-[#64748B]">{fill(T.sortedBy, { column: sortLabel, direction: f.dir === 'asc' ? T.ascending : T.descending })}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <caption className="sr-only">{T.tableCaption}</caption>
          <thead>
            <tr className="border-b border-[#E2E8F0]">{COLUMNS.map((c) => <SortHeader key={c.key} col={c} f={f} />)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.county_id || 'unassigned'} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                {COLUMNS.map((c) =>
                  c.key === 'county' ? (
                    <th key={c.key} scope="row" className="whitespace-nowrap px-3 py-1 text-left font-semibold text-[#1E293B]">
                      <Link href={`/dashboard/counties?${filtersToQuery(f, { county: r.county_id || 'unassigned' })}#detail`} className="inline-flex min-h-[44px] items-center text-[#15803D] underline-offset-2 hover:underline" aria-label={fill(T.detailOpen, { county: r.county })}>
                        {r.county}
                      </Link>
                    </th>
                  ) : (
                    <td key={c.key} className="px-3 py-2 text-right tabular-nums text-[#1E293B]">
                      {typeof r[c.key] === 'number' && c.key.startsWith('harvest_kg') ? formatCell(harvestCell(r, r[c.key] as number)) : formatNumber(r[c.key] as number)}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#CBD5E1] bg-[#F8FAFC] font-semibold">
              <th scope="row" className="px-3 py-3 text-left text-[#1E293B]">{T.nationalTotal}</th>
              {COLUMNS.slice(1).map((c) => (
                <td key={c.key} className="px-3 py-3 text-right tabular-nums text-[#1E293B]">{totals[c.key] === undefined ? '' : formatNumber(totals[c.key])}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

const formatCell = (v: string | number) => (typeof v === 'number' ? formatNumber(v) : v);

function DetailPanel({ detail, f }: { detail: CountyDetail; f: Filters }) {
  return (
    <section id="detail" className={CARD} aria-labelledby="detail-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="detail-heading" className="text-base font-bold text-[#1E293B]">{fill(T.detailHeading, { county: detail.county })}</h2>
        <Link href={`/dashboard/counties?${filtersToQuery(f, { county: null })}`} className="inline-flex min-h-[44px] items-center rounded-xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#1E293B]">
          {T.detailClose}
        </Link>
      </div>
      {detail.districts.length === 0 ? (
        <p className="mt-4 text-sm text-[#64748B]">{T.noDistricts}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">{fill(T.detailHeading, { county: detail.county })}</caption>
            <thead>
              <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                <th scope="col" className="px-3 py-3 text-left">{T.colDistrict}</th>
                <th scope="col" className="px-3 py-3 text-right">{T.colFarmers}</th>
                <th scope="col" className="px-3 py-3 text-right">{T.colFarms}</th>
                <th scope="col" className="px-3 py-3 text-right">{T.colHarvest}</th>
                <th scope="col" className="px-3 py-3 text-right">{T.male}</th>
                <th scope="col" className="px-3 py-3 text-right">{T.female}</th>
                <th scope="col" className="px-3 py-3 text-right">{T.notRecordedGender}</th>
              </tr>
            </thead>
            <tbody>
              {detail.districts.map((d) => (
                <tr key={d.district} className="border-b border-[#F1F5F9]">
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-[#1E293B]">{d.district}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(d.farmers)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(d.farms)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.farms > 0 && d.harvests_no_weight > 0 && d.harvest_kg === 0 ? T.notRecorded : formatNumber(d.harvest_kg)}</td>
                  {d.small_group ? (
                    <td colSpan={3} className="px-3 py-2 text-center text-[#64748B]">{T.fewerThan5}</td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(d.farmers_male ?? 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(d.farmers_female ?? 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(d.farmers_unrecorded ?? 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-[#64748B]">{T.detailSmallGroupNote}</p>
      <h3 className="mt-5 text-sm font-bold text-[#1E293B]">{T.topCrops}</h3>
      {detail.top_crops.length === 0 ? (
        <p className="mt-2 text-sm text-[#64748B]">{T.noCrops}</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {detail.top_crops.map((c) => (
            <li key={c.crop} className="flex justify-between text-sm"><span className="font-medium text-[#1E293B]">{c.crop}</span><span className="tabular-nums text-[#15803D]">{formatNumber(c.harvest_kg)} {T.kgUnit}</span></li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Notes({ data }: { data: CountyInsights }) {
  const e = data.excluded;
  return (
    <section className={CARD} aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="text-base font-bold text-[#1E293B]">{T.notesHeading}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#475569]">
        <li>{T.filterNote}</li>
        <li>{fill(T.excludedSamples, { farmers: e.sample_farmers, farms: e.sample_farms, harvests: e.sample_harvests })}</li>
        <li>{fill(T.excludedHarvests, { deleted: e.deleted_harvests, replaced: e.replaced_harvests })}</li>
        {data.national.harvests_no_weight > 0 ? <li>{fill(T.noWeight, { count: data.national.harvests_no_weight })}</li> : null}
        <li>{T.unassignedNote}</li>
      </ul>
    </section>
  );
}

export default async function CountiesPage({ searchParams }: { searchParams: SearchParams }) {
  const f = parseFilters(await searchParams);
  const here = `/dashboard/counties?${filtersToQuery(f)}`;
  const result = await countyService.insights(f);

  let body: React.ReactNode;
  if (result.status === 'signed_out') body = <Message title={T.signedOutTitle} body={T.signedOutBody} />;
  else if (result.status === 'forbidden') body = <Message title={T.forbiddenTitle} body={T.forbiddenBody} />;
  else if (result.status === 'error') body = <Message title={T.errorTitle} body={`${T.errorBody} (${result.message})`} retryHref={here} />;
  else {
    const data = result.data;
    const crops = await listCrops();
    const cropName = f.crop ? crops.find((c) => c.id === f.crop)?.name || null : null;
    const nothing = data.national.farmers === 0 && data.national.farms === 0 && data.national.harvests === 0;
    const detailResult = f.county ? await countyService.detail(f, f.county === 'unassigned' ? null : f.county) : null;
    const thisYear = new Date().getUTCFullYear();
    const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
    if (f.year !== null && !years.includes(f.year)) years.push(f.year);
    const updated = new Date(data.generated_at).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });

    body = (
      <>
        <form method="get" action="/dashboard/counties" className={`${CARD} flex flex-wrap items-end gap-4`} aria-label={T.filtersHeading}>
          <input type="hidden" name="sort" value={f.sort} />
          <input type="hidden" name="dir" value={f.dir} />
          <div>
            <label htmlFor="f-year" className="block text-xs font-semibold text-[#475569]">{T.year}</label>
            <select id="f-year" name="year" defaultValue={f.year === null ? 'all' : String(f.year)} className={SELECT}>
              <option value="all">{T.allYears}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-crop" className="block text-xs font-semibold text-[#475569]">{T.crop}</label>
            <select id="f-crop" name="crop" defaultValue={f.crop || ''} className={SELECT}>
              <option value="">{T.allCrops}</option>
              {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-status" className="block text-xs font-semibold text-[#475569]">{T.status}</label>
            <select id="f-status" name="status" defaultValue={f.status} className={SELECT}>
              <option value="all">{T.allStatuses}</option>
              <option value="approved">{T.approvedOnly}</option>
            </select>
          </div>
          <button type="submit" className="min-h-[44px] rounded-xl bg-[#0A1C14] px-5 text-sm font-semibold text-white">{T.apply}</button>
          <a href={`/dashboard/counties/export?${filtersToQuery(f)}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#1E293B]">
            <Download className="h-4 w-4" aria-hidden="true" />
            {T.download}
          </a>
          <p className="basis-full text-xs text-[#64748B]">{T.filterNote} {cropName ? `(${cropName})` : ''}</p>
        </form>

        {nothing ? (
          <div className={CARD}><p className="text-sm font-semibold text-[#1E293B]">{T.empty}</p></div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {buildHighlights(data).map((h) => <HighlightCard key={h.title} h={h} />)}
            </div>
            <GenderBars rows={data.counties} />
            <CountyTable data={data} f={f} />
            {detailResult ? (
              detailResult.status === 'ok' ? <DetailPanel detail={detailResult.data} f={f} /> : <Message title={T.errorTitle} body={T.errorBody} retryHref={`${here}#detail`} />
            ) : null}
            <Notes data={data} />
          </>
        )}
        <p className="text-xs text-[#64748B]">{T.lastUpdated}: <time dateTime={data.generated_at} className="tabular-nums">{updated} UTC</time></p>
      </>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 tabular-nums">
        <div className="flex items-center gap-3 pt-4">
          <MapPin className="h-6 w-6 text-[#15803D]" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0E2417]">{T.title}</h1>
            <p className="text-sm text-[#52525B]">{T.subtitle}</p>
          </div>
        </div>
        {body}
      </div>
    </AdminLayout>
  );
}
