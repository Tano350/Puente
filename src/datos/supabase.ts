import { createClient } from '@supabase/supabase-js'
import type { Database } from './base.ts'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { flowType: 'pkce' } },
)
