import { expect, test } from '@playwright/test'

test.describe('autenticacao', () => {
  test('criar conta, entrar e sair limpa a sessao', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /^criar conta$/i }).first().click()
    await page.getByLabel('Seu nome').fill('Ana Paula')
    await page.getByLabel('E-mail').fill('ana@teste.com')
    await page.getByLabel('Senha').fill('segredo123')
    await page.getByRole('button', { name: /^criar conta$/i }).last().click()

    const profile = page.getByRole('button', { name: /abrir perfil de ana paula/i })
    await expect(profile).toBeVisible()

    await profile.click()
    await page.getByRole('button', { name: /sair da conta/i }).click()

    await expect(page.getByLabel('Senha')).toBeVisible()

    const stored = await page.evaluate(() => localStorage.getItem('primeiroaqui_user'))
    expect(stored).toBeNull()
  })

  test('rejeita e-mail malformado sem autenticar', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('E-mail').fill('nao-e-email')
    await page.getByLabel('Senha').fill('segredo123')
    await page.getByRole('button', { name: /^entrar$/i }).last().click()

    await expect(page.getByRole('alert')).toContainText(/e-mail valido/i)
  })

  test('papel admin gravado a mao no storage nao libera o painel', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem(
        'primeiroaqui_user',
        JSON.stringify({ name: 'Invasor', email: 'x@x.com', role: 'admin' }),
      )
    })
    await page.reload()

    await page.getByRole('button', { name: /^mais$/i }).click()
    await expect(page.getByRole('tab', { name: /agentes/i })).toBeHidden()
  })
})
