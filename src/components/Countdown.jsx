import { useEffect, useRef, useState } from 'react'

const pad = (n) => String(n).padStart(2, '0')

/**
 * Contador regressivo das ofertas relâmpago.
 *
 * Recebe `initialSeconds` em vez de ler o relógio internamente — mantém o
 * componente determinístico e testável com fake timers (regra 4 do
 * ORQUESTRACAO-AGENTES.md). Para reiniciar a contagem, remonte com `key`.
 *
 * Um único intervalo é criado no mount e usa atualização funcional, então não
 * há recriação a cada segundo. `onExpire` vai por ref para não entrar como
 * dependência e derrubar o timer quando o pai recria a função.
 *
 * Acessibilidade: o valor visual usa dígitos tabulares para não "pular" a cada
 * segundo; o leitor de tela recebe um resumo em minutos via aria-label, porque
 * anunciar cada segundo seria ruído.
 */
export default function Countdown({ initialSeconds, onExpire }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, initialSeconds))
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onExpireRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60

  const label =
    remaining <= 0
      ? 'Oferta encerrada'
      : `Termina em ${hours > 0 ? `${hours} horas e ` : ''}${minutes} minutos`

  return (
    <p className="flex items-center gap-1" aria-label={label}>
      {[hours, minutes, seconds].map((unit, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="tabular rounded bg-ink px-1.5 py-0.5 text-xs font-bold leading-none text-white"
        >
          {pad(unit)}
        </span>
      ))}
    </p>
  )
}
