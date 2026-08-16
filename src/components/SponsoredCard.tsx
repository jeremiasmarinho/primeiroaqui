import { Link } from 'wouter'
import type { ApiAd } from '../lib/api'
import { isExternalUrl } from '../lib/adLinks'

/**
 * Card patrocinado no formato do grid de catálogo — mesmo footprint do
 * `ProductCard` (imagem quadrada + rodapé), mas com selo "Patrocinado" sempre
 * visível para não confundir com produto orgânico.
 */
interface SponsoredCardProps {
  ad: ApiAd
}

export default function SponsoredCard({ ad }: SponsoredCardProps) {
  const accessibleName = `${ad.advertiserName} — Patrocinado`

  const content = (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-surface-sunken">
        <img
          src={ad.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <span className="absolute right-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-micro text-white">
          Patrocinado
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2-fallback text-sm leading-snug text-ink">{ad.advertiserName}</p>
      </div>
    </>
  )

  const wrapperClassName =
    'group relative flex flex-col overflow-hidden rounded-card bg-surface shadow-card transition-shadow duration-200 hover:shadow-raised'

  if (!ad.linkUrl) {
    return (
      <article role="group" aria-label={accessibleName} className={wrapperClassName}>
        {content}
      </article>
    )
  }

  const external = isExternalUrl(ad.linkUrl)

  if (external) {
    return (
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener sponsored"
        aria-label={accessibleName}
        className={wrapperClassName}
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={ad.linkUrl} aria-label={accessibleName} className={wrapperClassName}>
      {content}
    </Link>
  )
}
