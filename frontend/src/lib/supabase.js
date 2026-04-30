import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

const isMissingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
if (isMissingEnv) {
  console.error('[LexClause] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set these in Netlify environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'lexclause-auth',
    persistSession: true,
    autoRefreshToken: true,
  },
})
export const supabaseMisconfigured = isMissingEnv
