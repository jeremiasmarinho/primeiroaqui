import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Router } from 'wouter'

import HomeScreen from './HomeScreen'
import { makeProduct, resetFactories } from '../test/factories'
import type { ApiAd, ApiAdsResponse } from '../lib/api'

const EMPTY_ADS: ApiAdsResponse = { heroCarousel: [], highlightStrip: null, sponsoredFeed: [] }

const baseProps = {
  categories: ['Tudo'],
  category: 'Tudo',
  searchQuery: '',
  onSearchChange: () => {},
  onSearchSubmit: () => {},
  favorites: [],
  onToggleFavorite: () => {},
  onAddToCart: () => {},
  cartCount: 0,
  notifications: [],
  notificationCount: 0,
  onNotificationsOpen: () => {},
  onOpenCart: () => {},
  isAuthenticated: false,
}

function makeAd(overrides: Partial<ApiAd> = {}): ApiAd {
  return {
    id: 'feed-1',
    slot: 'SPONSORED_FEED',
    advertiserName: 'Loja Patrocinadora',
    imageUrl: 'https://example.com/feed.jpg',
    linkUrl: 'https://example.com/promo',
    position: 0,
    ...overrides,
  }
}

describe('HomeScreen — anúncios', () => {
  it('sem ads, o grid fica idêntico ao atual (sem cards patrocinados)', () => {
    resetFactories()
    const products = Array.from({ length: 10 }, () => makeProduct())

    render(
      <Router>
        <HomeScreen
          {...baseProps}
          products={products}
          allProducts={products}
          ads={EMPTY_ADS}
        />
      </Router>,
    )

    expect(screen.queryByText('Patrocinado')).not.toBeInTheDocument()
  })

  it('com sponsoredFeed, insere card patrocinado apos o 8o produto', () => {
    resetFactories()
    const products = Array.from({ length: 10 }, () => makeProduct())
    const ads: ApiAdsResponse = {
      heroCarousel: [],
      highlightStrip: null,
      sponsoredFeed: [makeAd()],
    }

    render(
      <Router>
        <HomeScreen
          {...baseProps}
          products={products}
          allProducts={products}
          ads={ads}
        />
      </Router>,
    )

    const catalogo = screen.getByRole('region', { name: /ofertas da cidade/i })
    const items = within(catalogo).getAllByRole('listitem')
    // 10 produtos + 1 card patrocinado apos o 8o produto = 11 itens no grid
    expect(items).toHaveLength(11)
    expect(within(catalogo).getByText('Patrocinado')).toBeInTheDocument()
  })
})
