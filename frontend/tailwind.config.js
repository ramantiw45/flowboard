/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        'card-hover': '0 4px 8px -2px rgb(15 23 42 / 0.10), 0 12px 28px -8px rgb(15 23 42 / 0.18)',
        pop: '0 12px 32px -8px rgb(15 23 42 / 0.28), 0 2px 6px -2px rgb(15 23 42 / 0.10)',
        sheet: '0 24px 64px -12px rgb(2 6 23 / 0.45)',
      },
      keyframes: {
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(14px) scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(-4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '75%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: {
        'modal-in': 'modal-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        'overlay-in': 'overlay-in 0.2s ease-out',
        'toast-in': 'toast-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop-in': 'pop-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up': 'fade-up 0.38s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.8s linear infinite',
        'ping-soft': 'ping-soft 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
