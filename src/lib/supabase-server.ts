import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

// Log on every cold start so Vercel Function logs show exactly what's present
console.log('[supabase-server] NEXT_PUBLIC_SUPABASE_URL:', url ?? 'UNDEFINED')
console.log('[supabase-server] SUPABASE_SERVICE_ROLE_KEY set:', !!key)

if (!url || !key) {
  throw new Error(
    `Missing Supabase env vars — URL: ${url ?? 'undefined'}, SERVICE_ROLE_KEY: ${key ? 'set' : 'MISSING'}`
  )
}

// Server-only Supabase client — uses service role key, never exposed to browser
export const supabaseServer = createClient(url, key)
