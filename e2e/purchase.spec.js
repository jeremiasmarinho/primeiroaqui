import { expect, test } from '@playwright/test'

/** Autentica pelo formulario real: o build de producao nao expoe atalhos de dev. */
const entrar = async (page, nome = 'Ana Paula') => {
  await page.goto('/')
  // "Criar conta" aparece duas vezes: a aba e o submit. O submit e o ultimo.
  await page.getByRole('button', { name: /^criar conta$/i }).first().click()
  await page.getByLabel('Seu nome').fill(nome)
  await page.getByLabel('E-mail').fill('ana@teste.com')
  await page.getByLabel('Senha').fill('segredo123')
  await page.getByRole('button', { name: /^criar conta$/i }).last().click()
  await page.getByRole('navigation', { name: /navegação principal/i }).waitFor()
}


/**
 * WU-51 — fluxo de compra ponta a ponta.
 *
 * Sem `waitForTimeout` em nenhum ponto: todo `expect` do Playwright reexecuta
 * sozinho até passar ou estourar o timeout. Espera fixa é a principal fonte de
 * teste instável.
 */
test.describe('compra', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page)
  })

  test('busca, adiciona, aplica cupom e finaliza', async ({ page }) => {
    await page.getByLabel(/buscar produtos, lojas ou categorias/i).fill('ventilador')

    await page
      .getByRole('button', { name: /adicionar ventilador .* ao carrinho/i })
      .first()
      .click()

    const drawer = page.getByRole('dialog', { name: /carrinho de compras/i })
    await expect(drawer).toBeVisible()

    await drawer.getByRole('button', { name: /aumentar quantidade/i }).click()
    await expect(drawer.getByText('2', { exact: true })).toBeVisible()

    await drawer.getByRole('button', { name: /continuar/i }).click()

    await page.getByLabel('Cupom de desconto').fill('BAIRRO10')
    await page.getByRole('button', { name: /aplicar/i }).click()
    await expect(page.getByText('Desconto', { exact: true })).toBeVisible()

    await page.getByLabel('Seu nome').fill('Ana Paula')
    await page.getByLabel('Endereço').fill('Rua das Flores, 12')
    await page.getByLabel('Cidade').fill('Centro')
    await page.getByLabel('CEP').fill('01310-100')
    await page.getByRole('button', { name: /confirmar compra/i }).click()

    await expect(page.getByText(/rastreamento ativo/i)).toBeVisible()
    await expect(page.getByText('Ana Paula')).toBeVisible()
  })

  test('checkout rejeita CEP invalido com mensagem de recuperacao', async ({ page }) => {
    await page
      .getByRole('button', { name: /adicionar .* ao carrinho/i })
      .first()
      .click()
    await page.getByRole('button', { name: /continuar/i }).click()

    await page.getByLabel('Seu nome').fill('Ana')
    await page.getByLabel('Endereço').fill('Rua 1')
    await page.getByLabel('Cidade').fill('Centro')
    await page.getByLabel('CEP').fill('123')
    await page.getByRole('button', { name: /confirmar compra/i }).click()

    await expect(page.getByRole('alert')).toContainText(/cep valido/i)
    await expect(page.getByText(/rastreamento ativo/i)).toBeHidden()
  })

  test('carrinho vazio nao avanca', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /navegação principal/i })
    await nav.getByRole('button', { name: /carrinho/i }).click()

    await expect(page.getByRole('button', { name: /continuar/i })).toBeDisabled()
    await expect(page.getByText(/carrinho está vazio/i)).toBeVisible()
  })
})
