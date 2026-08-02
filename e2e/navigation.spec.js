import { expect, test } from '@playwright/test'

/** Autentica pelo formulario real: o build de producao nao expoe atalhos de dev. */
const entrar = async (page, nome = 'Ana Paula') => {
  await page.goto('/entrar')
  // "Criar conta" aparece duas vezes: a aba e o submit. O submit e o ultimo.
  await page.getByRole('button', { name: /^criar conta$/i }).first().click()
  await page.getByLabel('Seu nome').fill(nome)
  await page.getByLabel('E-mail').fill('ana@teste.com')
  await page.getByLabel('Senha').fill('segredo123')
  await page.getByRole('button', { name: /^criar conta$/i }).last().click()
  await page.getByRole('navigation', { name: /navegação principal/i }).waitFor()
}

test.describe('navegacao', () => {
  test('deep link direto em /produto/:id renderiza o produto certo', async ({ page }) => {
    // Para acessar rota protegida, precisa estar autenticado
    await entrar(page)

    // Deep link direto para produto 1 (Ventilador de Mesa Premium)
    await page.goto('/produto/1')

    // Valida que renderizou o produto correto
    await expect(
      page.getByRole('heading', { name: /ventilador de mesa premium/i }),
    ).toBeVisible()
  })

  test('deep link para produto inexistente mostra estado "não encontrado"', async ({ page }) => {
    await entrar(page)

    // Deep link para produto que não existe
    await page.goto('/produto/99999')

    // Valida que mostra mensagem de não encontrado
    await expect(page.getByText(/produto não encontrado/i)).toBeVisible()
  })

  test('voltar do navegador retorna à tela anterior', async ({ page }) => {
    await entrar(page)

    // Navega para a primeira tela (home). A busca por texto solto "Primeiro
    // Aqui" e ambigua (aparece em varios rotulos sr-only dos cards) — a barra
    // de navegacao inferior e o marcador estavel e unico da home.
    const homeNav = page.getByRole('navigation', { name: /navegação principal/i })
    await expect(homeNav).toBeVisible()

    // Clica no primeiro produto para navegar
    await page
      .getByRole('button', { name: /adicionar .* ao carrinho/i })
      .first()
      .click()

    // Aguarda drawer do carrinho aparecer
    const drawer = page.getByRole('dialog', { name: /carrinho de compras/i })
    await expect(drawer).toBeVisible()

    // Fecha o drawer (clica fora ou no X, dependendo da implementação)
    // Aqui assumimos que há um botão de fechar ou que clicamos fora
    await page.keyboard.press('Escape')

    // Agora navega para a página de um produto
    await page.goto('/produto/1')
    await expect(
      page.getByRole('heading', { name: /ventilador de mesa premium/i }),
    ).toBeVisible()

    // Volta do navegador
    await page.goBack()

    // Valida que voltou para a home
    await expect(homeNav).toBeVisible()
  })

  test('/admin sem sessao redireciona para login', async ({ page }) => {
    // Acessa /admin sem estar autenticado
    await page.goto('/admin')

    // Valida que foi redirecionado para login
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeVisible()
  })

  test('/produto/:id continua acessivel sem sessao — rota publica', async ({ page }) => {
    await page.goto('/produto/1')

    await expect(
      page.getByRole('heading', { name: /ventilador de mesa premium/i }),
    ).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeHidden()
  })

  test('categoria inexistente mostra estado "não encontrado"', async ({ page }) => {
    await entrar(page)

    // Navega para categoria inexistente
    await page.goto('/categoria/categoria-inexistente-12345')

    // Valida que mostra mensagem de categoria não encontrada
    await expect(page.getByText(/categoria não encontrada/i)).toBeVisible()
  })
})
