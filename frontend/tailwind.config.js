import colors from 'tailwindcss/colors';

/**
 * Design tokens.
 *
 * Everything a component needs to style itself should exist here, so a change
 * of direction (a new accent, a softer radius, a wider type step) is one edit
 * in one file rather than a sweep through JSX. The rules the app follows:
 *
 *   type      micro (labels/meta) -> xs -> sm (body, titles) -> base -> lg -> 2xl -> 3xl
 *   radius    control (buttons, inputs, badges) -> surface (cards, panels) -> overlay (dialogs)
 *   elevation card -> card-hover -> panel (containers) -> pop (menus) -> sheet (dialogs)
 *   depth     base -> dropdown -> panel -> header -> modal -> toast
 *   colour    brand (identity) + success/warning/danger/info (state) + slate (neutral)
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        /** Micro labels: badges, counters, ids, timestamps. One step, not five. */
        micro: ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        /** 18px — optical icon size that reads correctly inside 32px/36px tiles. */
        '4.5': '1.125rem',
      },
      width: {
        /** The fixed kanban column width shared by columns, skeletons and the add-list tile. */
        column: '19rem',
        /** Responsive toast stack width, so the container never touches the viewport edge. */
        toast: 'min(23rem, calc(100vw - 2.5rem))',
      },
      maxWidth: {
        /** Board switcher label cap before it truncates. */
        switcher: '15rem',
      },
      minWidth: {
        /** Dashboard search field floor, so the placeholder never gets clipped. */
        search: '13rem',
      },
      borderRadius: {
        control: '0.5rem',
        surface: '0.75rem',
        overlay: '1rem',
      },
      zIndex: {
        base: '10',
        dropdown: '20',
        panel: '30',
        header: '40',
        modal: '50',
        toast: '100',
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
        /*
         * State ramps. Aliases of the palettes the app already used, so the
         * rendered colours do not change — but components now say what a colour
         * means (`text-danger-600`) instead of which hue it happens to be, and
         * the shade is chosen once here instead of per component.
         */
        success: colors.emerald,
        warning: colors.amber,
        danger: colors.rose,
        info: colors.sky,
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        'card-hover': '0 4px 8px -2px rgb(15 23 42 / 0.10), 0 12px 28px -8px rgb(15 23 42 / 0.18)',
        /** Static containers (board columns, add-list tile). Reads as structure, not a popover. */
        panel: '0 10px 30px -14px rgb(2 6 23 / 0.55)',
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
