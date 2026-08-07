/**
 * Mapeamento único do enum de categoria de loja do backend (`StoreCategory`
 * em prisma/schema.prisma) para rótulos pt-BR e ícones. Mesmo padrão de
 * `src/lib/orderStatus.ts` — nenhuma tela traduz/escolhe ícone por conta
 * própria.
 */
import { Store, Croissant, Pill, PawPrint, Carrot, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react'

export const API_STORE_CATEGORIES = [
  'MERCADO',
  'PADARIA',
  'FARMACIA',
  'PETSHOP',
  'HORTIFRUTI',
  'RESTAURANTE',
  'SERVICOS',
  'OUTROS',
] as const

export type ApiStoreCategory = (typeof API_STORE_CATEGORIES)[number]

const LABELS: Record<ApiStoreCategory, string> = {
  MERCADO: 'Mercado',
  PADARIA: 'Padaria',
  FARMACIA: 'Farmácia',
  PETSHOP: 'Petshop',
  HORTIFRUTI: 'Hortifruti',
  RESTAURANTE: 'Restaurante',
  SERVICOS: 'Serviços',
  OUTROS: 'Outros',
}

/** Rótulo pt-BR de uma categoria vinda da API. Categoria desconhecida degrada para o valor cru. */
export const storeCategoryLabel = (category: string): string =>
  (LABELS as Record<string, string>)[category] ?? category

const ICONS: Record<ApiStoreCategory, LucideIcon> = {
  MERCADO: Store,
  PADARIA: Croissant,
  FARMACIA: Pill,
  PETSHOP: PawPrint,
  HORTIFRUTI: Carrot,
  RESTAURANTE: UtensilsCrossed,
  SERVICOS: Wrench,
  OUTROS: Store,
}

/** Ícone de uma categoria vinda da API. Categoria desconhecida degrada para o ícone genérico (Store). */
export const storeCategoryIcon = (category: string): LucideIcon =>
  (ICONS as Record<string, LucideIcon>)[category] ?? Store
