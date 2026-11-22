/**
 * Loads the Counties numbers on the server, for one signed-in administrator.
 *
 *   1. A real Supabase session is required. (The admin's own sign-in cookie is NOT enough: it can be set by
 *      anyone, so it is not used here.)
 *   2. The database says whether this user is an administrator (is_insights_admin). The same check is repeated
 *      inside the two functions, so asking the database directly does not get around it.
 *   3. The numbers come from admin_county_insights() / admin_county_detail(): finished totals, no rows.
 *   4. The answer is kept for 5 minutes for the same filters (it holds counts only, the same for every
 *      administrator). A different filter is a different key, so it loads fresh. The check in 1 and 2 runs on
 *      every request, so a signed-out user never gets a kept answer.
 * The service key is never used or sent to a browser.
 */
import type { CountyInsights, CountyDetail, Filters } from './insights';

export const CACHE_MS = 5 * 60 * 1000;

export interface RpcClient {
  auth: { getUser(): PromiseLike<{ data: { user: { id: string } | null }; error?: any }> };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
}

export type Loaded<T> =
  | { status: 'ok'; data: T }
  | { status: 'signed_out' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

interface Options { now?: () => number; ttlMs?: number }

export function createCountyService(getClient: () => Promise<RpcClient>, { now = Date.now, ttlMs = CACHE_MS }: Options = {}) {
  const kept = new Map<string, { at: number; value: unknown }>();

  async function authorize(client: RpcClient): Promise<'ok' | 'signed_out' | 'forbidden' | { error: string }> {
    const { data, error } = await client.auth.getUser();
    if (error || !data || !data.user) return 'signed_out';
    const check = await client.rpc('is_insights_admin');
    if (check.error) return { error: String(check.error.message || 'check failed') };
    return check.data === true ? 'ok' : 'forbidden';
  }

  async function run<T>(key: string, fn: string, args: Record<string, unknown>): Promise<Loaded<T>> {
    try {
      const client = await getClient();
      const access = await authorize(client);
      if (access === 'signed_out' || access === 'forbidden') return { status: access };
      if (typeof access === 'object') return { status: 'error', message: access.error };

      const hit = kept.get(key);
      if (hit && now() - hit.at < ttlMs) return { status: 'ok', data: hit.value as T };

      const { data, error } = await client.rpc(fn, args);
      if (error) {
        if (error.code === '42501' || /not_allowed/.test(String(error.message))) return { status: 'forbidden' };
        return { status: 'error', message: String(error.message || 'The database could not answer.') };
      }
      if (!data) return { status: 'error', message: 'The database returned nothing.' };
      kept.set(key, { at: now(), value: data });
      return { status: 'ok', data: data as T };
    } catch (e: any) {
      return { status: 'error', message: String(e && e.message ? e.message : e) };
    }
  }

  const common = (f: Filters) => ({ p_year: f.year, p_crop: f.crop, p_approved_only: f.status === 'approved' });

  return {
    insights: (f: Filters) => run<CountyInsights>(`i|${f.year}|${f.crop}|${f.status}`, 'admin_county_insights', common(f)),
    detail: (f: Filters, countyId: string | null) =>
      run<CountyDetail>(`d|${countyId}|${f.year}|${f.crop}|${f.status}`, 'admin_county_detail', { p_county: countyId, ...common(f) }),
    /** For tests and for "Try again": forget what was kept. */
    clear: () => kept.clear(),
  };
}
