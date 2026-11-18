import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace or configure with custom project keys
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://agritrack-liberia-demo.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_anon_key_for_offline_first_fallback';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
    process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://agritrack-liberia-demo.supabase.co'
  );
};
