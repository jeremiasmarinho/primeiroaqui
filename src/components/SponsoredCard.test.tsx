import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Router } from 'wouter'

import SponsoredCard from './SponsoredCard'
import type { ApiAd } from '../lib/api'

const adExternal: ApiAd = {
  id: 'feed-1',
  slot: 'SPONSORED_FEED',
  advertiserName: 'Loja Patrocinadora',
  imageUrl: 'https://example.com/feed.jpg',
  linkUrl: 'https://example.com/promo',
  position: 0,
}

const adInternal: ApiAd = {
  id: 'feed-2',
  slot: 'SPONSORED_FEED',
  advertiserName: 'Loja Interna',
  imageUrl: 'https://example.com/feed2.jpg',
  linkUrl: '/loja/loja-interna',
  position: 1,
}

const adNoLink: ApiAd = {
  id: 'feed-3',
  slot: 'SPONSORED_FEED',
  advertiserName: 'Loja Sem Link',
  imageUrl: 'https://example.com/feed3.jpg',
  linkUrl: null,
  position: 2,
}

describe('SponsoredCard', () => {
  it('exibe o selo "Patrocinado" sempre visível', () => {
    render(
      <Router>
        <SponsoredCard ad={adExternal} />
      </Router>,
    )

    expect(screen.getByText('Patrocinado')).toBeInTheDocument()
    expect(screen.getByText('Loja Patrocinadora')).toBeInTheDocument()
  })

  it('ad externo abre em nova aba com rel sponsored', () => {
    render(
      <Router>
        <SponsoredCard ad={adExternal} />
      </Router>,
    )

    const link = screen.getByRole('link', { name: /Loja Patrocinadora.*Patrocinado/i })
    expect(link).toHaveAttribute('href', adExternal.linkUrl as string)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener sponsored')
  })

  it('ad interno usa Link do wouter, sem abrir nova aba', () => {
    render(
      <Router>
        <SponsoredCard ad={adInternal} />
      </Router>,
    )

    const link = screen.getByRole('link', { name: /Loja Interna.*Patrocinado/i })
    expect(link).toHaveAttribute('href', adInternal.linkUrl as string)
    expect(link).not.toHaveAttribute('target')
  })

  it('ad sem linkUrl nao e clicavel', () => {
    render(
      <Router>
        <SponsoredCard ad={adNoLink} />
      </Router>,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Loja Sem Link.*Patrocinado/i })).toBeInTheDocument()
  })
})
