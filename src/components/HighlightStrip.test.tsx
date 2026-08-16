import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Router } from 'wouter'

import HighlightStrip, { ADVERTISE_WHATSAPP_URL } from './HighlightStrip'
import type { ApiAd } from '../lib/api'

const externalAd: ApiAd = {
  id: 'ad-1',
  slot: 'HIGHLIGHT_STRIP',
  advertiserName: 'Loja Exemplo',
  imageUrl: 'https://example.com/banner.jpg',
  linkUrl: 'https://example.com/promo',
  position: 0,
}

const internalAd: ApiAd = {
  id: 'ad-2',
  slot: 'HIGHLIGHT_STRIP',
  advertiserName: 'Loja Interna',
  imageUrl: 'https://example.com/banner2.jpg',
  linkUrl: '/loja/loja-interna',
  position: 0,
}

describe('HighlightStrip', () => {
  it('renderiza anuncio com selo "Publicidade"', () => {
    render(
      <Router>
        <HighlightStrip ad={externalAd} />
      </Router>,
    )

    expect(screen.getByText('Publicidade')).toBeInTheDocument()
    expect(screen.getByText('Loja Exemplo')).toBeInTheDocument()
  })

  it('link externo tem rel="noopener sponsored" e target _blank', () => {
    render(
      <Router>
        <HighlightStrip ad={externalAd} />
      </Router>,
    )

    const link = screen.getByRole('link', { name: /Loja Exemplo.*Publicidade/i })
    expect(link).toHaveAttribute('href', externalAd.linkUrl as string)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener sponsored')
  })

  it('link interno nao abre em nova aba', () => {
    render(
      <Router>
        <HighlightStrip ad={internalAd} />
      </Router>,
    )

    const link = screen.getByRole('link', { name: /Loja Interna.*Publicidade/i })
    expect(link).toHaveAttribute('href', internalAd.linkUrl as string)
    expect(link).not.toHaveAttribute('target')
  })

  it('anuncio sem linkUrl nao e clicavel mas expoe "Publicidade" no nome acessivel', () => {
    const noLinkAd: ApiAd = {
      ...externalAd,
      id: 'ad-3',
      linkUrl: null,
    }

    render(
      <Router>
        <HighlightStrip ad={noLinkAd} />
      </Router>,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: /Loja Exemplo.*Publicidade/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Publicidade')).toBeInTheDocument()
  })

  it('renderiza fallback "Anuncie aqui" sem ad, linkando para o WhatsApp', () => {
    render(
      <Router>
        <HighlightStrip ad={null} />
      </Router>,
    )

    expect(screen.getByText(/Anuncie aqui/i)).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', ADVERTISE_WHATSAPP_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener sponsored')
  })
})
