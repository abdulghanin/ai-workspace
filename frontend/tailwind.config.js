/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      colors: {
        void: '#080B14',
        surface: '#0D1117',
        panel: '#161B27',
        border: '#1E2535',
        muted: '#2D3748',
        accent: {
          DEFAULT: '#6EE7B7',
          dim: '#10B981',
          glow: 'rgba(110, 231, 183, 0.15)',
        },
        blue: {
          accent: '#60A5FA',
          dim: '#3B82F6',
        },
        amber: {
          accent: '#FCD34D',
        },
        text: {
          primary: '#E2E8F0',
          secondary: '#94A3B8',
          muted: '#4A5568',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(110, 231, 183, 0.2)',
        'glow-blue': '0 0 20px rgba(96, 165, 250, 0.2)',
        panel: '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 10px rgba(110,231,183,0.2)' }, '50%': { boxShadow: '0 0 25px rgba(110,231,183,0.4)' } },
      },
    },
  },
  plugins: [],
};
