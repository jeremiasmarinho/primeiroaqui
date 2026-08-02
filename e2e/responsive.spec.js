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


test.use({ viewport: { width: 375, height: 812 } })

test.describe('mobile 375px', () => {
  test('compra completa cabe na tela sem scroll horizontal', async ({ page }) => {
    await entrar(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow, 'a home nao pode rolar horizontalmente em 375px').toBe(false)

    await page
      .getByRole('button', { name: /adicionar .* ao carrinho/i })
      .first()
      .click()
    await page.getByRole('button', { name: /continuar/i }).click()

    await page.getByLabel('Seu nome').fill('Ana')
    await page.getByLabel('Endereço').fill('Rua 1')
    await page.getByLabel('Cidade').fill('Centro')
    await page.getByLabel('CEP').fill('01310-100')
    await page.getByRole('button', { name: /confirmar compra/i }).click()

    await expect(page.getByText(/rastreamento ativo/i)).toBeVisible()
  })

  test('a barra inferior permanece acessivel apos rolar', async ({ page }) => {
    await entrar(page)

    const nav = page.getByRole('navigation', { name: /navegação principal/i })
    await expect(nav).toBeVisible()

    await page.mouse.wheel(0, 4000)
    await expect(nav.getByRole('link', { name: /^início$/i })).toBeVisible()
  })
})
