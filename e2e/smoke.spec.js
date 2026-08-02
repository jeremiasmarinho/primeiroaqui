import { expect, test } from '@playwright/test'

test('home carrega com titulo visivel', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Primeiro Aqui+', { exact: true })).toBeVisible()
})
