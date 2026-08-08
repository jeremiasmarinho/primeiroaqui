import { useRef, useState } from 'react'
import { Link } from 'wouter'

import { formatCurrency } from '../lib/format'
import { ROUTES } from '../router/routes'
import { api, ApiError } from '../lib/api'
import { pushToast } from '../state/useToasts'
import { formatCpf, formatPhone, isValidCpf, isValidPhone } from '../lib/paymentValidation'
import type { BusinessProfile, Order, Product, Role, User } from '../types'

const SHORTCUTS = [
  { href: ROUTES.favorites, label: 'Meus favoritos' },
  { href: ROUTES.orders, label: 'Meus pedidos', subtitle: 'Acompanhe compras e entregas' },
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
  // Preview local (blob) enquanto o upload roda — a foto real do usuário só
  // troca quando a API confirma; se der erro, a preview cai e o avatar
  // anterior volta a aparecer.
  const [avatarPreview, setAvatarPreview] = useState('')

  // Edição de nome/telefone/CPF (Item 3). Formulário fica escondido até a
  // pessoa clicar "Editar perfil" — o valor inicial vem sempre do usuário
  // autenticado, então reabrir depois de salvar já mostra o dado atualizado.
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: authUser?.name ?? '',
    phone: authUser?.phone ? formatPhone(authUser.phone) : '',
    document: authUser?.document ? formatCpf(authUser.document) : '',
  })
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')

  const openEditProfile = () => {
    setProfileForm({
      name: authUser?.name ?? '',
      phone: authUser?.phone ? formatPhone(authUser.phone) : '',
      document: authUser?.document ? formatCpf(authUser.document) : '',
    })
    setProfileFieldErrors({})
    setProfileError('')
    setIsEditingProfile(true)
  }

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const errors: Record<string, string> = {}
    if (!profileForm.name.trim()) errors.name = 'Nome não pode ser vazio.'
    if (profileForm.phone.trim() && !isValidPhone(profileForm.phone)) errors.phone = 'Telefone inválido.'
    if (profileForm.document.trim() && !isValidCpf(profileForm.document)) errors.document = 'CPF inválido.'
    setProfileFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setProfileError('')
    setProfileSaving(true)
    try {
      const { user } = await api.updateMe({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        document: profileForm.document.trim(),
      })
      onAuthUserChange({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        phone: user.phone ?? null,
        document: user.document ?? null,
      })
      pushToast('Perfil atualizado', 'success')
      setIsEditingProfile(false)
    } catch (error) {
      setProfileError(
        error instanceof ApiError ? error.message : 'Não foi possível salvar o perfil. Tente novamente.',
      )
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarPick = () => fileInputRef.current?.click()

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setAvatarError('Formato não suportado. Envie uma foto JPEG, PNG ou WebP.')
      return
    }

    setAvatarError('')
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setAvatarPending(true)
    try {
      const { user } = await api.uploadAvatar(file)
      // /me/avatar não devolve phone/document — preserva o que já estava na
      // sessão (senão o upload de foto apagaria o telefone/CPF salvos).
      onAuthUserChange({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        phone: authUser?.phone ?? null,
        document: authUser?.document ?? null,
      })
      pushToast('Foto de perfil atualizada', 'success')
    } catch (error) {
      setAvatarError(
        error instanceof ApiError ? error.message : 'Não foi possível enviar a foto. Tente novamente.',
      )
    } finally {
      setAvatarPending(false)
      URL.revokeObjectURL(previewUrl)
      setAvatarPreview('')
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarError('')
    setAvatarPending(true)
    try {
      const { user } = await api.removeAvatar()
      // /me/avatar não devolve phone/document — preserva o que já estava na
      // sessão (senão o upload de foto apagaria o telefone/CPF salvos).
      onAuthUserChange({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        phone: authUser?.phone ?? null,
        document: authUser?.document ?? null,
      })
      pushToast('Foto de perfil removida', 'success')
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
                {avatarPreview || authUser?.avatarUrl ? (
                  <img
                    src={avatarPreview || authUser?.avatarUrl || undefined}
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Dados da conta</p>
              {!isEditingProfile && (
                <button type="button" onClick={openEditProfile} className="text-xs font-semibold text-primary">
                  Editar perfil
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleProfileSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="profile-name" className="text-xs font-semibold text-ink-muted">Nome</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="mt-1 h-11 w-full rounded-[14px] border border-line px-3 text-sm text-ink"
                  />
                  {profileFieldErrors.name && <p className="mt-1 text-xs text-error">{profileFieldErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="profile-phone" className="text-xs font-semibold text-ink-muted">Telefone</label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, phone: formatPhone(event.target.value) }))
                    }
                    placeholder="(00) 00000-0000"
                    className="mt-1 h-11 w-full rounded-[14px] border border-line px-3 text-sm text-ink"
                  />
                  {profileFieldErrors.phone && <p className="mt-1 text-xs text-error">{profileFieldErrors.phone}</p>}
                </div>
                <div>
                  <label htmlFor="profile-document" className="text-xs font-semibold text-ink-muted">CPF</label>
                  <input
                    id="profile-document"
                    type="text"
                    value={profileForm.document}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, document: formatCpf(event.target.value) }))
                    }
                    placeholder="000.000.000-00"
                    className="mt-1 h-11 w-full rounded-[14px] border border-line px-3 text-sm text-ink"
                  />
                  {profileFieldErrors.document && (
                    <p className="mt-1 text-xs text-error">{profileFieldErrors.document}</p>
                  )}
                </div>
                {profileError && <p className="text-xs font-semibold text-error">{profileError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={profileSaving} className="btn-primary min-h-[44px] flex-1 px-4 disabled:opacity-50">
                    {profileSaving ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    disabled={profileSaving}
                    className="min-h-[44px] flex-1 rounded-[14px] border border-line px-4 text-sm font-semibold text-ink-muted disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-ink-muted">
                <div className="flex justify-between"><span>E-mail</span><span className="font-semibold">{authUser?.email || 'cliente@primeiroaqui.com'}</span></div>
                <div className="flex justify-between"><span>Telefone</span><span className="font-semibold">{authUser?.phone ? formatPhone(authUser.phone) : 'Não informado'}</span></div>
                <div className="flex justify-between"><span>CPF</span><span className="font-semibold">{authUser?.document ? formatCpf(authUser.document) : 'Não informado'}</span></div>
                <div className="flex justify-between"><span>Tipo</span><span className="font-semibold">{userRole === 'ADMIN' ? 'Operação' : 'Cliente'}</span></div>
                <div className="flex justify-between"><span>Negócio</span><span className="font-semibold">{businessProfile?.name || 'Ainda não cadastrado'}</span></div>
                <div className="flex justify-between"><span>Endereço</span><span className="font-semibold">{businessProfile?.address || 'Rua da Esperança, 123'}</span></div>
              </div>
            )}
          </div>
          <div className="rounded-[24px] border border-line p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Ações</p>
            <div className="mt-4 space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="flex min-h-[44px] w-full flex-col justify-center rounded-[18px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted"
                >
                  <span>{shortcut.label}</span>
                  {'subtitle' in shortcut ? (
                    <span className="text-xs font-normal text-ink-faint">{shortcut.subtitle}</span>
                  ) : null}
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
