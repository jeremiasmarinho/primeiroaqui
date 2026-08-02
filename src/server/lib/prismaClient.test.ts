import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaClientCtor = vi.fn()
const prismaPgCtor = vi.fn()

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor(...args: unknown[]) {
      prismaClientCtor(...args)
    }
  },
}))

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor(...args: unknown[]) {
      prismaPgCtor(...args)
    }
  },
}))

describe('prismaClient', () => {
  beforeEach(() => {
    vi.resetModules()
    prismaClientCtor.mockClear()
    prismaPgCtor.mockClear()
    vi.stubEnv('DATABASE_URL', undefined)
  })

  it('lanca erro quando DATABASE_URL esta ausente', async () => {
    await expect(import('./prismaClient')).rejects.toThrow(
      /DATABASE_URL ausente/,
    )
  })

  it('instancia o PrismaPg com a connection string e o PrismaClient com o adapter, sem lancar', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:6543/db')

    const { prisma } = await import('./prismaClient')

    expect(prisma).toBeDefined()
    expect(prismaPgCtor).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@localhost:6543/db',
    })
    expect(prismaClientCtor).toHaveBeenCalledTimes(1)
  })
})
