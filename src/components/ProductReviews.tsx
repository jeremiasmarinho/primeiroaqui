import { Star } from 'lucide-react'
import { averageRating, customerById, reviewsForProduct } from '../data/catalog'
import { fallbackTo } from '../lib/images'

interface ProductReviewsProps {
  productId: number
}

const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5">
    <span className="sr-only">{rating} de 5 estrelas</span>
    {[1, 2, 3, 4, 5].map((position) => (
      <Star
        key={position}
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${
          position <= rating ? 'fill-brand-deep text-brand-deep' : 'text-ink-faint'
        }`}
      />
    ))}
  </span>
)

/**
 * Avaliações do produto. A média é calculada a partir das avaliações reais,
 * não do campo `rating` do catálogo — número exibido que ninguém consegue
 * conferir é o tipo de coisa que corrói confiança na vitrine.
 */
export default function ProductReviews({ productId }: ProductReviewsProps) {
  const list = reviewsForProduct(productId)
  const average = averageRating(productId)

  if (list.length === 0 || average === null) {
    return (
      <section aria-labelledby="avaliacoes" className="mt-5 border-t border-line pt-4">
        <h4 id="avaliacoes" className="font-display text-base font-bold text-ink">
          Avaliações
        </h4>
        <p className="mt-1 text-sm text-ink-muted">
          Este produto ainda não tem avaliações. Compre e seja a primeira pessoa a avaliar.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="avaliacoes" className="mt-5 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <h4 id="avaliacoes" className="font-display text-base font-bold text-ink">
          Avaliações
        </h4>
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Stars rating={Math.round(average)} />
          <span className="tabular font-bold text-ink">{average.toFixed(1)}</span>
          <span className="text-ink-faint">
            ({list.length} {list.length === 1 ? 'avaliação' : 'avaliações'})
          </span>
        </p>
      </div>

      <ul className="mt-3 space-y-3">
        {list.map((review) => {
          const customer = customerById(review.customerId)
          return (
            <li key={review.id} className="flex gap-3 rounded-[16px] bg-surface-page p-3">
              {customer && (
                <img
                  src={customer.avatar}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  onError={fallbackTo(customer.name)}
                  className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{customer?.name ?? 'Cliente'}</span>
                  <Stars rating={review.rating} />
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{review.comment}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
