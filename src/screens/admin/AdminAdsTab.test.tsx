import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ApiAdminAd } from '../../lib/api'
import AdminAdsTab, { deriveAdStatus } from './AdminAdsTab'

const baseAd: ApiAdminAd = {
  id: 'ad-1',
  slot: 'HERO_CAROUSEL',
  advertiserName: 'Loja X',
  imageUrl: 'https://example.com/x.png',
  linkUrl: 'https://example.com',
  position: 0,
  active: true,
  startsAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-08-31T00:00:00.000Z',
}

const NOW = new Date('2026-08-16T12:00:00.000Z')

describe('deriveAdStatus', () => {
  it('Ativo: active=true e dentro da vigência', () => {
    expect(deriveAdStatus(baseAd, NOW)).toBe('ATIVO')
  })

  it('Agendado: startsAt no futuro', () => {
    const ad = { ...baseAd, startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-30T00:00:00.000Z' }
    expect(deriveAdStatus(ad, NOW)).toBe('AGENDADO')
  })

  it('Expirado: endsAt no passado', () => {
    const ad = { ...baseAd, startsAt: '2026-07-01T00:00:00.000Z', endsAt: '2026-07-31T00:00:00.000Z' }
    expect(deriveAdStatus(ad, NOW)).toBe('EXPIRADO')
  })

  it('Inativo: active=false tem precedência mesmo se vigente', () => {
    const ad = { ...baseAd, active: false }
    expect(deriveAdStatus(ad, NOW)).toBe('INATIVO')
  })

  it('Inativo tem precedência sobre Expirado', () => {
    const ad = { ...baseAd, active: false, endsAt: '2026-07-31T00:00:00.000Z' }
    expect(deriveAdStatus(ad, NOW)).toBe('INATIVO')
  })
})

describe('AdminAdsTab', () => {
  it('renderiza lista agrupada por slot com status derivado', () => {
    render(
      <AdminAdsTab
        ads={[baseAd]}
        pendingAdIds={new Set()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onSetActive={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Carrossel do topo' })).toBeInTheDocument()
    expect(screen.getByText('Loja X')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
  })

  it('submit do formulário de criação chama onCreate com payload em ISO', () => {
    const onCreate = vi.fn()
    render(
      <AdminAdsTab
        ads={[]}
        pendingAdIds={new Set()}
        onCreate={onCreate}
        onEdit={vi.fn()}
        onSetActive={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Anunciante'), { target: { value: 'Loja Nova' } })
    fireEvent.change(screen.getByLabelText('URL da imagem'), {
      target: { value: 'https://example.com/nova.png' },
    })
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-09-01T10:00' } })
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-09-30T10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    const payload = onCreate.mock.calls[0]?.[0]
    expect(payload.advertiserName).toBe('Loja Nova')
    expect(payload.imageUrl).toBe('https://example.com/nova.png')
    expect(payload.startsAt).toBe(new Date('2026-09-01T10:00').toISOString())
    expect(payload.endsAt).toBe(new Date('2026-09-30T10:00').toISOString())
  })

  it('botão Desativar chama onSetActive com {active: false}', () => {
    const onSetActive = vi.fn()
    render(
      <AdminAdsTab
        ads={[baseAd]}
        pendingAdIds={new Set()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onSetActive={onSetActive}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Desativar/ }))

    expect(onSetActive).toHaveBeenCalledWith('ad-1', false)
  })
})
