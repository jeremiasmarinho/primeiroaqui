/**
 * Formata um timestamp (epoch ms) como tempo relativo em pt-BR, para o
 * "cronômetro" do painel de notificações.
 *
 * `now` é sempre injetado (nunca `Date.now()` interno) para manter a função
 * pura e testável — quem chama decide o instante de referência.
 */
export const formatRelativeTime = (createdAt: number, now: number): string => {
  const diffMs = Math.max(0, now - createdAt)
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return 'agora'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `há ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `há ${diffHours} h`

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfCreatedDay = new Date(createdAt)
  startOfCreatedDay.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((startOfToday.getTime() - startOfCreatedDay.getTime()) / (24 * 60 * 60 * 1000))

  if (dayDiff <= 0) {
    // Passaram >=24h de relógio mas ainda é "hoje" na data calendário (fuso
    // horário/DST) — cai para horas como fallback seguro.
    return `há ${diffHours} h`
  }

  if (dayDiff === 1) return 'ontem'
  if (dayDiff < 7) return `há ${dayDiff} dias`

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(createdAt)
}
