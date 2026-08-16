import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAds } from './useAds'
import { api } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, api: { ...actual.api, fetchAds: vi.fn() } }
})

const fetchAdsMock = vi.mocked(api.fetchAds)

describe('useAds', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('estado inicial vazio antes da resposta chegar', () => {
    fetchAdsMock.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useAds())

    expect(result.current.ads).toEqual({ heroCarousel: [], highlightStrip: null, sponsoredFeed: [] })
    expect(result.current.isLoading).toBe(true)
  })

  it('busca ao montar e popula ads em caso de sucesso', async () => {
    const ad = {
      id: 'ad-1',
      slot: 'HERO_CAROUSEL' as const,
      advertiserName: 'Loja X',
      imageUrl: 'https://example.com/x.png',
      linkUrl: 'https://example.com',
      position: 0,
    }
    fetchAdsMock.mockResolvedValue({ heroCarousel: [ad], highlightStrip: null, sponsoredFeed: [] })

    const { result } = renderHook(() => useAds())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.ads.heroCarousel).toEqual([ad])
  })

  it('falha silenciosa: erro mantem estado vazio sem lancar', async () => {
    fetchAdsMock.mockRejectedValue(new Error('falhou'))

    const { result } = renderHook(() => useAds())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.ads).toEqual({ heroCarousel: [], highlightStrip: null, sponsoredFeed: [] })
  })
})
