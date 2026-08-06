import { Hono } from 'hono'
import { authRoutes } from './routes/auth'
import { storeRoutes } from './routes/stores'
import { productRoutes } from './routes/products'
import { productPhotoRoutes } from './routes/productPhotos'
import { favoriteRoutes } from './routes/favorites'
import { addressRoutes } from './routes/addresses'
import { orderRoutes } from './routes/orders'
import { storeOwnerRoutes } from './routes/storeOwner'
import { adminRoutes } from './routes/admin'

export const app = new Hono()

app.route('/', authRoutes)
app.route('/', storeRoutes)
app.route('/', productRoutes)
app.route('/', productPhotoRoutes)
app.route('/', favoriteRoutes)
app.route('/', addressRoutes)
app.route('/', orderRoutes)
app.route('/', storeOwnerRoutes)
app.route('/', adminRoutes)

// Placeholder minimo — health check completo (banco/storage) e escopo da Fase 8.
app.get('/health', (c) => c.json({ status: 'ok' }))
