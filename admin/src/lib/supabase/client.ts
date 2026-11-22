import { createBrowserClient } from '@supabase/ssr';
import { createResilientFetch } from './resilientFetch';

export const isSupabaseConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && url !== 'https://agritrack-liberia-demo.supabase.co' && !url.includes('placeholder'));
};

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://agritrack-liberia-demo.supabase.co';
const SUPABASE_KEY = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_anon_key_for_offline_first_fallback';

// The admin keeps working while the database is missing some columns (see resilientFetch.ts).
const clientOptions = { global: { fetch: createResilientFetch() } };

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(SUPABASE_URL(), SUPABASE_KEY(), clientOptions);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL(), SUPABASE_KEY(), clientOptions);
  }

  return browserClient;
}
