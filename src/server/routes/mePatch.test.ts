import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao de PATCH /me (Item 3: editar perfil) contra Supabase
 * (Auth) e Postgres reais, mesmo padrao de me.test.ts (upload de avatar).
 */
describe('PATCH /me', () => {
  let fixture: Awaited<ReturnType<typeof createFixtureUser>>
  let token: string

  beforeAll(async () => {
    fixture = await createFixtureUser('BUYER')
    token = await loginToken(fixture.email, fixture.password)
  }, 30_000)

  afterAll(async () => {
    await deleteFixtureUser(fixture.authUserId)
  })

  const loginToken = async (email: string, password: string) => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = (await res.json()) as { session: { accessToken: string } }
    return body.session.accessToken
  }

  const patch = (body: unknown, authToken: string | null = token) =>
    app.request('/me', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    })

  it('sem autenticacao recebe 401', async () => {
    const res = await patch({ name: 'Novo Nome' }, null)
    expect(res.status).toBe(401)
  })

  it('atualiza nome, telefone e CPF validos e responde o usuario completo (200)', async () => {
    const res = await patch({ name: 'Marcos Editado', phone: '(31) 99999-8888', document: '111.444.777-35' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      user: { id: string; name: string; phone: string | null; document: string | null; email: string; role: string }
    }
    expect(body.user.name).toBe('Marcos Editado')
    expect(body.user.phone).toBe('(31) 99999-8888')
    expect(body.user.document).toBe('111.444.777-35')
    expect(body.user.email).toBe(fixture.email)
    expect(body.user.role).toBe('BUYER')

    const dbUser = await prisma.user.findUnique({ where: { id: fixture.user.id } })
    expect(dbUser?.name).toBe('Marcos Editado')
    expect(dbUser?.phone).toBe('(31) 99999-8888')
    expect(dbUser?.document).toBe('111.444.777-35')
  }, 30_000)

  it('PATCH parcial (so nome) nao mexe em telefone/CPF ja salvos', async () => {
    await patch({ phone: '(21) 98888-7777', document: '111.444.777-35' })
    const res = await patch({ name: 'Segundo Nome' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { name: string; phone: string | null; document: string | null } }
    expect(body.user.name).toBe('Segundo Nome')
    expect(body.user.phone).toBe('(21) 98888-7777')
    expect(body.user.document).toBe('111.444.777-35')
  }, 30_000)

  it('nome vazio recebe 400', async () => {
    const res = await patch({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('CPF invalido (checksum errado) recebe 400', async () => {
    const res = await patch({ document: '111.444.777-36' })
    expect(res.status).toBe(400)
  })

  it('telefone invalido (poucos digitos) recebe 400', async () => {
    const res = await patch({ phone: '123' })
    expect(res.status).toBe(400)
  })

  it('body invalido (nao-JSON) recebe 400', async () => {
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{not json',
    })
    expect(res.status).toBe(400)
  })

  it('enviando phone/document vazios ("") limpa os campos', async () => {
    await patch({ phone: '(31) 99999-8888', document: '111.444.777-35' })
    const res = await patch({ phone: '', document: '' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { phone: string | null; document: string | null } }
    expect(body.user.phone).toBeNull()
    expect(body.user.document).toBeNull()
  }, 30_000)
})
