import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL ausente — necessaria para instanciar o PrismaClient')
}

const adapter = new PrismaPg({ connectionString })

/** Singleton do Prisma Client para toda a aplicacao — nao instanciar PrismaClient em outro lugar. */
export const prisma = new PrismaClient({ adapter })
