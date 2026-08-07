import { Eye, EyeOff, Settings, User } from 'lucide-react'
import { useState } from 'react'
import type { Role } from '../types'

export interface AuthForm {
  email: string
  password: string
  name: string
}

/** Mesmo formato aceito pelo zod do servidor (ver src/server/routes/auth.ts). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface LoginScreenProps {
  authMode: 'login' | 'signup'
  onAuthModeChange: (mode: 'login' | 'signup') => void
  authForm: AuthForm
  onAuthFormChange: (patch: Partial<AuthForm>) => void
  authError: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  /** Requisição de login/cadastro em andamento — desabilita o submit. */
  authPending?: boolean
  onQuickLogin: (role: Role) => void
  isDevMode: boolean
  contextMessage: string

  // "Esqueci minha senha"
  forgotPasswordOpen: boolean
  forgotEmail: string
  onForgotEmailChange: (value: string) => void
  forgotStatus: 'idle' | 'pending' | 'sent'
  forgotError: string
  onOpenForgotPassword: () => void
  onCloseForgotPassword: () => void
  onForgotPasswordSubmit: (event: React.FormEvent<HTMLFormElement>) => void
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
  authPending = false,
  onQuickLogin,
  isDevMode,
  contextMessage,
  forgotPasswordOpen,
  forgotEmail,
  onForgotEmailChange,
  forgotStatus,
  forgotError,
  onOpenForgotPassword,
  onCloseForgotPassword,
  onForgotPasswordSubmit,
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false)
  // Validação inline: só aparece depois que a pessoa saiu do campo (blur),
  // nunca a cada tecla — evita erro piscando enquanto ainda se digita.
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const handleEmailBlur = () => {
    if (!authForm.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }))
      return
    }
    setFieldErrors((prev) => ({
      ...prev,
      email: EMAIL_REGEX.test(authForm.email) ? undefined : 'Informe um e-mail válido.',
    }))
  }

  const handlePasswordBlur = () => {
    if (!authForm.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }))
      return
    }
    const minLength = authMode === 'signup' ? 8 : 6
    setFieldErrors((prev) => ({
      ...prev,
      password:
        authForm.password.length >= minLength
          ? undefined
          : `Senha deve ter ao menos ${minLength} caracteres.`,
    }))
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand p-6">
      <div className="w-full max-w-2xl rounded-[32px] bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-4 rounded-[28px] bg-surface-page p-4">
          <img src="/brand/pin.png" alt="" aria-hidden="true" width={244} height={321} className="h-14 w-auto" />
          <div>
            <img src="/brand/wordmark.png" alt="Primeiro Aqui" width={830} height={182} className="h-6 w-auto" />
            <p className="mt-1 text-xs text-ink-muted">Marketplace local com operação inteligente</p>
          </div>
        </div>

        {/* Hero na identidade da marca (amarelo + navy), nao no bg-ink escuro
            do prototipo original — mesmo motivo do reskin do carrinho. */}
        <div className="mt-6 rounded-[28px] bg-brand p-6 text-navy">
          <h1 className="font-display text-3xl font-black">Compre no bairro e gerencie suas vendas em um só lugar</h1>
          <p className="mt-3 text-sm leading-6 text-navy/80">Uma experiência de compra rápida, pensada para operações locais e crescimento futuro.</p>
        </div>

        {contextMessage ? (
          <p className="mt-4 rounded-[16px] bg-warning/15 px-4 py-3 text-sm font-semibold text-ink">
            {contextMessage}
          </p>
        ) : null}

        {forgotPasswordOpen ? (
          <form
            onSubmit={onForgotPasswordSubmit}
            noValidate
            className="mt-6 rounded-[28px] border border-line p-4"
          >
            {forgotStatus === 'sent' ? (
              <p className="text-sm leading-6 text-ink-muted">
                Se este e-mail estiver cadastrado, você vai receber um link para redefinir sua senha em
                instantes. Confira também a caixa de spam.
              </p>
            ) : (
              <>
                <p className="text-sm leading-6 text-ink-muted">
                  Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>
                <div className="mt-3">
                  <label htmlFor="forgot-email" className="text-sm font-semibold text-ink-muted">
                    E-mail
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => onForgotEmailChange(event.target.value)}
                    placeholder="E-mail"
                    autoComplete="email"
                    inputMode="email"
                    className="mt-1 h-12 w-full rounded-[16px] border border-line px-3 outline-none focus:border-primary"
                  />
                </div>
                {forgotError ? (
                  <p role="alert" className="mt-3 rounded-[14px] bg-error/10 px-3 py-2 text-sm font-semibold text-error">
                    {forgotError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={forgotStatus === 'pending'}
                  className="btn-primary min-h-[44px] mt-4 w-full rounded-[20px] px-4 py-3 disabled:opacity-60"
                >
                  {forgotStatus === 'pending' ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onCloseForgotPassword}
              className="mt-3 w-full text-center text-sm font-semibold text-primary"
            >
              Voltar para o login
            </button>
          </form>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mt-6 rounded-[28px] border border-line p-4"
          >
            <div className="flex gap-2">
              <button type="button" onClick={() => onAuthModeChange('login')} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${authMode === 'login' ? 'bg-primary text-white' : 'bg-surface-sunken text-ink-muted'}`}>Entrar</button>
              <button type="button" onClick={() => onAuthModeChange('signup')} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${authMode === 'signup' ? 'bg-primary text-white' : 'bg-surface-sunken text-ink-muted'}`}>Criar conta</button>
            </div>
            <div className="mt-4 space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="auth-nome" className="text-sm font-semibold text-ink-muted">
                    Seu nome
                  </label>
                  <input
                    id="auth-nome"
                    value={authForm.name}
                    onChange={(event) => onAuthFormChange({ name: event.target.value })}
                    placeholder="Seu nome"
                    autoComplete="name"
                    className="mt-1 h-12 w-full rounded-[16px] border border-line px-3 outline-none focus:border-primary"
                  />
                </div>
              )}
              <div>
                <label htmlFor="auth-email" className="text-sm font-semibold text-ink-muted">
                  E-mail
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => onAuthFormChange({ email: event.target.value })}
                  onBlur={handleEmailBlur}
                  placeholder="E-mail"
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={fieldErrors.email || authError.includes('e-mail') ? true : undefined}
                  className="mt-1 h-12 w-full rounded-[16px] border border-line px-3 outline-none focus:border-primary"
                />
                {fieldErrors.email ? (
                  <p role="alert" className="mt-1 text-xs font-semibold text-error">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="auth-senha" className="text-sm font-semibold text-ink-muted">
                  Senha
                </label>
                <div className="relative mt-1">
                  <input
                    id="auth-senha"
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => onAuthFormChange({ password: event.target.value })}
                    onBlur={handlePasswordBlur}
                    placeholder="Senha"
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    aria-invalid={fieldErrors.password || authError.includes('Senha') ? true : undefined}
                    className="h-12 w-full rounded-[16px] border border-line px-3 pr-11 outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-muted"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p role="alert" className="mt-1 text-xs font-semibold text-error">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={onOpenForgotPassword}
                  className="text-sm font-semibold text-primary"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            {authError ? (
              <p role="alert" className="mt-3 rounded-[14px] bg-error/10 px-3 py-2 text-sm font-semibold text-error">
                {authError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={authPending}
              className="btn-primary min-h-[44px] mt-4 w-full rounded-[20px] px-4 py-3 disabled:opacity-60"
            >
              {authPending ? 'Entrando...' : authMode === 'signup' ? 'Criar conta' : 'Entrar'}
            </button>
          </form>
        )}

        {import.meta.env.DEV && isDevMode ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button onClick={() => onQuickLogin('BUYER')} className="rounded-[24px] border border-line bg-surface-page p-5 text-left transition hover:-translate-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
              <div>
                <h2 className="font-black text-ink">Entrar como cliente</h2>
                <p className="text-sm text-ink-muted">Comprar, acompanhar e receber</p>
              </div>
            </div>
          </button>
          {import.meta.env.DEV && isDevMode ? (
            <button onClick={() => onQuickLogin('ADMIN')} className="rounded-[24px] border border-line bg-surface-page p-5 text-left transition hover:-translate-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy/10 text-navy"><Settings className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-black text-ink">Entrar como operação</h2>
                  <p className="text-sm text-ink-muted">Dashboard da plataforma</p>
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
