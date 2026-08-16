import { Hono } from 'hono'
import { prisma } from './lib/prismaClient'
import { authRoutes } from './routes/auth'
import { mfaRoutes } from './routes/mfa'
import { storeRoutes } from './routes/stores'
import { productRoutes } from './routes/products'
import { productPhotoRoutes } from './routes/productPhotos'
import { favoriteRoutes } from './routes/favorites'
import { addressRoutes } from './routes/addresses'
import { orderRoutes } from './routes/orders'
import { storeOwnerRoutes } from './routes/storeOwner'
import { adminRoutes } from './routes/admin'
import { meRoutes } from './routes/me'
import { paymentRoutes } from './routes/payments'
import { notificationRoutes } from './routes/notifications'
import { adRoutes } from './routes/ads'

export const app = new Hono()

app.route('/', authRoutes)
app.route('/', mfaRoutes)
app.route('/', storeRoutes)
app.route('/', productRoutes)
app.route('/', productPhotoRoutes)
app.route('/', favoriteRoutes)
app.route('/', addressRoutes)
app.route('/', orderRoutes)
app.route('/', storeOwnerRoutes)
app.route('/', adminRoutes)
app.route('/', meRoutes)
app.route('/', paymentRoutes)
app.route('/', notificationRoutes)
app.route('/', adRoutes)

// Health real: toca o banco (SELECT 1) e devolve 503 em falha, para que o
// HEALTHCHECK do Docker e o monitor de uptime (uptime.yml) detectem Supabase
// fora do ar — e não só "o processo Node responde". Timeout curto: um banco
// pendurado não pode segurar o health por mais que alguns segundos.
app.get('/health', async (c) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 5000)),
    ])
    return c.json({ status: 'ok' })
  } catch {
    return c.json({ status: 'degraded', database: 'unreachable' }, 503)
  }
})
