import { expect, test } from '@playwright/test'

/**
 * E2E do fluxo de visitante: navegar, favoritar/pagar exige login, e a
 * intenção é retomada automaticamente após entrar.
 */
test.describe('visitante', () => {
  test('favoritar redireciona para login e aplica o favorito ao retornar', async ({ page }) => {
    await page.goto('/')

    const heart = page.getByRole('button', { name: /^salvar .+ nos favoritos$/i }).first()
    const label = await heart.getAttribute('aria-label')
    const title = label?.replace(/^Salvar /, '').replace(/ nos favoritos$/, '') ?? ''

    await heart.click()

    await expect(page.getByLabel('Senha')).toBeVisible()
    await expect(page.getByText(/faça login para favoritar/i)).toBeVisible()

    // A tela de login abre no modo "Entrar" por padrao; trocar para "Criar conta".
    await page.getByRole('button', { name: /^criar conta$/i }).first().click()
    await page.getByLabel('Seu nome').fill('Ana Paula')
    await page.getByLabel('E-mail').fill('ana@teste.com')
    await page.getByLabel('Senha').fill('segredo123')
    await page.getByRole('button', { name: /^criar conta$/i }).last().click()

    await expect(page).toHaveURL('/')
    // O mesmo produto pode aparecer duplicado na home (rail "Entrega turbo"
    // + grade de catálogo, quando o produto é express) — comportamento
    // pré-existente, documentado também no teste unitário equivalente.
    // Por isso conferimos >=1 ocorrência em vez de exigir exatamente uma.
    await expect(
      page.getByRole('button', { name: new RegExp(`^Remover ${title} dos favoritos$`, 'i') }).first(),
    ).toBeVisible()
  })

  test('continuar no carrinho redireciona para login e retoma a etapa de entrega', async ({ page }) => {
    await page.goto('/')

    await page
      .getByRole('button', { name: /adicionar .* ao carrinho/i })
      .first()
      .click()
    await page.getByRole('button', { name: /continuar/i }).click()

    await expect(page.getByLabel('Senha')).toBeVisible()
    await expect(page.getByText(/faça login para continuar sua compra/i)).toBeVisible()

    await page.getByRole('button', { name: /^criar conta$/i }).first().click()
    await page.getByLabel('Seu nome').fill('Ana Paula')
    await page.getByLabel('E-mail').fill('ana@teste.com')
    await page.getByLabel('Senha').fill('segredo123')
    await page.getByRole('button', { name: /^criar conta$/i }).last().click()

    await expect(page.getByLabel('Seu nome')).toBeVisible()
    const nav = page.getByRole('navigation', { name: /navegação principal/i })
    await expect(nav.getByRole('button', { name: /carrinho — 1 itens/i })).toBeVisible()
  })

  test('clicar em Entrar na barra inferior vai direto para /entrar', async ({ page }) => {
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: /navegação principal/i })
    await nav.getByRole('link', { name: 'Entrar' }).click()

    await expect(page).toHaveURL('/entrar')
    await expect(page.getByText(/faça login para/i)).toBeHidden()
  })
})
