import { expect, test } from '@playwright/test'
import {
  createAddressViaUI,
  signupViaUI,
  TEST_CARD,
  uniqueEmail,
  uniqueName,
  uniqueProductTitle,
} from './support/helpers'

/**
 * Jornada do lojista: cadastro -> "Vender no Primeiro Aqui" -> configura
 * negócio -> publica produto -> produto aparece na vitrine pública -> um
 * segundo comprador (nova conta) compra o produto com cartão -> o pedido
 * aparece em "Pedidos", avança de status -> o comprador aparece em "Clientes".
 */
test('lojista cadastra negócio, publica produto e recebe pedido', async ({ browser }) => {
  const merchantContext = await browser.newContext()
  const merchantPage = await merchantContext.newPage()

  const merchantName = uniqueName('Lojista')
  const merchantEmail = uniqueEmail('lojista')
  const storeName = uniqueName('Loja E2E')
  const productTitle = uniqueProductTitle('Produto Loja')

  await signupViaUI(merchantPage, { name: merchantName, email: merchantEmail })

  await merchantPage.goto('/perfil')
  await merchantPage.getByRole('button', { name: /vender no primeiro aqui/i }).click()

  await merchantPage.getByPlaceholder('Nome do negócio').fill(storeName)
  await merchantPage.getByPlaceholder('Endereço').fill('Rua do Comércio, 500')
  await merchantPage.getByPlaceholder('Telefone').fill('(11) 3333-4444')
  await merchantPage.getByRole('button', { name: /salvar cadastro/i }).click()

  await merchantPage.waitForURL('**/minha-loja', { timeout: 15000 })
  await expect(merchantPage.getByRole('heading', { name: storeName })).toBeVisible({ timeout: 10000 })

  // A aba padrão é "Pedidos" — muda para "Meus produtos" antes de publicar.
  await merchantPage.getByRole('tab', { name: /meus produtos/i }).click()
  await merchantPage.getByLabel('Nome do produto').fill(productTitle)
  await merchantPage.getByLabel('Categoria').fill('Mercearia')
  await merchantPage.getByLabel('Preço em reais').fill('9,90')
  await merchantPage.getByLabel('Estoque').fill('20')
  await merchantPage.getByRole('button', { name: /^publicar produto$/i }).click()

  await expect(merchantPage.getByText(productTitle).first()).toBeVisible({ timeout: 10000 })

  // Verifica na vitrine pública (nova aba/contexto, comprador não logado).
  const buyerContext = await browser.newContext()
  const buyerPage = await buyerContext.newPage()
  await buyerPage.goto('/')
  await buyerPage.getByLabel(/buscar produtos, lojas ou categorias/i).fill(productTitle)
  await expect(buyerPage.getByText(productTitle).first()).toBeVisible({ timeout: 10000 })

  // Segundo usuário (comprador) via UI, compra o produto com cartão.
  const buyerName = uniqueName('Comprador')
  const buyerEmail = uniqueEmail('comprador')
  await signupViaUI(buyerPage, { name: buyerName, email: buyerEmail })
  await createAddressViaUI(buyerPage, { label: 'Casa Comprador' })

  await buyerPage.goto('/')
  await buyerPage.getByLabel(/buscar produtos, lojas ou categorias/i).fill(productTitle)
  const addButton = buyerPage.getByRole('button', { name: new RegExp(`adicionar ${productTitle} ao carrinho`, 'i') }).first()
  await expect(addButton).toBeVisible({ timeout: 10000 })
  await addButton.click()

  await buyerPage.getByRole('dialog', { name: /carrinho de compras/i }).getByRole('button', { name: /continuar/i }).click()
  await expect(buyerPage.getByRole('dialog', { name: /dados de entrega/i })).toBeVisible()
  await buyerPage.getByLabel('Casa Comprador', { exact: false }).check()
  await buyerPage.getByLabel('Seu nome').fill(buyerName)
  await buyerPage.getByRole('button', { name: /^cartão$/i }).click()
  await buyerPage.getByRole('button', { name: /confirmar compra/i }).click()

  await expect(buyerPage.getByRole('dialog', { name: /pagamento do pedido/i })).toBeVisible({ timeout: 15000 })
  await buyerPage.getByLabel('Número do cartão').fill(TEST_CARD.number)
  await buyerPage.getByLabel('Nome impresso no cartão').fill(TEST_CARD.holderName)
  await buyerPage.getByLabel('Validade').fill(TEST_CARD.expiry)
  await buyerPage.getByLabel('CVV').fill(TEST_CARD.cvv)
  await buyerPage.getByLabel('CPF').fill(TEST_CARD.cpf)
  await buyerPage.getByLabel('Telefone (com DDD)').fill(TEST_CARD.phone)
  await buyerPage.getByRole('button', { name: /^pagar$/i }).click()
  await expect(buyerPage.getByText(/pagamento aprovado! pedido .* confirmado\./i)).toBeVisible({ timeout: 20000 })

  // Volta ao contexto do lojista: pedido deve aparecer em "Pedidos".
  await merchantPage.getByRole('tab', { name: /^pedidos$/i }).click()
  await merchantPage.reload()
  await merchantPage.getByRole('tab', { name: /^pedidos$/i }).click()
  const orderItem = merchantPage.getByText(buyerName).first()
  await expect(orderItem).toBeVisible({ timeout: 15000 })

  // Avança o status do pedido.
  const advanceButton = merchantPage.getByRole('button', { name: /confirmar pedido/i }).first()
  await expect(advanceButton).toBeVisible({ timeout: 10000 })
  await advanceButton.click()
  await expect(merchantPage.getByText('Confirmado', { exact: true }).first()).toBeVisible({ timeout: 10000 })

  // Aba "Clientes" mostra o comprador.
  await merchantPage.getByRole('tab', { name: /^clientes$/i }).click()
  await expect(merchantPage.getByText(buyerName).first()).toBeVisible({ timeout: 10000 })

  await merchantContext.close()
  await buyerContext.close()
})
