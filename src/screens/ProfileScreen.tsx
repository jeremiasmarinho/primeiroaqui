import { useRef, useState } from 'react'
import { Link } from 'wouter'

import { formatCurrency } from '../lib/format'
import { ROUTES } from '../router/routes'
import { api, ApiError } from '../lib/api'
import type { BusinessProfile, Order, Product, Role, User } from '../types'

const SHORTCUTS = [
  { href: ROUTES.favorites, label: 'Meus favoritos' },
  { href: ROUTES.orders, label: 'Meus pedidos' },
  { href: ROUTES.addresses, label: 'Meus endereços' },
] as const

interface ProfileScreenProps {
  authUser: User | null
  onAuthUserChange: (user: User) => void
  userRole: Role
  businessProfile: BusinessProfile | null
  favorites: Product[]
  orders: Order[]
  onBack: () => void
  onLogout: () => void
  onToggleFavorite: (product: Product) => void
  onBecomeStoreOwner: () => void
}

/** Iniciais (até 2 letras) a partir do nome, mesmo padrão do TopBar. */
const initialsFromName = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()

export default function ProfileScreen({
  authUser,
  onAuthUserChange,
  userRole,
  businessProfile,
  favorites,
  orders,
  onBack,
  onLogout,
  onToggleFavorite,
  onBecomeStoreOwner,
}: ProfileScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPending, setAvatarPending] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const handleAvatarPick = () => fileInputRef.current?.click()

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setAvatarError('')
    setAvatarPending(true)
    try {
      const { user } = await api.uploadAvatar(file)
      onAuthUserChange({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl })
    } catch (error) {
      setAvatarError(
        error instanceof ApiError ? error.message : 'Não foi possível enviar a foto. Tente novamente.',
      )
    } finally {
      setAvatarPending(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarError('')
    setAvatarPending(true)
    try {
      const { user } = await api.removeAvatar()
      onAuthUserChange({ id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl })
    } catch (error) {
      setAvatarError(
        error instanceof ApiError ? error.message : 'Não foi possível remover a foto. Tente novamente.',
      )
    } finally {
      setAvatarPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page p-4 md:p-8">
      <div className="mx-auto max-w-4xl rounded-[32px] bg-surface p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-page text-lg font-extrabold text-ink">
                {authUser?.avatarUrl ? (
                  <img
                    src={authUser.avatarUrl}
                    alt="Foto de perfil"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initialsFromName(authUser?.name || 'Cliente')
                )}
              </div>
              {avatarPending && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-xs font-semibold text-white"
                >
                  ...
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Perfil</p>
              <h2 className="text-2xl font-black text-ink">{authUser?.name || 'Cliente'}</h2>
              <div className="mt-1 flex items-center gap-3 text-xs font-semibold">
                <button
                  type="button"
                  onClick={handleAvatarPick}
                  disabled={avatarPending}
                  className="text-primary disabled:opacity-50"
                >
                  Trocar foto
                </button>
                {authUser?.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarPending}
                    className="text-error disabled:opacity-50"
                  >
                    Remover foto
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Selecionar foto de perfil"
                onChange={handleAvatarFileChange}
              />
              {avatarError && <p className="mt-1 text-xs font-semibold text-error">{avatarError}</p>}
            </div>
          </div>
          <button onClick={() => onBack()} className="btn-primary min-h-[44px] px-4 py-2">Voltar</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[24px] bg-surface-page p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Dados da conta</p>
                <div className="mt-4 space-y-3 text-sm text-ink-muted">
              <div className="flex justify-between"><span>E-mail</span><span className="font-semibold">{authUser?.email || 'cliente@primeiroaqui.com'}</span></div>
              <div className="flex justify-between"><span>Tipo</span><span className="font-semibold">{userRole === 'ADMIN' ? 'Operação' : 'Cliente'}</span></div>
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
              {userRole === 'BUYER' ? (
                <button
                  onClick={onBecomeStoreOwner}
                  className="flex min-h-[44px] w-full items-center rounded-[18px] border border-line px-4 text-sm font-semibold text-primary"
                >
                  Vender no Primeiro Aqui
                </button>
              ) : (
                <Link
                  href={ROUTES.myStore}
                  className="flex min-h-[44px] w-full items-center rounded-[18px] border border-line px-4 text-sm font-semibold text-primary"
                >
                  Minha loja
                </Link>
              )}
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
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{favorites.length}</span>
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
                  <button onClick={() => onToggleFavorite(item)} className="rounded-full bg-error/10 px-3 py-2 text-sm font-semibold text-error">Remover</button>
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
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{orders.length}</span>
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
