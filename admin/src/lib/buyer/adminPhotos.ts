/**
 * Admin side of harvest photos: look at the photos of a harvest and remove one that breaks the rules.
 *
 * Only a signed-in administrator can do this (checked here, on the server, from the Supabase session and
 * the profile's role). Removing a photo needs a written reason, and the removal is written to audit_logs
 * BEFORE the photo is hidden: who removed which photo of which harvest, when, and why. An administrator
 * can only remove a photo. They cannot change the farmer's records. The farmer's phone receives the removal
 * on its next sync, like any other change.
 */
import { BUCKET, SIGNED_URL_SECONDS, type Reply, type ServerClient } from './handlers';

export const ADMIN_ROLES = ['super_admin', 'agricultural_admin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminDeps {
  client: ServerClient | null;
  /** The signed-in user from the Supabase session cookie, or null. */
  getUser: () => Promise<{ id: string } | null>;
  now?: () => Date;
}

const reply = (status: number, value: unknown): Reply => ({
  status,
  body: JSON.stringify(value),
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
});

type Auth = { ok: true; userId: string; client: ServerClient } | { ok: false; reply: Reply };

export async function authorizeAdmin({ client, getUser }: AdminDeps): Promise<Auth> {
  if (!client) return { ok: false, reply: reply(503, { error: 'not_configured' }) };
  const user = await getUser().catch(() => null);
  if (!user) return { ok: false, reply: reply(401, { error: 'sign_in_required' }) };
  const { data } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!data || !ADMIN_ROLES.includes(data.role)) return { ok: false, reply: reply(403, { error: 'not_allowed' }) };
  return { ok: true, userId: user.id, client };
}

/** Photos of one harvest, with links that expire after 10 minutes. */
export async function listHarvestPhotos(harvestId: string, deps: AdminDeps): Promise<Reply> {
  if (!UUID.test(harvestId || '')) return reply(400, { error: 'bad_request' });
  const auth = await authorizeAdmin(deps);
  if (!auth.ok) return auth.reply;
  const { data, error } = await auth.client
    .from('harvest_photos')
    .select('id, tag, storage_path, size_bytes, created_at')
    .eq('harvest_id', harvestId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) return reply(500, { error: 'read_failed' });
  const rows: any[] = data || [];
  const signed: Record<string, string> = {};
  if (rows.length) {
    const res = await auth.client.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), SIGNED_URL_SECONDS);
    for (const item of res.data || []) if (item && item.path && item.signedUrl && !item.error) signed[item.path] = item.signedUrl;
  }
  return reply(200, { photos: rows.map((r) => ({ id: r.id, tag: r.tag, sizeBytes: r.size_bytes, createdAt: r.created_at, url: signed[r.storage_path] || null })) });
}

export async function removeHarvestPhoto(input: { photoId: string; reason: unknown; ip?: string }, deps: AdminDeps): Promise<Reply> {
  if (!UUID.test(input.photoId || '')) return reply(400, { error: 'bad_request' });
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 3 || reason.length > 300) return reply(400, { error: 'reason_required' });
  const auth = await authorizeAdmin(deps);
  if (!auth.ok) return auth.reply;
  const { client, userId } = auth;
  const now = (deps.now ? deps.now() : new Date()).toISOString();

  const { data: photo } = await client
    .from('harvest_photos')
    .select('id, harvest_id, farm_id, tag, storage_path')
    .eq('id', input.photoId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!photo) return reply(404, { error: 'not_found' });

  // The audit record comes first: if it cannot be written, the photo is not removed.
  const audit = await client.from('audit_logs').insert({
    user_id: userId,
    action: 'harvest_photo_removed_by_admin',
    entity_type: 'harvest_photo',
    entity_id: photo.id,
    details: { harvest_id: photo.harvest_id, farm_id: photo.farm_id, tag: photo.tag, storage_path: photo.storage_path, reason, removed_at: now },
    ip_address: input.ip || null,
  });
  if (audit && audit.error) return reply(500, { error: 'audit_failed' });

  const update = await client.from('harvest_photos').update({ deleted_at: now, updated_at: now }).eq('id', photo.id).is('deleted_at', null);
  if (update && update.error) return reply(500, { error: 'remove_failed' });

  // the file itself is removed too (a failure here leaves an unused file; the buyer page already hides it)
  try {
    await client.storage.from(BUCKET).remove([photo.storage_path]);
  } catch {
    // keep going: the removal is already recorded
  }
  return reply(200, { removed: photo.id });
}
