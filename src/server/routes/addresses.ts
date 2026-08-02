import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prismaClient'
import { requireUser, type AuthEnv } from '../middleware/auth'

export const addressRoutes = new Hono<AuthEnv>()

/** Mesmo padrao de `parseJsonBody` em `src/server/routes/stores.ts`. */
async function parseJsonBody(c: Context<AuthEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const createAddressSchema = z.object({
  label: z.string().trim().min(1, 'Label nao pode ser vazio'),
  street: z.string().trim().min(1, 'Rua nao pode ser vazia'),
  city: z.string().trim().min(1, 'Cidade nao pode ser vazia'),
  state: z.string().trim().min(1, 'Estado nao pode ser vazio'),
  zipCode: z.string().trim().min(1, 'CEP nao pode ser vazio'),
  latitude: z.number(),
  longitude: z.number(),
  isDefault: z.boolean().optional().default(false),
})

addressRoutes.post('/addresses', requireUser, async (c) => {
  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = createAddressSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const authedUser = c.get('authedUser')
  const { label, street, city, state, zipCode, latitude, longitude, isDefault } = parsed.data

  // `userId` sempre vem do contexto autenticado, nunca do body.
  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({
        where: { userId: authedUser.id, isDefault: true },
        data: { isDefault: false },
      })
    }
    return tx.address.create({
      data: {
        userId: authedUser.id,
        label,
        street,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        isDefault,
      },
    })
  })

  return c.json({ address }, 201)
})

addressRoutes.get('/me/addresses', requireUser, async (c) => {
  const authedUser = c.get('authedUser')
  const addresses = await prisma.address.findMany({
    where: { userId: authedUser.id },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ addresses })
})
