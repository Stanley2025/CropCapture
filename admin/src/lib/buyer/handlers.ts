/**
 * Request handling for the public buyer page. The route files only translate a Request into these calls,
 * so the rules (generic "not found", rate limits, signed photo links, what is returned) can be tested
 * without starting a server.
 *
 * Data comes from the database function get_buyer_page(), which only the server role can call. The
 * farmer tables themselves are never read from here, and row level security stays on for them.
 */
import { createClient } from '@supabase/supabase-js';
import { isValidCode, renderBuyerPage, renderNotFound, renderTooMany, toBuyerView, type BuyerView } from './page';

export const BUCKET = 'harvest-photos';
export const SIGNED_URL_SECONDS = 600;

export interface ServerClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
  from(table: string): any;
  storage: { from(bucket: string): { createSignedUrls(paths: string[], seconds: number): PromiseLike<{ data: any; error: any }> } };
}

/** The server-side database client. Needs SUPABASE_SERVICE_ROLE_KEY, which is never sent to a browser. */
export function createServerClientFromEnv(): ServerClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as ServerClient;
}

// --- rate limiting (per IP, in memory) -------------------------------------------------------------------

export interface Limiter { allow(key: string): boolean }
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }: { limit: number; windowMs: number; now?: () => number }): Limiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string) {
      const t = now();
      const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
      return true;
    },
  };
}

export const pageLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
export const reportLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0].trim() : headers.get('x-real-ip')) || 'unknown';
}

// --- responses ---------------------------------------------------------------------------------------------

export interface Reply { status: number; headers: Record<string, string>; body: string }

const SAFE_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow',
  // signed photo links are short-lived, so a copy of this page must not be kept
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; img-src https:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
const html = (status: number, body: string, extra: Record<string, string> = {}): Reply => ({ status, body, headers: { ...SAFE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', ...extra } });
const json = (status: number, value: unknown): Reply => ({ status, body: JSON.stringify(value), headers: { ...SAFE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });

/** The same answer for a malformed code, an unknown code and a removed harvest. */
export const notFoundReply = (): Reply => html(404, renderNotFound());
const notFoundJson = (): Reply => json(404, { error: 'not_found' });

// --- loading ---------------------------------------------------------------------------------------------------

/** The buyer's view of a harvest, with photo links that expire after 10 minutes. */
export async function loadBuyerView(code: string, client: ServerClient | null): Promise<{ view: BuyerView; harvestId: string | null } | null> {
  if (!isValidCode(code) || !client) {
    if (!client) console.error('Buyer page: SUPABASE_SERVICE_ROLE_KEY is not set on the server');
    return null;
  }
  const { data, error } = await client.rpc('get_buyer_page', { p_code: code });
  if (error || !data) return null;

  const paths: string[] = (Array.isArray(data.photos) ? data.photos : []).map((p: any) => p && p.path).filter((p: unknown): p is string => typeof p === 'string');
  const signed: Record<string, string> = {};
  if (paths.length) {
    const res = await client.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const item of res.data || []) if (item && item.path && item.signedUrl && !item.error) signed[item.path] = item.signedUrl;
  }
  const view = toBuyerView(data, signed);
  return view ? { view, harvestId: typeof data.harvest_id === 'string' ? data.harvest_id : null } : null;
}

export interface BuyerRequest { code: string; ip: string; reported?: boolean }
interface Deps { client: ServerClient | null; limiter?: Limiter }

export async function getBuyerPage(req: BuyerRequest, { client, limiter = pageLimiter }: Deps): Promise<Reply> {
  if (!limiter.allow(req.ip)) return html(429, renderTooMany(), { 'Retry-After': '60' });
  const found = await loadBuyerView(req.code, client).catch(() => null);
  return found ? html(200, renderBuyerPage(found.view, { code: req.code, reported: Boolean(req.reported) })) : notFoundReply();
}

export async function getBuyerJson(req: BuyerRequest, { client, limiter = pageLimiter }: Deps): Promise<Reply> {
  if (!limiter.allow(req.ip)) return json(429, { error: 'too_many_requests' });
  const found = await loadBuyerView(req.code, client).catch(() => null);
  return found ? json(200, found.view) : notFoundJson();
}

/** The older scan address /verify/{qr_token}: send the visitor on to the new /b/{code} page. */
export async function legacyRedirect(token: string, ip: string, { client, limiter = pageLimiter }: Deps): Promise<Reply> {
  if (!limiter.allow(ip)) return html(429, renderTooMany(), { 'Retry-After': '60' });
  if (!client || typeof token !== 'string' || token.length < 3 || token.length > 120) return notFoundReply();
  const { data, error } = await client.rpc('public_code_for_token', { p_token: token });
  if (error || !isValidCode(data)) return notFoundReply();
  return { status: 302, body: '', headers: { ...SAFE_HEADERS, Location: `/b/${data}` } };
}

/** "Report a problem". Always answers the same way, so nobody can use it to find out which codes exist. */
export async function postReport(req: { code: string; ip: string; message: unknown; contact: unknown; website: unknown }, { client, limiter = reportLimiter }: Deps): Promise<Reply> {
  if (!isValidCode(req.code)) return notFoundReply();
  if (!limiter.allow(req.ip)) return html(429, renderTooMany(), { 'Retry-After': '600' });
  const message = typeof req.message === 'string' ? req.message.trim() : '';
  const contact = typeof req.contact === 'string' && req.contact.trim() ? req.contact.trim().slice(0, 200) : null;
  const robot = typeof req.website === 'string' && req.website.trim() !== '';
  if (!robot && message.length >= 3 && message.length <= 1000 && client) {
    const found = await loadBuyerView(req.code, client).catch(() => null);
    if (found) {
      // optional contact is stored only because the buyer typed it; nothing else about the buyer is kept
      await client.from('buyer_reports').insert({ harvest_id: found.harvestId, public_code: req.code, message, contact });
    }
  }
  return { status: 303, body: '', headers: { ...SAFE_HEADERS, Location: `/b/${req.code}?reported=1` } };
}
