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

/**
 * Campos comuns a criacao e edicao. Isolados para reuso do `refine` de
 * numero/complemento em `createAddressSchema` e `updateAddressSchema` — a
 * regra e uma so, dos dois lados (criar e editar).
 */
const addressCoreSchema = z.object({
  label: z.string().trim().min(1, 'Label nao pode ser vazio'),
  street: z.string().trim().min(1, 'Rua nao pode ser vazia'),
  number: z.string().trim().optional(),
  complement: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().min(1, 'Cidade nao pode ser vazia'),
  state: z.string().trim().min(1, 'Estado nao pode ser vazio'),
  zipCode: z.string().trim().min(1, 'CEP nao pode ser vazio'),
})

/**
 * Regra de negocio pedida pelo usuario: numero presente -> complemento
 * opcional; sem numero (ex. casa s/n) -> complemento obrigatorio, para o
 * entregador conseguir achar o endereco. Mesma regra em
 * `validateAddressDraft` (src/state/addresses.ts), do lado do cliente.
 */
const withNumberComplementRefine = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  schema.refine(
    (data: z.infer<Schema>) =>
      Boolean((data as { number?: string }).number?.trim()) ||
      Boolean((data as { complement?: string }).complement?.trim()),
    {
      message: 'Sem numero? Descreva um complemento/referencia para o entregador achar o endereco.',
      path: ['complement'],
    },
  )

const createAddressSchema = withNumberComplementRefine(
  addressCoreSchema.extend({
    latitude: z.number(),
    longitude: z.number(),
    isDefault: z.boolean().optional().default(false),
  }),
)

/**
 * Edicao (PATCH /addresses/:id): mesmos campos editaveis do form CEP-first
 * (sem latitude/longitude/isDefault — coordenadas nao mudam por edicao de
 * texto, e o padrao tem rota propria: PATCH /addresses/:id/default).
 */
const updateAddressSchema = withNumberComplementRefine(addressCoreSchema)

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
  const {
    label,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    zipCode,
    latitude,
    longitude,
    isDefault,
  } = parsed.data

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
        number: number?.trim() || null,
        complement: complement?.trim() || null,
        neighborhood: neighborhood?.trim() || null,
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

/**
 * Carrega o endereco e garante posse: 404 se nao existe, 403 se e de outro
 * usuario. Mesmo padrao usado pelas rotas de posse de `stores.ts` — 404 antes
 * de 403 nao vaza a existencia do recurso alheio.
 */
async function loadOwnedAddress(c: Context<AuthEnv>, id: string) {
  const authedUser = c.get('authedUser')
  const address = await prisma.address.findUnique({ where: { id } })
  if (!address) return { error: c.json({ error: 'Endereco nao encontrado' }, 404) } as const
  if (address.userId !== authedUser.id) {
    return { error: c.json({ error: 'Endereco pertence a outro usuario' }, 403) } as const
  }
  return { address } as const
}

addressRoutes.patch('/addresses/:id', requireUser, async (c) => {
  const id = c.req.param('id') ?? ''
  const owned = await loadOwnedAddress(c, id)
  if (owned.error) return owned.error

  const body = await parseJsonBody(c)
  if (body === undefined) {
    return c.json({ error: 'Body invalido ou ausente' }, 400)
  }
  const parsed = updateAddressSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, 400)
  }

  const { label, street, number, complement, neighborhood, city, state, zipCode } = parsed.data
  const address = await prisma.address.update({
    where: { id },
    data: {
      label,
      street,
      number: number?.trim() || null,
      complement: complement?.trim() || null,
      neighborhood: neighborhood?.trim() || null,
      city,
      state,
      zipCode,
    },
  })

  return c.json({ address })
})

/**
 * Definir padrao e rota propria (nao um campo no PATCH generico) porque a
 * operacao tem efeito colateral sobre OUTROS registros (desmarcar os demais)
 * — misturar isso num PATCH de edicao de texto confundiria o contrato.
 */
addressRoutes.patch('/addresses/:id/default', requireUser, async (c) => {
  const id = c.req.param('id') ?? ''
  const owned = await loadOwnedAddress(c, id)
  if (owned.error) return owned.error

  const authedUser = c.get('authedUser')
  const address = await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId: authedUser.id, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    })
    return tx.address.update({ where: { id }, data: { isDefault: true } })
  })

  return c.json({ address })
})

/**
 * Excluir o endereco padrao: promove o mais recente dos que sobraram (mesma
 * regra do `removeAddress` puro em src/state/addresses.ts, do lado do
 * cliente) — a lista nunca fica sem sugestao para o checkout enquanto houver
 * pelo menos um endereco. Se for o unico, remove e o usuario fica sem
 * endereco (esperado).
 */
addressRoutes.delete('/addresses/:id', requireUser, async (c) => {
  const id = c.req.param('id') ?? ''
  const owned = await loadOwnedAddress(c, id)
  if (owned.error) return owned.error

  const authedUser = c.get('authedUser')
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } })
    if (!owned.address.isDefault) return
    const nextDefault = await tx.address.findFirst({
      where: { userId: authedUser.id },
      orderBy: { createdAt: 'desc' },
    })
    if (nextDefault) {
      await tx.address.update({ where: { id: nextDefault.id }, data: { isDefault: true } })
    }
  })

  return c.json({ ok: true })
})
