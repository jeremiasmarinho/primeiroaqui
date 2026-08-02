import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error(
    'Variaveis de ambiente do Supabase ausentes (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE)',
  )
}

/** Cliente com privilegios de usuario final — respeita RLS. Uso: rotas autenticadas por token do usuario. */
export const supabasePublic: SupabaseClient = createClient(url, anonKey)

/** Cliente com service role — ignora RLS. Uso exclusivo: rotas server-side administrativas (nunca expor ao frontend). */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey)
