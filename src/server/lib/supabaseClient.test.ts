import { beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE'] as const

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const key of ENV_KEYS) {
      vi.stubEnv(key, undefined)
    }
  })

  it('lanca erro quando SUPABASE_URL esta ausente', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE', 'service-role-key')

    await expect(import('./supabaseClient')).rejects.toThrow(
      /Variaveis de ambiente do Supabase ausentes/,
    )
  })

  it('lanca erro quando SUPABASE_ANON_KEY esta ausente', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE', 'service-role-key')

    await expect(import('./supabaseClient')).rejects.toThrow(
      /Variaveis de ambiente do Supabase ausentes/,
    )
  })

  it('lanca erro quando SUPABASE_SERVICE_ROLE esta ausente', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')

    await expect(import('./supabaseClient')).rejects.toThrow(
      /Variaveis de ambiente do Supabase ausentes/,
    )
  })

  it('cria supabasePublic e supabaseAdmin como instancias distintas', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE', 'service-role-key')

    const { supabasePublic, supabaseAdmin } = await import('./supabaseClient')

    expect(supabasePublic).toBeDefined()
    expect(supabaseAdmin).toBeDefined()
    expect(supabasePublic).not.toBe(supabaseAdmin)
  })
})
