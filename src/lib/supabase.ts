import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False until .env holds real credentials. UI shows setup instructions instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * The browser client. Runs as the signed-in user, so every row-level security
 * policy in supabase/schema.sql applies. Never create a second client with the
 * service role key in here.
 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
