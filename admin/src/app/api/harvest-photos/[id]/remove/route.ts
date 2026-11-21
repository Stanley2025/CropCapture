import { clientIp, createServerClientFromEnv } from '@/lib/buyer/handlers';
import { removeHarvestPhoto } from '@/lib/buyer/adminPhotos';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Remove a photo that breaks the rules. Administrators only; a written reason is required and logged. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reply = await removeHarvestPhoto(
    { photoId: id, reason: body?.reason, ip: clientIp(request.headers) },
    {
      client: createServerClientFromEnv(),
      getUser: async () => {
        const supabase = await createServerSupabaseClient();
        const { data } = await supabase.auth.getUser();
        return data.user ? { id: data.user.id } : null;
      },
    }
  );
  return new Response(reply.body, { status: reply.status, headers: reply.headers });
}
