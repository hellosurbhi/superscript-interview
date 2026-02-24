import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client — uses service role key, never exposed to browser
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
