import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { requireUser, requireStoreOwner, requireAdmin, type AuthEnv } from './auth'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao contra o Supabase/Postgres reais do projeto (sem
 * ambiente de teste separado neste MVP). Os fixtures de usuario usam a API
 * admin do Supabase (nao o fluxo publico de signup), entao nao consomem o
 * limite de envio de e-mail.
 */
describe('middleware de papel (requireUser / requireStoreOwner / requireAdmin)', () => {
  const testApp = new Hono<AuthEnv>()
  testApp.get('/protegido/user', requireUser, (c) => c.json({ ok: true }))
  testApp.get('/protegido/store-owner', requireUser, requireStoreOwner, (c) => c.json({ ok: true }))
  testApp.get('/protegido/admin', requireUser, requireAdmin, (c) => c.json({ ok: true }))

  let buyer: Awaited<ReturnType<typeof createFixtureUser>>
  let storeOwner: Awaited<ReturnType<typeof createFixtureUser>>
  let admin: Awaited<ReturnType<typeof createFixtureUser>>

  const loginToken = async (email: string, password: string) => {
    const { supabasePublic } = await import('../lib/supabaseClient')
    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error(`Falha ao logar fixture: ${error?.message}`)
    return data.session.access_token
  }

  beforeAll(async () => {
    ;[buyer, storeOwner, admin] = await Promise.all([
      createFixtureUser('BUYER'),
      createFixtureUser('STORE_OWNER'),
      createFixtureUser('ADMIN'),
    ])
  }, 30_000)

  afterAll(async () => {
    await Promise.all(
      [buyer, storeOwner, admin].map((fixture) => deleteFixtureUser(fixture.authUserId)),
    )
  })

  it('sem token: 401 em rota que exige requireUser', async () => {
    const res = await testApp.request('/protegido/user')
    expect(res.status).toBe(401)
  })

  it('BUYER acessando rota requireStoreOwner recebe 403', async () => {
    const token = await loginToken(buyer.email, buyer.password)
    const res = await testApp.request('/protegido/store-owner', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('BUYER acessando rota requireAdmin recebe 403', async () => {
    const token = await loginToken(buyer.email, buyer.password)
    const res = await testApp.request('/protegido/admin', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('STORE_OWNER acessando rota requireStoreOwner recebe 200', async () => {
    const token = await loginToken(storeOwner.email, storeOwner.password)
    const res = await testApp.request('/protegido/store-owner', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
  })

  it('STORE_OWNER acessando rota requireAdmin recebe 403', async () => {
    const token = await loginToken(storeOwner.email, storeOwner.password)
    const res = await testApp.request('/protegido/admin', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('ADMIN acessa requireUser, requireStoreOwner e requireAdmin', async () => {
    const token = await loginToken(admin.email, admin.password)
    const headers = { authorization: `Bearer ${token}` }

    const resUser = await testApp.request('/protegido/user', { headers })
    const resStoreOwner = await testApp.request('/protegido/store-owner', { headers })
    const resAdmin = await testApp.request('/protegido/admin', { headers })

    expect(resUser.status).toBe(200)
    expect(resStoreOwner.status).toBe(200)
    expect(resAdmin.status).toBe(200)
  })

  it('token invalido: 401', async () => {
    const res = await testApp.request('/protegido/user', {
      headers: { authorization: 'Bearer token-invalido' },
    })
    expect(res.status).toBe(401)
  })
})
