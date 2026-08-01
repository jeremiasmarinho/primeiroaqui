import { discountPercent } from '../data/catalog'
import type { Product } from '../types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Separa reais e centavos para renderizar os centavos em sobrescrito. */
const split = (value: number): { reais: string; cents: string } => {
  const [reais = '0', cents = '00'] = brl.format(value).replace('R$', '').trim().split(',')
  return { reais, cents }
}

/**
 * Preço no padrão de marketplace: preço de lista riscado + selo de desconto
 * acima do preço final, com centavos menores.
 *
 * `size` controla a escala; o valor acessível completo vai no aria-label
 * para o leitor de tela não soletrar "R$ 77 90" sem contexto.
 */
type PriceSize = 'sm' | 'md' | 'lg'

interface PriceProps {
  product: Product
  size?: PriceSize
}

export default function Price({ product, size = 'md' }: PriceProps) {
  const off = discountPercent(product)
  const { reais, cents } = split(product.price)

  const scale: Record<PriceSize, { main: string; cents: string; list: string }> = {
    sm: { main: 'text-lg', cents: 'text-[0.6rem]', list: 'text-micro' },
    md: { main: 'text-2xl', cents: 'text-xs', list: 'text-xs' },
    lg: { main: 'text-4xl', cents: 'text-base', list: 'text-sm' },
  }
  const style = scale[size]

  return (
    <div>
      {/* Leitores de tela recebem a frase completa; aria-label em <div> e
          proibido (role generic nao aceita nome acessivel). */}
      <span className="sr-only">
        {brl.format(product.price)}
        {off ? `, ${off} por cento de desconto` : ''}
      </span>
      {product.listPrice > product.price && (
        <p className={`${style.list} tabular text-ink-faint line-through`}>
          {brl.format(product.listPrice)}
        </p>
      )}

      <p className="flex items-start gap-1.5">
        <span aria-hidden="true" className={`${style.main} tabular font-semibold leading-none text-ink`}>
          R$ {reais}
          <sup className={`${style.cents} ml-0.5 font-semibold`}>{cents}</sup>
        </span>
        {off !== null && (
          <span
            aria-hidden="true"
            className={`${style.list} mt-1 font-bold text-ship`}
          >
            {off}% OFF
          </span>
        )}
      </p>
    </div>
  )
}
