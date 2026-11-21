/**
 * The public buyer page, as plain HTML. No scripts, no tracking, one small inline stylesheet, so it loads
 * fast on a slow connection and the facts show even if the photos never arrive.
 *
 * Two allowlists protect the farmer: the database function get_buyer_page() only returns the fields below,
 * and toBuyerView() picks them again field by field here. Anything else on a record, now or added later,
 * never reaches the page or the JSON.
 */
import { buyerText as text, fill } from './en';

export const CODE_PATTERN = /^[A-Za-z0-9_-]{12,64}$/;
export const isValidCode = (code: unknown): code is string => typeof code === 'string' && CODE_PATTERN.test(code);

export interface BuyerPhoto { id: string; tag: string; url: string }
export interface BuyerActivity { type: string; date: string }
export interface BuyerView {
  batchId: string | null;
  crop: string | null;
  variety: string | null;
  quantity: number | null;
  unit: string | null;
  harvestDate: string | null;
  approved: boolean;
  district: string | null;
  county: string | null;
  farmer: string | null;
  photos: BuyerPhoto[];
  activities: BuyerActivity[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
const TAGS = ['bags', 'grain', 'heap', 'field', 'other'];

/**
 * The allowlist. `row` is what get_buyer_page() returned; `signedUrls` maps a storage path to its
 * short-lived link. Photos with no link are left out.
 */
export function toBuyerView(row: any, signedUrls: Record<string, string> = {}): BuyerView | null {
  if (!row || typeof row !== 'object') return null;
  const quantity = Number(row.quantity);
  return {
    batchId: str(row.batch_id),
    crop: str(row.crop),
    variety: str(row.variety),
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit: str(row.unit),
    harvestDate: str(row.harvest_date) ? String(row.harvest_date).slice(0, 10) : null,
    approved: row.approved === true,
    district: str(row.district),
    county: str(row.county),
    farmer: str(row.farmer),
    photos: (Array.isArray(row.photos) ? row.photos : [])
      .filter((p: any) => p && typeof p.path === 'string' && signedUrls[p.path])
      .map((p: any) => ({ id: String(p.id), tag: TAGS.includes(p.tag) ? p.tag : 'other', url: signedUrls[p.path] })),
    activities: (Array.isArray(row.activities) ? row.activities : [])
      .filter((a: any) => a && str(a.type) && str(a.date))
      .map((a: any) => ({ type: String(str(a.type)), date: String(a.date).slice(0, 10) })),
  };
}

export const escapeHtml = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''} ${m[1]}` : iso || '';
}

const formatWeight = (v: BuyerView) => (v.quantity === null ? null : `${v.quantity.toLocaleString('en-US')} ${v.unit || 'kg'}`);

const CSS = `
:root{--primary:#1B7F36;--dark:#0F3D22;--text:#17301F;--muted:#5B6F61;--bg:#F3F8F1;--border:#E1ECDD;--tint:#DDF0D8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
header{background:var(--primary);color:#fff;padding:14px 16px;font-weight:800;font-size:18px}
main{max-width:560px;margin:0 auto;padding:16px}
h1{font-size:24px;line-height:1.2;margin:16px 0 8px}
h2{font-size:17px;margin:0 0 8px}
.chip{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;font-weight:700;font-size:13px}
.ok{background:var(--tint);color:var(--dark)}
.wait{background:#fff;border:1px solid var(--border);color:var(--muted)}
.card{background:#fff;border:1px solid var(--border);border-radius:20px;padding:16px;margin-top:12px}
.photos{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}
.photo{position:relative;flex:0 0 86%;scroll-snap-align:center;margin:0}
.photo img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:16px;background:var(--tint)}
.photo figcaption{position:absolute;left:10px;bottom:10px;background:var(--dark);color:#fff;border-radius:999px;padding:2px 12px;font-size:12px;font-weight:700}
.none{display:flex;align-items:center;justify-content:center;height:140px;border-radius:16px;background:var(--tint);color:var(--muted)}
dl{margin:0}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--border)}.row:last-child{border-bottom:0}
dt{color:var(--muted);font-size:14px}dd{margin:0;font-weight:700;text-align:right}
ul{list-style:none;margin:0;padding:0}li{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)}li:last-child{border-bottom:0}
.date{color:var(--muted);font-size:13px;min-width:92px}.type{font-weight:700}
.note{color:var(--muted);font-size:13px;margin:16px 0}
a{color:var(--primary);font-weight:700}
a.report{display:inline-flex;align-items:center;min-height:44px}
label{display:block;font-weight:700;margin:12px 0 4px}
textarea,input[type=text]{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--border);border-radius:12px;min-height:44px;background:#fff;color:var(--text)}
button{margin-top:14px;min-height:48px;padding:0 24px;border:0;border-radius:999px;background:var(--primary);color:#fff;font:inherit;font-weight:800;cursor:pointer}
.hp{position:absolute;left:-9999px;height:0;overflow:hidden}
.thanks{background:var(--tint);color:var(--dark);border-radius:16px;padding:12px 16px;font-weight:700;margin-top:12px}
`.replace(/\n/g, '');

function shell(title: string, description: string, body: string, extraHead = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">` +
    `<meta name="description" content="${escapeHtml(description)}">${extraHead}<style>${CSS}</style></head><body>` +
    `<header>${escapeHtml(text.siteName)}</header><main>${body}</main></body></html>`;
}

/** The page for an unknown, malformed or removed code. The same page for all of them. */
export function renderNotFound(): string {
  return shell(text.notFoundTitle, text.notFoundBody, `<h1>${escapeHtml(text.notFoundTitle)}</h1><p>${escapeHtml(text.notFoundBody)}</p>`);
}

export function renderTooMany(): string {
  return shell(text.tooMany, text.tooMany, `<p>${escapeHtml(text.tooMany)}</p>`);
}

export function renderBuyerPage(view: BuyerView, opts: { code: string; reported?: boolean }): string {
  const title = view.crop ? fill(text.pageTitle, { crop: view.crop, batchId: view.batchId || '' }) : fill(text.pageTitleNoCrop, { batchId: view.batchId || '' });
  const weight = formatWeight(view);
  const description = fill(text.ogDescription, { weight: weight || '', date: formatDate(view.harvestDate) });
  const og =
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${escapeHtml(text.siteName)}">` +
    `<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">`;

  const photos = view.photos.length
    ? `<div class="photos">${view.photos
        .map(
          (p) =>
            `<figure class="photo"><img src="${escapeHtml(p.url)}" loading="lazy" decoding="async" alt="${escapeHtml(fill(text.photoAlt, { tag: text.tags[p.tag] || text.tags.other }))}">` +
            `<figcaption>${escapeHtml(text.tags[p.tag] || text.tags.other)}</figcaption></figure>`
        )
        .join('')}</div>`
    : `<div class="none">${escapeHtml(text.noPhotos)}</div>`;

  const grownIn = [view.district, view.county].filter(Boolean).join(', ');
  const facts: Array<[string, string | null]> = [
    [text.batchId, view.batchId],
    [text.weight, weight],
    [text.harvestDate, view.harvestDate ? formatDate(view.harvestDate) : null],
    [text.grownIn, grownIn || null],
    [text.farmer, view.farmer],
  ];
  const factRows = facts
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('');

  const activities = view.activities.length
    ? `<ul>${view.activities.map((a) => `<li><span class="date">${escapeHtml(formatDate(a.date))}</span><span class="type">${escapeHtml(a.type)}</span></li>`).join('')}</ul>`
    : `<p class="note" style="margin:0">${escapeHtml(text.noActivities)}</p>`;

  const code = escapeHtml(opts.code);
  const report =
    `<div class="card" id="report"><h2>${escapeHtml(text.reportHeading)}</h2>` +
    (opts.reported
      ? `<div class="thanks" role="status">${escapeHtml(text.reportThanks)}</div>`
      : `<p class="note" style="margin:0 0 4px">${escapeHtml(text.reportHelp)}</p>` +
        `<form method="post" action="/b/${code}/report">` +
        `<label for="m">${escapeHtml(text.reportMessage)}</label><textarea id="m" name="message" rows="4" maxlength="1000" required></textarea>` +
        `<label for="c">${escapeHtml(text.reportContact)}</label><input id="c" name="contact" type="text" maxlength="200" autocomplete="off">` +
        `<div class="hp" aria-hidden="true"><label>Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>` +
        `<button type="submit">${escapeHtml(text.reportSend)}</button></form>`) +
    `</div>`;

  const body =
    `${photos}` +
    `<h1>${escapeHtml([view.crop, view.variety].filter(Boolean).join(' · ') || text.siteName)}</h1>` +
    `<span class="chip ${view.approved ? 'ok' : 'wait'}">${escapeHtml(view.approved ? text.statusApproved : text.statusAwaiting)}</span>` +
    `<section class="card"><h2>${escapeHtml(text.factsHeading)}</h2><dl>${factRows}</dl></section>` +
    `<section class="card"><h2>${escapeHtml(text.howGrown)}</h2>${activities}</section>` +
    `<p class="note">${escapeHtml(text.footerNote)}</p>` +
    `<a class="report" href="#report">${escapeHtml(text.reportLink)}</a>` +
    report;

  return shell(title, description, body, og);
}
