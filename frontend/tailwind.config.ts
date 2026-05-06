import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0a0b0a',
          2: '#111312',
          3: '#161917',
          4: '#1d211f',
        },
        rule: {
          DEFAULT: '#262a28',
          2: '#323633',
        },
        paper: {
          DEFAULT: '#efece4',
          2: '#e3dfd2',
        },
        muted: {
          DEFAULT: '#8a8e88',
          2: '#5e625d',
        },
        accent: {
          DEFAULT: '#d3ff3a',
          2: '#a7e600',
        },
        warn: '#ff6a3d',
        ok: '#6dffb1',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Times New Roman', 'serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
      },
      letterSpacing: {
        widest2: '0.18em',
        ultra: '0.22em',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'pulse-accent': 'pulseAccent 1.4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseAccent: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(211,255,58,.6)' },
          '50%': { boxShadow: '0 0 0 6px rgba(211,255,58,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
