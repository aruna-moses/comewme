/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sun: '#FFD93D',
        amber: '#FF9F1C',
        ink: '#0B0B0F',
        canvas: '#FAFAF7',
        muted: '#6B6B76',
        verified: '#16A34A',
        alert: '#DC2626',
        line: '#EDEDE8',
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
        sun: 'linear-gradient(135deg, #FFD93D, #FF9F1C)',
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
