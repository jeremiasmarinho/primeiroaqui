import { Link } from 'wouter'
import type { ApiAd } from '../lib/api'

/**
 * Faixa de destaque vendável: espaço fino (~44px) entre o carrossel de banners
 * e o resto da home. Com anúncio ativo, mostra a peça do anunciante; sem
 * anúncio, cai no fallback "Anuncie aqui" — nunca fica um buraco vazio na tela.
 */
export const ADVERTISE_WHATSAPP_URL =
  'https://wa.me/5500000000000?text=Quero%20anunciar%20no%20Primeiro%20Aqui'

interface HighlightStripProps {
  ad: ApiAd | null
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export default function HighlightStrip({ ad }: HighlightStripProps) {
  if (!ad) {
    return (
      <section className="px-3 pt-4">
        <a
          href={ADVERTISE_WHATSAPP_URL}
          target="_blank"
          rel="noopener sponsored"
          aria-label="Anuncie aqui — sua marca para toda a cidade"
          className="flex min-h-[44px] w-full items-center justify-center rounded-card
                     bg-surface-sunken px-3 py-2.5 text-center shadow-card transition-colors
                     duration-150 hover:bg-line"
        >
          <span className="text-sm font-bold text-ink">
            Anuncie aqui — sua marca para toda a cidade
          </span>
        </a>
      </section>
    )
  }

  const content = (
    <>
      {ad.imageUrl ? (
        <img
          src={ad.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="relative flex w-full items-center justify-between gap-2 px-3 py-2.5">
        <span className="truncate text-sm font-bold text-white drop-shadow">
          {ad.advertiserName}
        </span>
        <span className="shrink-0 rounded bg-black/50 px-1.5 py-0.5 text-micro text-white">
          Publicidade
        </span>
      </div>
    </>
  )

  const wrapperClassName =
    'relative flex min-h-[44px] w-full items-center overflow-hidden rounded-card bg-ink shadow-card'

  if (!ad.linkUrl) {
    return (
      <section className="px-3 pt-4">
        <div aria-label={ad.advertiserName} className={wrapperClassName}>
          {content}
        </div>
      </section>
    )
  }

  const external = isExternalUrl(ad.linkUrl)

  return (
    <section className="px-3 pt-4">
      {external ? (
        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener sponsored"
          aria-label={ad.advertiserName}
          className={wrapperClassName}
        >
          {content}
        </a>
      ) : (
        <Link href={ad.linkUrl} aria-label={ad.advertiserName} className={wrapperClassName}>
          {content}
        </Link>
      )}
    </section>
  )
}
