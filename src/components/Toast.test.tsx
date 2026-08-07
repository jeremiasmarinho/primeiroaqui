import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import ToastStack from './Toast'
import { pushToast, resetToasts } from '../state/useToasts'

describe('ToastStack', () => {
  beforeEach(() => {
    resetToasts()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetToasts()
  })

  it('não renderiza nada sem toasts', () => {
    render(<ToastStack />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mostra um toast empurrado e o remove sozinho após o tempo padrão', () => {
    vi.useFakeTimers()
    render(<ToastStack />)

    act(() => {
      pushToast('Adicionado ao carrinho', 'success')
    })
    expect(screen.getByText('Adicionado ao carrinho')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3499)
    })
    expect(screen.getByText('Adicionado ao carrinho')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByText('Adicionado ao carrinho')).not.toBeInTheDocument()
  })

  it('usa aria-live="polite" para não roubar foco do usuário', () => {
    render(<ToastStack />)
    act(() => {
      pushToast('Favorito salvo', 'success')
    })
    const container = screen.getByText('Favorito salvo').closest('[aria-live]')
    expect(container).toHaveAttribute('aria-live', 'polite')
  })

  it('mostra no máximo 3 toasts simultâneos, mais antigos saem da vista', () => {
    render(<ToastStack />)
    act(() => {
      pushToast('Toast 1', 'info')
      pushToast('Toast 2', 'info')
      pushToast('Toast 3', 'info')
      pushToast('Toast 4', 'info')
    })

    expect(screen.getAllByRole('status')).toHaveLength(3)
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument()
    expect(screen.getByText('Toast 2')).toBeInTheDocument()
    expect(screen.getByText('Toast 3')).toBeInTheDocument()
    expect(screen.getByText('Toast 4')).toBeInTheDocument()
  })

  it('permite fechar um toast manualmente antes do auto-dismiss', () => {
    render(<ToastStack />)
    act(() => {
      pushToast('Endereço salvo', 'success')
    })
    expect(screen.getByText('Endereço salvo')).toBeInTheDocument()

    act(() => {
      screen.getByLabelText('Fechar aviso').click()
    })
    expect(screen.queryByText('Endereço salvo')).not.toBeInTheDocument()
  })
})
