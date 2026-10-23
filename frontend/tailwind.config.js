/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#060a13',
          900: '#0b111e',
          850: '#101828',
          800: '#151f31',
        },
        mint: {
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
        },
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2.5xl': '1.25rem',
      },
      boxShadow: {
        glow: '0 0 40px -8px rgb(45 212 191 / 0.35)',
        card: '0 8px 32px -12px rgb(0 0 0 / 0.6)',
        soft: '0 1px 2px rgb(0 0 0 / 0.25), 0 8px 24px -12px rgb(0 0 0 / 0.5)',
        fab: '0 10px 30px -6px rgb(20 184 166 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.4)',
        nav: '0 -8px 32px -12px rgb(0 0 0 / 0.5)',
        lift: '0 12px 40px -12px rgb(0 0 0 / 0.65)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'sheet-up': 'sheet-up 0.3s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
