import { expect, test } from '@playwright/test'
import { signupViaUI, uniqueEmail, uniqueName } from './support/helpers'

/**
 * Visitante tenta favoritar sem estar logado -> é redirecionado para /entrar
 * com a "intenção pendente" -> cria conta -> após o reload pós-cadastro, a
 * intenção pendente (favoritar) é reaplicada automaticamente.
 */
test('visitante favorita sem login, cadastra conta e a intenção pendente é aplicada', async ({ page }) => {
  await page.goto('/')

  // Usa o primeiro card visível (não busca por título fixo: a Home só carrega
  // uma página de produtos e a ordem muda conforme outras specs criam itens —
  // ver comentário de `addSeedProductToCart` em support/helpers.ts).
  const firstCard = page.locator('article').first()
  await expect(firstCard).toBeVisible({ timeout: 15000 })
  const productTitle = (await firstCard.locator('h3').innerText()).trim()

  const favoriteButton = firstCard.getByRole('button', { name: /salvar .* nos favoritos/i })
  await favoriteButton.click()

  await page.waitForURL('**/entrar', { timeout: 10000 })
  await expect(page).toHaveURL(/\/entrar/)

  const name = uniqueName('Visitante')
  const email = uniqueEmail('visitante')
  await signupViaUI(page, { name, email })

  // Após o reload pós-cadastro, a intenção pendente é reaplicada: a fonte
  // de verdade é /favoritos (vem de `catalog.favorites`, alimentado pela
  // API, não da janela de até 50 produtos carregados na Home — ver
  // `resolvePendingLoginAndNavigate` em useMarketplaceState.ts). Damos um
  // retry com reload porque a resolução depende do catálogo remoto e da
  // sessão restaurada, que podem levar um instante a mais após o hard
  // reload do cadastro.
  await expect(async () => {
    await page.goto('/favoritos')
    await expect(page.getByText(productTitle).first()).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 20000 })

  // Confere também na Home, quando o produto aparece na janela carregada.
  await page.goto('/')
  const card = page.locator('article', { hasText: productTitle }).first()
  if (await card.isVisible().catch(() => false)) {
    const toggledButton = card.getByRole('button', { name: /remover .* dos favoritos/i })
    await expect(toggledButton).toBeVisible({ timeout: 5000 })
    await expect(toggledButton).toHaveAttribute('aria-pressed', 'true')
  }
})
