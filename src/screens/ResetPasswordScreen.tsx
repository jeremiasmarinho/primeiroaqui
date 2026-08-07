import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useResetPasswordState } from '../state/useResetPasswordState'

interface ResetPasswordScreenProps {
  /** Chamado após a troca de senha ser confirmada pelo servidor. */
  onSuccess: () => void
}

/**
 * Tela `/redefinir-senha`, aberta a partir do link de e-mail do Supabase.
 * Os tokens de recuperação vêm no fragmento da URL — ver
 * `useResetPasswordState` para o porquê de não estarem na query string.
 */
export default function ResetPasswordScreen({ onSuccess }: ResetPasswordScreenProps) {
  const { linkError, password, setPassword, confirmPassword, setConfirmPassword, formError, pending, handleSubmit } =
    useResetPasswordState(onSuccess)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand p-6">
      <div className="w-full max-w-md rounded-[32px] bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-4 rounded-[28px] bg-surface-page p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white">
            <KeyRound className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink">Primeiro Aqui</p>
            <p className="text-xs text-ink-muted">Redefinir senha</p>
          </div>
        </div>

        {linkError ? (
          <p role="alert" className="mt-6 rounded-[14px] bg-error/10 px-3 py-2 text-sm font-semibold text-error">
            {linkError}
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 rounded-[28px] border border-line p-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="reset-senha" className="text-sm font-semibold text-ink-muted">
                  Nova senha
                </label>
                <div className="relative mt-1">
                  <input
                    id="reset-senha"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nova senha"
                    autoComplete="new-password"
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
              </div>
              <div>
                <label htmlFor="reset-senha-confirma" className="text-sm font-semibold text-ink-muted">
                  Confirmar nova senha
                </label>
                <input
                  id="reset-senha-confirma"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirmar nova senha"
                  autoComplete="new-password"
                  className="mt-1 h-12 w-full rounded-[16px] border border-line px-3 outline-none focus:border-primary"
                />
              </div>
            </div>

            {formError ? (
              <p role="alert" className="mt-3 rounded-[14px] bg-error/10 px-3 py-2 text-sm font-semibold text-error">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="btn-primary min-h-[44px] mt-4 w-full rounded-[20px] px-4 py-3 disabled:opacity-60"
            >
              {pending ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
