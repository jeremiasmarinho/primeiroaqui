import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MarketplaceApp from './MarketplaceApp.jsx'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <MarketplaceApp />
  </StrictMode>,
)

// SW só em produção: em dev o SW cacheando módulos/HMR do Vite causa mais
// dor de cabeça do que ajuda, e o objetivo aqui é a experiência instalável
// do build real.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Falha ao registrar service worker', error)
    })
  })
}
