import { http, HttpResponse } from 'msw'

export const handlers = [
  // Handlers intencionalmente mínimos por enquanto.
  // Adicione mocks por WU conforme endpoints reais surgirem.
  http.get('/__health', () => HttpResponse.json({ ok: true })),
]
