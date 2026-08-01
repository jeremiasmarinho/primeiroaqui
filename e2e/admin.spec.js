import { expect, test } from '@playwright/test'

/**
 * O painel operacional NAO tem porta de entrada no build de producao.
 *
 * Por decisao de seguranca (regressao B5), o papel `admin` nunca vem do
 * localStorage e os atalhos de login ficam atras de `import.meta.env.DEV`.
 * Logo, em producao nao existe caminho para virar operacao — isso so se resolve
 * com autenticacao no servidor (WU-22 do plano original).
 *
 * Estes cenarios ficam registrados e suspensos ate la. O painel continua
 * coberto pelos testes de componente (`src/test/admin.test.tsx`), que rodam em
 * modo de desenvolvimento.
 */
test.describe.skip('painel operacional (sem porta de entrada em producao — ver WU-22)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /entrar como operação/i }).click()
    await page.getByRole('button', { name: /^mais$/i }).click()
  })

  test('cria agente e ele aparece no ranking', async ({ page }) => {
    await page.getByRole('tab', { name: /agentes/i }).click()

    await page.getByPlaceholder('Nome').fill('Carla Nunes')
    await page.getByPlaceholder('Região').fill('Zona Oeste')
    await page.getByPlaceholder('Especialidade').fill('Entregas rápidas')
    await page.getByPlaceholder('Comissão (%)').fill('20')
    await page.getByRole('button', { name: /salvar/i }).click()

    await expect(page.getByText('Carla Nunes')).toBeVisible()

    await page.getByRole('tab', { name: /desempenho/i }).click()
    await expect(page.getByText('1. Carla Nunes')).toBeVisible()
  })

  test('muda status de pedido e o valor persiste ao voltar na aba', async ({ page }) => {
    await page.getByRole('tab', { name: /pedidos/i }).click()

    const select = page.getByRole('combobox').nth(2)
    await select.selectOption('Em rota')
    await expect(select).toHaveValue('Em rota')

    await page.getByRole('tab', { name: /visão geral/i }).click()
    await page.getByRole('tab', { name: /pedidos/i }).click()
    await expect(page.getByRole('combobox').nth(2)).toHaveValue('Em rota')
  })

  test('comissao fora da faixa nao cria agente', async ({ page }) => {
    await page.getByRole('tab', { name: /agentes/i }).click()

    await page.getByPlaceholder('Nome').fill('Comissao Absurda')
    await page.getByPlaceholder('Região').fill('Centro')
    await page.getByPlaceholder('Especialidade').fill('Teste')
    await page.getByPlaceholder('Comissão (%)').fill('150')
    await page.getByRole('button', { name: /salvar/i }).click()

    await expect(page.getByText('Comissao Absurda')).toBeHidden()
  })
})
