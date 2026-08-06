import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'
import { enterAsClient, goToLoginFromNav, waitForCatalog } from './authTestHelpers'

/**
 * WU-45: o reducer suporta quantidade desde a WU-06, mas a UI não expunha.
 * Estes testes cobrem a ponta visível: controles, subtotal por linha e total.
 */
describe('quantidade no carrinho', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const addFirstProduct = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
  }

  const drawer = () => screen.getByRole('dialog', { name: /carrinho de compras/i })

  it('adicionar abre a gaveta com o item em quantidade 1', async () => {
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()

    expect(within(drawer()).getByText('1')).toBeInTheDocument()
  })

  it('o botao + incrementa e o subtotal da linha acompanha', async () => {
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()

    fireEvent.click(within(drawer()).getByRole('button', { name: /aumentar quantidade/i }))

    expect(within(drawer()).getByText('2')).toBeInTheDocument()
    // O preco unitario nao muda; o subtotal da linha dobra.
    expect(within(drawer()).getByText(/R\$\s?199,90 cada/)).toBeInTheDocument()
    // Aparece duas vezes: subtotal da linha e subtotal do rodape.
    expect(within(drawer()).getAllByText(/R\$\s?399,80/)).toHaveLength(2)
  })

  it('o botao − decrementa sem remover enquanto houver mais de um', async () => {
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(within(drawer()).getByRole('button', { name: /aumentar quantidade/i }))
    fireEvent.click(within(drawer()).getByRole('button', { name: /diminuir quantidade/i }))

    expect(within(drawer()).getByText('1')).toBeInTheDocument()
    expect(within(drawer()).queryByText(/carrinho está vazio/i)).not.toBeInTheDocument()
  })

  it('o botao de lixeira remove a linha inteira, nao so uma unidade', async () => {
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(within(drawer()).getByRole('button', { name: /aumentar quantidade/i }))

    fireEvent.click(within(drawer()).getByRole('button', { name: /remover .+ do carrinho/i }))
    expect(within(drawer()).getByText(/carrinho está vazio/i)).toBeInTheDocument()
  })

  it('o contador da barra inferior soma quantidades, nao linhas', async () => {
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()
    fireEvent.click(within(drawer()).getByRole('button', { name: /aumentar quantidade/i }))
    fireEvent.click(within(drawer()).getByRole('button', { name: /fechar carrinho/i }))

    const nav = screen.getByRole('navigation', { name: /navegação principal/i })
    expect(within(nav).getByRole('button', { name: /carrinho — 2 itens/i })).toBeInTheDocument()
  })

  it('carrinho vazio bloqueia o botao continuar', () => {
    enterAsClient()
    const nav = screen.getByRole('navigation', { name: /navegação principal/i })
    fireEvent.click(within(nav).getByRole('button', { name: /carrinho/i }))

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled()
  })

  it('todos os controles de quantidade tem alvo de toque de 44px', async () => {
    enterAsClient()
    await waitForCatalog()
    addFirstProduct()

    const controls = [
      within(drawer()).getByRole('button', { name: /aumentar quantidade/i }),
      within(drawer()).getByRole('button', { name: /diminuir quantidade/i }),
      within(drawer()).getByRole('button', { name: /remover .+ do carrinho/i }),
    ]

    controls.forEach((control) => {
      expect(control.className).toMatch(/h-11/)
      expect(control.className).toMatch(/w-11/)
    })
  })
})

describe('cupom no checkout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const goToDelivery = async () => {
    render(<MarketplaceApp />)
    goToLoginFromNav()
    fireEvent.click(screen.getByRole('button', { name: /entrar como cliente/i }))
    await waitForCatalog()
    fireEvent.click(screen.getAllByRole('button', { name: /adicionar .+ ao carrinho/i })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
  }

  it('cupom invalido mostra o motivo e nao altera o total', async () => {
    await goToDelivery()

    fireEvent.change(screen.getByLabelText(/cupom de desconto/i), { target: { value: 'NAOEXISTE' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/não encontrado/i)
    // Nenhuma linha de desconto entra no resumo: o total segue inteiro.
    expect(screen.queryByText('Desconto')).not.toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?199,90/).length).toBeGreaterThan(0)
  })

  it('cupom expirado e rejeitado', async () => {
    await goToDelivery()

    fireEvent.change(screen.getByLabelText(/cupom de desconto/i), { target: { value: 'EXPIRADO' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/expirou/i)
  })

  it('cupom valido abate no total e pode ser removido', async () => {
    await goToDelivery()

    fireEvent.change(screen.getByLabelText(/cupom de desconto/i), { target: { value: 'BAIRRO10' } })
    fireEvent.click(screen.getByRole('button', { name: /aplicar/i }))

    // 199,90 - 10% = 179,91
    expect(screen.getByText(/R\$\s?179,91/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remover/i }))
    expect(screen.queryByText(/R\$\s?179,91/)).not.toBeInTheDocument()
  })
})
