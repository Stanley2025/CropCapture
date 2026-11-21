import { createServerClientFromEnv } from '@/lib/buyer/handlers';
import { listHarvestPhotos } from '@/lib/buyer/adminPhotos';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Photos of one harvest for the admin portal (administrators only): /api/harvest-photos?harvest_id=... */
export async function GET(request: Request) {
  const harvestId = new URL(request.url).searchParams.get('harvest_id') || '';
  const reply = await listHarvestPhotos(harvestId, {
    client: createServerClientFromEnv(),
    getUser: async () => {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.auth.getUser();
      return data.user ? { id: data.user.id } : null;
    },
  });
  return new Response(reply.body, { status: reply.status, headers: reply.headers });
}
