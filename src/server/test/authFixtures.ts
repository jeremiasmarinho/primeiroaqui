import { supabaseAdmin } from '../lib/supabaseClient'
import { prisma } from '../lib/prismaClient'
import type { UserRole } from '@prisma/client'

/**
 * Cria um usuario real no Supabase Auth (via API admin, sem disparar e-mail
 * de confirmacao — o projeto e um Supabase real de producao com o limite de
 * envio de e-mail padrao, muito baixo para uso em testes) e o `User`
 * correspondente no Prisma, com o `role` desejado.
 *
 * So o fluxo de `/auth/signup` em si deve exercitar o envio real de e-mail
 * (via `supabasePublic.auth.signUp`) — fixtures de outros testes (login,
 * logout, middleware de papel) usam este helper para nao esbarrar no limite.
 */
export const createFixtureUser = async (role: UserRole) => {
  const email = `teste-fase4-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const password = 'senha-teste-123'

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuario fixture no Supabase Auth: ${error?.message}`)
  }

  const user = await prisma.user.create({
    data: {
      authUserId: data.user.id,
      email,
      name: `Teste Fase 4 (${role})`,
      role,
    },
  })

  return { email, password, authUserId: data.user.id, user }
}

/**
 * Remove o usuario fixture do Prisma e do Supabase Auth (ordem importa: FK
 * aponta para authUserId). Apaga antes as Notification do usuario — a FK
 * `notifications_userId_fkey` e RESTRICT, entao qualquer teste que exercite
 * um fluxo real que gera notificação (checkout, criação de loja, webhook de
 * pagamento) para este usuário faria este delete falhar sem isso.
 */
export const deleteFixtureUser = async (authUserId: string) => {
  const user = await prisma.user.findUnique({ where: { authUserId } })
  if (user) {
    await prisma.notification.deleteMany({ where: { userId: user.id } })
  }
  await prisma.user.deleteMany({ where: { authUserId } })
  await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => undefined)
}
