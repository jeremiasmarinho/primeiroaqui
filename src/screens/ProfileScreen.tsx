import { Link } from 'wouter'

import { formatCurrency } from '../lib/format'
import { ROUTES } from '../router/routes'
import type { BusinessProfile, Order, Product, Role, User } from '../types'

const SHORTCUTS = [
  { href: ROUTES.favorites, label: 'Meus favoritos' },
  { href: ROUTES.orders, label: 'Meus pedidos' },
  { href: ROUTES.addresses, label: 'Meus endereços' },
] as const

interface ProfileScreenProps {
  authUser: User | null
  userRole: Role
  businessProfile: BusinessProfile | null
  favorites: Product[]
  orders: Order[]
  onBack: () => void
  onLogout: () => void
  onToggleFavorite: (product: Product) => void
}

export default function ProfileScreen({
  authUser,
  userRole,
  businessProfile,
  favorites,
  orders,
  onBack,
  onLogout,
  onToggleFavorite,
}: ProfileScreenProps) {
  return (
    <div className="min-h-screen bg-surface-page p-4 md:p-8">
      <div className="mx-auto max-w-4xl rounded-[32px] bg-surface p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Perfil</p>
            <h2 className="text-2xl font-black text-ink">{authUser?.name || 'Cliente'}</h2>
          </div>
          <button onClick={() => onBack()} className="btn-primary min-h-[44px] px-4 py-2">Voltar</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[24px] bg-surface-page p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Dados da conta</p>
                <div className="mt-4 space-y-3 text-sm text-ink-muted">
              <div className="flex justify-between"><span>E-mail</span><span className="font-semibold">{authUser?.email || 'cliente@primeiroaqui.com'}</span></div>
              <div className="flex justify-between"><span>Tipo</span><span className="font-semibold">{userRole === 'admin' ? 'Operação' : 'Cliente'}</span></div>
              <div className="flex justify-between"><span>Negócio</span><span className="font-semibold">{businessProfile?.name || 'Ainda não cadastrado'}</span></div>
              <div className="flex justify-between"><span>Endereço</span><span className="font-semibold">{businessProfile?.address || 'Rua da Esperança, 123'}</span></div>
            </div>
          </div>
          <div className="rounded-[24px] border border-line p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Ações</p>
            <div className="mt-4 space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="flex min-h-[44px] w-full items-center rounded-[18px] border border-line px-4 text-sm font-semibold text-ink-muted"
                >
                  {shortcut.label}
                </Link>
              ))}
              <button onClick={() => onBack()} className="btn-primary min-h-[44px] w-full rounded-[18px] px-4 py-3">Voltar ao marketplace</button>
              <button onClick={onLogout} className="w-full rounded-[18px] border border-line px-4 py-3 text-sm font-semibold text-ink-muted">Sair da conta</button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-line p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Favoritos</p>
                <h3 className="text-lg font-black text-ink">Produtos salvos</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{favorites.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {favorites.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum favorito salvo ainda.</p>
              ) : favorites.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-[20px] bg-surface-page p-3">
                  <div>
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="text-sm text-ink-muted">{formatCurrency(item.price)}</p>
                  </div>
                  <button onClick={() => onToggleFavorite(item)} className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700">Remover</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-line p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Histórico</p>
                <h3 className="text-lg font-black text-ink">Últimos pedidos</h3>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{orders.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {orders.slice(0, 3).map((order) => (
                <div key={order.id} className="rounded-[20px] bg-surface-page p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-ink">{order.id}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">{order.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{order.customer} • {formatCurrency(order.value)}</p>
                  {order.items?.length ? <p className="mt-1 text-xs text-ink-faint">{order.items.length} item(s) • {order.payment || 'Pix'}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
