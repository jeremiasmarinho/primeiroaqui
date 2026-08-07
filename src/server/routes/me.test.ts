import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { app } from '../app'
import { prisma } from '../lib/prismaClient'
import { supabaseAdmin } from '../lib/supabaseClient'
import { AVATARS_BUCKET } from '../lib/avatarStorage'
import { createFixtureUser, deleteFixtureUser } from '../test/authFixtures'

/**
 * Testes de integracao de POST/DELETE /me/avatar contra Supabase (Storage +
 * Auth) e Postgres reais, mesmo padrao de productPhotos.test.ts. Um usuario
 * fixture por describe, reaproveitado entre os casos.
 */
describe('rotas de avatar de perfil', () => {
  let fixture: Awaited<ReturnType<typeof createFixtureUser>>
  let token: string
  const createdStoragePaths: string[] = []

  beforeAll(async () => {
    fixture = await createFixtureUser('BUYER')
    token = await loginToken(fixture.email, fixture.password)
  }, 30_000)

  afterAll(async () => {
    await deleteFixtureUser(fixture.authUserId)
  })

  afterEach(async () => {
    if (createdStoragePaths.length > 0) {
      await supabaseAdmin.storage.from(AVATARS_BUCKET).remove(createdStoragePaths)
      createdStoragePaths.length = 0
    }
    await prisma.user.update({ where: { id: fixture.user.id }, data: { avatarUrl: null } })
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

  const tinyJpeg = async (): Promise<Buffer> =>
    sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 200, b: 30 } } })
      .jpeg()
      .toBuffer()

  const buildFormData = (file: Buffer, filename: string, type: string) => {
    const formData = new FormData()
    formData.append('file', new File([new Uint8Array(file)], filename, { type }))
    return formData
  }

  const pathFromUrl = (url: string): string => {
    const marker = `/${AVATARS_BUCKET}/`
    return url.slice(url.indexOf(marker) + marker.length)
  }

  describe('POST /me/avatar', () => {
    it('upload valido processa a imagem, sobe pro storage e atualiza avatarUrl (200)', async () => {
      const jpeg = await tinyJpeg()
      const res = await app.request('/me/avatar', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { avatarUrl: string } }
      createdStoragePaths.push(pathFromUrl(body.user.avatarUrl))
      expect(body.user.avatarUrl).toMatch(/^https?:\/\//)

      const dbUser = await prisma.user.findUnique({ where: { id: fixture.user.id } })
      expect(dbUser?.avatarUrl).toBe(body.user.avatarUrl)
    }, 30_000)

    it('segundo upload remove o avatar anterior do storage', async () => {
      const jpeg = await tinyJpeg()
      const firstRes = await app.request('/me/avatar', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'foto1.jpg', 'image/jpeg'),
      })
      const firstBody = (await firstRes.json()) as { user: { avatarUrl: string } }
      const firstPath = pathFromUrl(firstBody.user.avatarUrl)

      const secondRes = await app.request('/me/avatar', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'foto2.jpg', 'image/jpeg'),
      })
      const secondBody = (await secondRes.json()) as { user: { avatarUrl: string } }
      createdStoragePaths.push(pathFromUrl(secondBody.user.avatarUrl))

      const { data: listing } = await supabaseAdmin.storage.from(AVATARS_BUCKET).list(fixture.user.id)
      const names = (listing ?? []).map((entry) => entry.name)
      expect(names).not.toContain(firstPath.split('/')[1])
    }, 30_000)

    it('tipo de arquivo invalido recebe 400, avatarUrl nao muda', async () => {
      const res = await app.request('/me/avatar', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(Buffer.from('nao e imagem'), 'arquivo.txt', 'text/plain'),
      })

      expect(res.status).toBe(400)
      const dbUser = await prisma.user.findUnique({ where: { id: fixture.user.id } })
      expect(dbUser?.avatarUrl).toBeNull()
    }, 30_000)

    it('sem autenticacao recebe 401', async () => {
      const jpeg = await tinyJpeg()
      const res = await app.request('/me/avatar', {
        method: 'POST',
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })
      expect(res.status).toBe(401)
    }, 30_000)
  })

  describe('DELETE /me/avatar', () => {
    it('remove o avatar existente (storage + avatarUrl zerado)', async () => {
      const jpeg = await tinyJpeg()
      const uploadRes = await app.request('/me/avatar', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(jpeg, 'foto.jpg', 'image/jpeg'),
      })
      const uploadBody = (await uploadRes.json()) as { user: { avatarUrl: string } }
      const path = pathFromUrl(uploadBody.user.avatarUrl)
      createdStoragePaths.push(path)

      const deleteRes = await app.request('/me/avatar', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(deleteRes.status).toBe(200)
      const deleteBody = (await deleteRes.json()) as { user: { avatarUrl: string | null } }
      expect(deleteBody.user.avatarUrl).toBeNull()

      const dbUser = await prisma.user.findUnique({ where: { id: fixture.user.id } })
      expect(dbUser?.avatarUrl).toBeNull()

      const { data: listing } = await supabaseAdmin.storage.from(AVATARS_BUCKET).list(fixture.user.id)
      const names = (listing ?? []).map((entry) => entry.name)
      expect(names).not.toContain(path.split('/')[1])
    }, 30_000)

    it('sem avatar previo e idempotente (200, avatarUrl segue null)', async () => {
      const res = await app.request('/me/avatar', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: { avatarUrl: string | null } }
      expect(body.user.avatarUrl).toBeNull()
    }, 30_000)

    it('sem autenticacao recebe 401', async () => {
      const res = await app.request('/me/avatar', { method: 'DELETE' })
      expect(res.status).toBe(401)
    }, 30_000)
  })
})
