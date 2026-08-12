import { prisma } from './prismaClient'
import type { NotificationType } from '@prisma/client'

/**
 * Cria uma notificação persistida para um usuário. Chamada direto de dentro
 * das rotas que geram o evento (pedido criado, loja criada, pagamento
 * confirmado) — sem event bus, mesmo padrão do resto do backend.
 *
 * NUNCA lança: uma falha aqui não pode derrubar a operação principal que a
 * originou (o pedido/loja já foi criado com sucesso quando isto é chamado).
 */
export async function createNotification(
  userId: string,
  input: { title: string; message: string; type?: NotificationType; href?: string },
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type ?? 'INFO',
        href: input.href,
      },
    })
  } catch (error) {
    console.error('Falha ao criar notificação', { userId, title: input.title, error })
  }
}
