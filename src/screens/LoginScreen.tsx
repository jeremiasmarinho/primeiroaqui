import { Settings, ShoppingBag, User } from 'lucide-react'
import type { Role } from '../types'

export interface AuthForm {
  email: string
  password: string
  name: string
}

interface LoginScreenProps {
  authMode: 'login' | 'signup'
  onAuthModeChange: (mode: 'login' | 'signup') => void
  authForm: AuthForm
  onAuthFormChange: (patch: Partial<AuthForm>) => void
  authError: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onQuickLogin: (role: Role) => void
  isDevMode: boolean
  contextMessage: string
}

/**
 * Tela de entrada. Os atalhos "entrar como cliente/operacao" existem apenas em
 * desenvolvimento (`isDevMode`) — em producao o acesso passa pelo formulario.
 */
export default function LoginScreen({
  authMode,
  onAuthModeChange,
  authForm,
  onAuthFormChange,
  authError,
  onSubmit,
  onQuickLogin,
  isDevMode,
  contextMessage,
}: LoginScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#ffe600] p-6">
      <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-4 rounded-[28px] bg-slate-50 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Primeiro Aqui</p>
            <p className="text-xs text-slate-500">Marketplace local com operação inteligente</p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] bg-slate-900 p-6 text-white">
          <h1 className="text-3xl font-black">Gerencie vendas, entregas e agentes em um só lugar</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Uma experiência de compra rápida, pensada para operações locais e crescimento futuro.</p>
        </div>

        {contextMessage ? (
          <p className="mt-4 rounded-[16px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {contextMessage}
          </p>
        ) : null}

        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-6 rounded-[28px] border border-slate-200 p-4"
        >
          <div className="flex gap-2">
            <button type="button" onClick={() => onAuthModeChange('login')} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${authMode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Entrar</button>
            <button type="button" onClick={() => onAuthModeChange('signup')} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${authMode === 'signup' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Criar conta</button>
          </div>
          <div className="mt-4 space-y-3">
            {authMode === 'signup' && (
              <div>
                <label htmlFor="auth-nome" className="text-sm font-semibold text-slate-700">
                  Seu nome
                </label>
                <input
                  id="auth-nome"
                  value={authForm.name}
                  onChange={(event) => onAuthFormChange({ name: event.target.value })}
                  placeholder="Seu nome"
                  autoComplete="name"
                  className="mt-1 h-12 w-full rounded-[16px] border border-slate-200 px-3 outline-none focus:border-slate-900"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="text-sm font-semibold text-slate-700">
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                value={authForm.email}
                onChange={(event) => onAuthFormChange({ email: event.target.value })}
                placeholder="E-mail"
                autoComplete="email"
                inputMode="email"
                aria-invalid={authError.includes('e-mail') ? true : undefined}
                className="mt-1 h-12 w-full rounded-[16px] border border-slate-200 px-3 outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="auth-senha" className="text-sm font-semibold text-slate-700">
                Senha
              </label>
              <input
                id="auth-senha"
                type="password"
                value={authForm.password}
                onChange={(event) => onAuthFormChange({ password: event.target.value })}
                placeholder="Senha"
                autoComplete="current-password"
                aria-invalid={authError.includes('Senha') ? true : undefined}
                className="mt-1 h-12 w-full rounded-[16px] border border-slate-200 px-3 outline-none focus:border-slate-900"
              />
            </div>
          </div>
          {authError ? (
            <p role="alert" className="mt-3 rounded-[14px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {authError}
            </p>
          ) : null}
          <button type="submit" className="mt-4 w-full rounded-[20px] bg-slate-900 px-4 py-3 font-bold text-white">{authMode === 'signup' ? 'Criar conta' : 'Entrar'}</button>
        </form>

        {import.meta.env.DEV && isDevMode ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button onClick={() => onQuickLogin('client')} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><User className="h-5 w-5" /></div>
              <div>
                <h2 className="font-black text-slate-900">Entrar como cliente</h2>
                <p className="text-sm text-slate-500">Comprar, acompanhar e receber</p>
              </div>
            </div>
          </button>
          {import.meta.env.DEV && isDevMode ? (
            <button onClick={() => onQuickLogin('admin')} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Settings className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-black text-slate-900">Entrar como operação</h2>
                  <p className="text-sm text-slate-500">Painel para agentes e pedidos</p>
                </div>
              </div>
            </button>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  )
}
