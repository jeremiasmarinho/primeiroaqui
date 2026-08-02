import { Prisma } from '@prisma/client'
import { prisma } from './prismaClient'

/** Parametros aceitos por `searchProducts` — todos opcionais, ja validados/coeridos pela rota. */
export type ProductSearchParams = {
  category?: string
  q?: string
  lat?: number
  lng?: number
  radiusKm?: number
  limit: number
  offset: number
}

/**
 * Busca ids de produtos ativos (de lojas ativas) que atendem aos filtros
 * informados, via SQL raw (necessario para `pg_trgm`/`unaccent` e PostGIS,
 * que o query builder do Prisma nao expõe). Todos os parametros sao
 * interpolados via `Prisma.sql`/tagged template — nunca concatenados como
 * string — entao a interpolacao ja e parametrizada pelo driver.
 *
 * Ordenacao: quando `q` e informado, por relevancia (similaridade) desc;
 * caso contrario, por `"createdAt"` desc com `id` como desempate
 * determinístico (necessario para paginacao estavel).
 *
 * Retorna apenas os ids, na ordem correta — o chamador deve buscar os
 * registros completos via `prisma.product.findMany` e reordenar no codigo,
 * pois o `findMany` com `id: { in: ids } }` nao preserva ordem.
 */
export async function searchProductIds(params: ProductSearchParams): Promise<string[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`s."isActive" = true`,
  ]

  if (params.category !== undefined) {
    conditions.push(Prisma.sql`p.category = ${params.category}`)
  }

  if (params.q !== undefined) {
    conditions.push(Prisma.sql`similarity(unaccent(p.title), unaccent(${params.q})) > 0.2`)
  }

  if (params.lat !== undefined && params.lng !== undefined && params.radiusKm !== undefined) {
    conditions.push(Prisma.sql`
      ST_DWithin(
        ST_MakePoint(s.longitude, s.latitude)::geography,
        ST_MakePoint(${params.lng}, ${params.lat})::geography,
        ${params.radiusKm * 1000}
      )
    `)
  }

  const whereClause = Prisma.join(conditions, ' AND ')

  const orderClause =
    params.q !== undefined
      ? Prisma.sql`ORDER BY similarity(unaccent(p.title), unaccent(${params.q})) DESC`
      : Prisma.sql`ORDER BY p."createdAt" DESC, p.id ASC`

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p."storeId"
    WHERE ${whereClause}
    ${orderClause}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `)

  return rows.map((row) => row.id)
}
