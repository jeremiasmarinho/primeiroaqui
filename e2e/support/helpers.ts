import { expect, type Page } from '@playwright/test'

/** Sufixo único por execução para nomes/emails/títulos criados via UI. */
export const uniqueSuffix = (): string => `${Date.now()}${Math.floor(Math.random() * 1000)}`

export const uniqueEmail = (prefix = 'cliente'): string => `${prefix}+${uniqueSuffix()}@teste.com`

export const uniqueName = (prefix = 'Teste'): string => `${prefix} ${uniqueSuffix()}`

export const uniqueProductTitle = (prefix = 'Produto'): string => `${prefix} E2E ${uniqueSuffix()}`

/**
 * Cadastro via UI: /entrar -> "Criar conta" -> preenche -> submit.
 * Supabase DEV não exige confirmação de e-mail: o cadastro já loga.
 * Após o login/cadastro há um HARD RELOAD (hardNavigate) — esperamos a
 * navegação principal (nav inferior) reaparecer, não só a URL mudar.
 *
 * Só navega para /entrar se a página AINDA não estiver lá: um `page.goto`
 * incondicional recarregaria a página mesmo quando o teste já chegou em
 * /entrar por um redirecionamento client-side (ex.: clicar em favoritar sem
 * sessão — ver jornada-visitante.spec.ts), e esse reload apagaria o estado
 * em memória que motivou a ida a /entrar (a intenção pendente de favoritar,
 * guardada só em React state até o próprio login persistir no
 * sessionStorage — ver `redirectToLogin`/`savePendingLogin` no app). Pular o
 * goto quando redundante preserva esse estado sem mudar o comportamento
 * para quem já chama este helper a partir de uma página fresca.
 */
export async function signupViaUI(page: Page, { name, email, password = 'senha12345' }: { name: string; email: string; password?: string }) {
  if (new URL(page.url()).pathname !== '/entrar') {
    await page.goto('/entrar')
  }
  await page.getByRole('button', { name: /^criar conta$/i }).first().click()
  await page.getByLabel('Seu nome').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: /^criar conta$/i }).last().click()
  // Hard reload: espera a navegação principal reaparecer com timeout generoso.
  await expect(page.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 20000 })
}

/** Login via UI (conta já existente). */
export async function loginViaUI(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto('/entrar')
  await page.getByRole('button', { name: /^entrar$/i }).first().click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: /^entrar$/i }).last().click()
  await expect(page.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 20000 })
}

/** Cria um endereço via UI em /enderecos (requer sessão ativa). */
export async function createAddressViaUI(
  page: Page,
  { label = 'Casa', street = 'Rua das Flores, 12', city = 'Centro', state = 'SP', cep = '01310-100' }: {
    label?: string
    street?: string
    city?: string
    state?: string
    cep?: string
  } = {},
) {
  await page.goto('/enderecos')
  // Form novo (ago/2026): CEP primeiro (dispara autofill ViaCEP), depois
  // Rua/Bairro/Cidade/UF (sobrescrevemos o autofill para dados determinísticos),
  // Número, e "Nome do endereço" virou SELECT (Casa/Trabalho/.../Outro).
  await page.getByLabel('CEP').fill(cep)
  // aguarda o lookup do CEP assentar (spinner some / campos habilitam)
  await page.waitForTimeout(1500)
  await page.getByLabel('Rua', { exact: true }).fill(street)
  await page.getByLabel('Bairro').fill('Centro')
  await page.getByLabel('Cidade').fill(city)
  await page.getByLabel('Estado (UF)').fill(state)
  await page.getByLabel('Número', { exact: true }).fill('12')
  const labelSelect = page.getByLabel('Nome do endereço', { exact: true })
  const predefined = ['Casa', 'Trabalho', 'Casa de parente']
  if (predefined.includes(label)) {
    await labelSelect.selectOption({ label })
  } else {
    await labelSelect.selectOption({ label: 'Outro' })
    await page.getByLabel('Nome do endereço (outro)').fill(label)
  }
  await page.getByRole('button', { name: /salvar endereço/i }).click()
  await expect(page.getByRole('list', { name: /endereços salvos/i }).getByText(label, { exact: true })).toBeVisible({ timeout: 10000 })
}

/** Test card data para o sandbox do Pagar.me. */
export const TEST_CARD = {
  cpf: '529.982.247-25',
  phone: '(11) 98888-7766',
  number: '4000000000000010',
  holderName: 'TESTE APROVADO',
  expiry: '12/30',
  cvv: '123',
}

/** Busca um produto pela caixa de busca do topo e espera o resultado. */
export async function searchProduct(page: Page, term: string) {
  await page.getByLabel(/buscar produtos, lojas ou categorias/i).fill(term)
}

/**
 * Adiciona um produto qualquer da Home ao carrinho.
 *
 * A Home carrega só uma página de até 50 produtos (`useRemoteCatalog`,
 * `limit: 50`, sem busca no servidor) — buscar por um título fixo de seed é
 * frágil porque produtos novos (ex.: os criados pela jornada do lojista, com
 * `createdAt` mais recente) empurram itens antigos pra fora dessa janela.
 * Em vez de depender de um título específico, tenta os primeiros cards em
 * ordem e segue para o próximo se o carrinho acusar falta de estoque — assim
 * o teste sobrevive tanto a produtos zerados quanto à ordenação mudando.
 */
export async function addSeedProductToCart(page: Page) {
  await page.goto('/')
  const addButtons = page.getByRole('button', { name: /adicionar .* ao carrinho/i })
  await expect(addButtons.first()).toBeVisible({ timeout: 15000 })
  const count = Math.min(await addButtons.count(), 8)

  for (let index = 0; index < count; index += 1) {
    await addButtons.nth(index).click()
    const cartDialog = page.getByRole('dialog', { name: /carrinho de compras/i })
    const outOfStockAlert = page.getByText(/sem estoque/i)
    await expect(cartDialog.or(outOfStockAlert)).toBeVisible({ timeout: 10000 })
    if (await cartDialog.isVisible().catch(() => false)) return
    // Sem estoque: fecha o aviso (toast) e tenta o próximo produto da lista.
    await page.waitForTimeout(300)
  }
  throw new Error('Nenhum dos primeiros produtos do catálogo tinha estoque disponível.')
}
