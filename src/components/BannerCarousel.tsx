import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'wouter'
import { banners } from '../data/catalog'
import type { ApiAd } from '../lib/api'
import { isExternalUrl } from '../lib/adLinks'

type Tone = 'brand' | 'ink' | 'ship'

interface Banner {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  cta: string
  tone: Tone
}

interface BannerCarouselProps {
  /** Anúncios do slot HERO_CAROUSEL. Vazio/ausente → cai no fallback institucional. */
  ads?: ApiAd[]
}

const tones: Record<Tone, string> = {
  brand: 'bg-gradient-to-br from-brand-soft to-brand text-ink',
  ink: 'bg-gradient-to-br from-ink to-[#2A3138] text-white',
  ship: 'bg-gradient-to-br from-ship to-[#0B7A3B] text-white',
}

/** Slide de anúncio: imagem cobrindo o card + selo "Patrocinado", clicável conforme linkUrl. */
function AdSlide({ ad, index, total }: { ad: ApiAd; index: number; total: number }) {
  const label = `${index + 1} de ${total}: ${ad.advertiserName} — Patrocinado`

  const content = (
    <>
      <img src={ad.imageUrl} alt={ad.advertiserName} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-micro text-white">
        Patrocinado
      </span>
    </>
  )

  const wrapperClassName =
    'relative block h-40 w-[calc(100vw-1.5rem)] max-w-[42rem] overflow-hidden rounded-card shadow-card'

  if (!ad.linkUrl) {
    return (
      <div
        data-index={index}
        role="group"
        aria-roledescription="slide"
        aria-label={label}
        className={wrapperClassName}
      >
        {content}
      </div>
    )
  }

  const external = isExternalUrl(ad.linkUrl)

  if (external) {
    return (
      <a
        data-index={index}
        href={ad.linkUrl}
        target="_blank"
        rel="noopener sponsored"
        aria-label={label}
        className={wrapperClassName}
      >
        {content}
      </a>
    )
  }

  return (
    <Link data-index={index} href={ad.linkUrl} aria-label={label} className={wrapperClassName}>
      {content}
    </Link>
  )
}

/**
 * Carrossel de banners com scroll-snap nativo.
 *
 * Sem autoplay: rotação automática exige controle de pausa (WCAG 2.2.2) e
 * atrapalha quem lê devagar. A navegação é por swipe, por teclado (as bolinhas
 * são botões reais) e o indicador acompanha o scroll via IntersectionObserver.
 */
export default function BannerCarousel({ ads }: BannerCarouselProps = {}) {
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const slides = ads ?? []
  const hasAds = slides.length > 0
  const slideCount = hasAds ? slides.length : banners.length

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = (entry.target as HTMLElement).dataset.index
            if (index !== undefined) setActive(Number(index))
          }
        })
      },
      { root: rail, threshold: 0.6 },
    )

    Array.from(rail.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
    // Reobserva quando o conjunto de slides muda (ads carregam depois do mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAds, slideCount])

  const goTo = (index: number): void => {
    const target = railRef.current?.children[index]
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  return (
    <section aria-roledescription="carrossel" aria-label="Promoções em destaque" className="pt-3">
      <div ref={railRef} className="rail no-scrollbar px-3">
        {hasAds
          ? slides.map((ad, index) => (
              <AdSlide key={ad.id} ad={ad} index={index} total={slideCount} />
            ))
          : (banners as Banner[]).map((banner, index) => (
              <div
                key={banner.id}
                data-index={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} de ${banners.length}: ${banner.title}`}
                className={`w-[calc(100vw-1.5rem)] max-w-[42rem] rounded-card p-4 shadow-card ${tones[banner.tone]}`}
              >
                <p className="text-micro font-extrabold uppercase tracking-[0.18em] opacity-70">
                  {banner.eyebrow}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{banner.title}</h2>
                <p className="mt-1 text-sm opacity-85">{banner.subtitle}</p>
                <button
                  type="button"
                  className={`mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 text-sm font-bold
                              transition-transform duration-150 motion-safe:active:scale-95
                              ${banner.tone === 'brand' ? 'bg-ink text-white' : 'bg-white text-ink'}`}
                >
                  {banner.cta}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
      </div>

      <div className="mt-2 flex justify-center gap-1.5">
        {hasAds
          ? slides.map((ad, index) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ir para o banner ${index + 1}: ${ad.advertiserName}`}
                aria-current={active === index ? 'true' : undefined}
                className="grid h-11 w-6 place-items-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-200
                              ${active === index ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25'}`}
                />
              </button>
            ))
          : (banners as Banner[]).map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ir para o banner ${index + 1}: ${banner.title}`}
                aria-current={active === index ? 'true' : undefined}
                className="grid h-11 w-6 place-items-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-200
                              ${active === index ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25'}`}
                />
              </button>
            ))}
      </div>
    </section>
  )
}
