import { createRequire } from 'node:module'

/** Paleta oficial "Primeiro Aqui" — fonte da verdade em src/design-tokens.json. */
const tokens = createRequire(import.meta.url)('./src/design-tokens.json')

/**
 * Valores derivados: nao constam nos tokens oficiais, mas sao necessarios para
 * estados (hover do amarelo, texto terciario, superficie afundada).
 */
const derived = {
  accentYellowHover: '#E6CF00',
  accentYellowSoft: '#FFF27A',
  textTertiary: '#64748B',
  surfaceSunken: '#F1F5F9',
  promo: '#E63946',
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: tokens.primary,
          hover: tokens.primaryHover,
          active: tokens.primaryActive,
          disabled: tokens.primaryDisabled,
        },
        brand: {
          DEFAULT: tokens.accentYellow,
          soft: derived.accentYellowSoft,
          deep: derived.accentYellowHover,
        },
        navy: tokens.navyInk,
        ink: {
          DEFAULT: tokens.textPrimary,
          muted: tokens.textSecondary,
          faint: derived.textTertiary,
        },
        surface: {
          DEFAULT: tokens.background,
          page: tokens.surface,
          sunken: derived.surfaceSunken,
        },
        success: tokens.success,
        ship: tokens.success,
        error: tokens.error,
        warning: tokens.warning,
        promo: derived.promo,
        border: tokens.border,
        line: tokens.border,
      },
      ringColor: {
        focus: tokens.focusRing,
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Rubik', '"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 20, 24, 0.10)',
        raised: '0 2px 10px rgba(16, 20, 24, 0.12)',
        nav: '0 -1px 8px rgba(16, 20, 24, 0.10)',
        focus: `0 0 0 3px ${tokens.focusRing}`,
      },
      borderRadius: {
        card: '0.5rem',
      },
      spacing: {
        nav: '4.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
}
