import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

export function createEphemeralClient(persist = false) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: Boolean(persist),
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: persist ? window.localStorage : undefined,
    },
  });
}
