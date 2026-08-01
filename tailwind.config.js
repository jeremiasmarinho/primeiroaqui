/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FFD91F',
          soft: '#FFE873',
          deep: '#F5C400',
        },
        ink: {
          DEFAULT: '#101418',
          muted: '#5C6670',
          faint: '#8A939C',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          page: '#EBEBEB',
          sunken: '#F5F5F5',
        },
        ship: '#12A150',
        promo: '#E63946',
        line: '#E0E0E0',
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
