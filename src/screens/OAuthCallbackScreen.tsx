import { useEffect, useRef } from 'react'

interface OAuthCallbackScreenProps {
  onComplete: (tokens: {
    accessToken: string
    refreshToken: string
    expiresAt?: number
  }) => Promise<{ ok: true } | { ok: false; message: string }>
  /** Volta para /entrar com uma mensagem — token ausente ou rejeitado pelo servidor. */
  onError: (message: string) => void
}

const MISSING_TOKEN_MESSAGE = 'Não foi possível concluir o login com Google. Tente novamente.'

/**
 * Tela `/entrar/callback`, aberta pelo redirect do Supabase após o login com
 * Google. Mesmo padrão de `ResetPasswordScreen`/`useResetPasswordState`: os
 * tokens vêm no FRAGMENTO da URL (`#access_token=...&refresh_token=...`),
 * nunca na query string, porque o fragmento não é enviado ao servidor.
 */
export default function OAuthCallbackScreen({ onComplete, onError }: OAuthCallbackScreenProps) {
  // StrictMode/re-render não pode disparar o POST duas vezes.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expiresAtRaw = params.get('expires_at')

    if (!accessToken || !refreshToken) {
      onError(MISSING_TOKEN_MESSAGE)
      return
    }

    void onComplete({
      accessToken,
      refreshToken,
      expiresAt: expiresAtRaw ? Number(expiresAtRaw) : undefined,
    }).then((result) => {
      if (!result.ok) onError(result.message)
    })
    // Roda uma única vez, na montagem da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-surface-page p-6">
      <p className="text-sm font-semibold text-ink-muted">Entrando com o Google…</p>
    </div>
  )
}
