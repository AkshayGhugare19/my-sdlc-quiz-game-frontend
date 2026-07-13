import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Brand tokens read from CSS variables so the theme switcher can swap
      // them at runtime (see :root / [data-theme] blocks in index.css).
      colors: {
        night: 'rgb(var(--c-night) / <alpha-value>)',
        deep: 'rgb(var(--c-deep) / <alpha-value>)',
        neon: 'rgb(var(--c-neon) / <alpha-value>)',
        royal: 'rgb(var(--c-royal) / <alpha-value>)',
        // Muted grays follow the theme too (dark theme lightens text shades and
        // darkens surface shades). 800/900 stay fixed — they are used for
        // always-dark surfaces (race boards, monitor screens).
        slate: {
          ...colors.slate,
          50: 'rgb(var(--s-50) / <alpha-value>)',
          100: 'rgb(var(--s-100) / <alpha-value>)',
          200: 'rgb(var(--s-200) / <alpha-value>)',
          300: 'rgb(var(--s-300) / <alpha-value>)',
          400: 'rgb(var(--s-400) / <alpha-value>)',
          500: 'rgb(var(--s-500) / <alpha-value>)',
          600: 'rgb(var(--s-600) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        dash: { '0%': { backgroundPositionY: '0px' }, '100%': { backgroundPositionY: '80px' } },
      },
      animation: { dash: 'dash 0.4s linear infinite' },
    },
  },
  plugins: [],
};
