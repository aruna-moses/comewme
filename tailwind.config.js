/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sun: 'rgb(var(--color-sun) / <alpha-value>)',
        amber: 'rgb(var(--color-amber) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        verified: 'rgb(var(--color-verified) / <alpha-value>)',
        alert: 'rgb(var(--color-alert) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,15,0.04), 0 8px 24px -12px rgba(11,11,15,0.12)',
        lift: '0 2px 4px rgba(11,11,15,0.05), 0 16px 32px -16px rgba(11,11,15,0.18)',
      },
      backgroundImage: {
        sun: 'linear-gradient(180deg, #F7A233, #EE7B1E)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        pulseSoft: 'pulseSoft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
