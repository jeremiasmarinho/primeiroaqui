import { formatRelativeTime } from './relativeTime'

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-08-08T12:00:00').getTime()

  it('menos de 60s: "agora"', () => {
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe('agora')
  })

  it('exatamente 60s: "há 1 min"', () => {
    expect(formatRelativeTime(NOW - 60_000, NOW)).toBe('há 1 min')
  })

  it('minutos: "há X min"', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('há 5 min')
  })

  it('59min59s ainda em minutos', () => {
    expect(formatRelativeTime(NOW - (59 * 60_000 + 59_000), NOW)).toBe('há 59 min')
  })

  it('horas: "há X h"', () => {
    expect(formatRelativeTime(NOW - 3 * 60 * 60_000, NOW)).toBe('há 3 h')
  })

  it('23h59 ainda em horas', () => {
    expect(formatRelativeTime(NOW - (23 * 60 * 60_000 + 59 * 60_000), NOW)).toBe('há 23 h')
  })

  it('ontem (dia anterior ao calendário)', () => {
    const yesterday = new Date('2026-08-07T09:00:00').getTime()
    expect(formatRelativeTime(yesterday, NOW)).toBe('ontem')
  })

  it('24h exatas mas mesmo dia de calendário cai em horas', () => {
    const sameCalendarDay = new Date('2026-08-08T00:00:01').getTime()
    expect(formatRelativeTime(sameCalendarDay, NOW)).toMatch(/^há \d+ h$/)
  })

  it('há X dias entre 2 e 6 dias', () => {
    const threeDaysAgo = new Date('2026-08-05T12:00:00').getTime()
    expect(formatRelativeTime(threeDaysAgo, NOW)).toBe('há 3 dias')
  })

  it('exatamente 7 dias cai para data curta pt-BR', () => {
    const sevenDaysAgo = new Date('2026-08-01T12:00:00').getTime()
    expect(formatRelativeTime(sevenDaysAgo, NOW)).toBe('01/08')
  })

  it('mais de 7 dias: data curta pt-BR', () => {
    const longAgo = new Date('2026-07-20T12:00:00').getTime()
    expect(formatRelativeTime(longAgo, NOW)).toBe('20/07')
  })

  it('timestamp no futuro (relógio dessincronizado) nunca fica negativo', () => {
    expect(formatRelativeTime(NOW + 10_000, NOW)).toBe('agora')
  })
})
