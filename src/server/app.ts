import { Hono } from 'hono'
import { authRoutes } from './routes/auth'

export const app = new Hono()

app.route('/', authRoutes)

// Placeholder minimo — health check completo (banco/storage) e escopo da Fase 8.
app.get('/health', (c) => c.json({ status: 'ok' }))
