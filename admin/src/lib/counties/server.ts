import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createCountyService, type RpcClient } from './service';

/** One service for the whole server process, so the 5-minute kept answer is shared by every request. */
export const countyService = createCountyService(async () => (await createServerSupabaseClient()) as unknown as RpcClient);

/** The crops for the filter list (names only). Returns [] if the list cannot be read. */
export async function listCrops(): Promise<Array<{ id: string; name: string }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from('crops').select('id, name').order('name');
    return (data || []) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
}
