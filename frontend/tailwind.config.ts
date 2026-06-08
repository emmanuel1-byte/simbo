import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ─────────────────────────────────────────────────────────
        ink: {
          DEFAULT: '#09090B',
          2:       '#111113',
          3:       '#18181B',
          4:       '#1F1F23',
          5:       '#27272C',
        },
        // ── Borders ──────────────────────────────────────────────────────────
        rule: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          2:       'rgba(255,255,255,0.09)',
          3:       'rgba(255,255,255,0.15)',
        },
        // ── Text ─────────────────────────────────────────────────────────────
        paper: {
          DEFAULT: '#EDEAE5',
          2:       '#9A9693',
          3:       '#5C5955',
          inv:     '#1A0E02',
        },
        muted: {
          DEFAULT: '#9A9693',
          2:       '#5C5955',
        },
        // ── Accent — amber intelligence ───────────────────────────────────────
        accent: {
          DEFAULT: '#D4820A',
          2:       '#F0A42A',
          dim:     'rgba(212,130,10,0.12)',
          ring:    'rgba(212,130,10,0.30)',
        },
        // ── Semantic ─────────────────────────────────────────────────────────
        ok:      '#3E9C6E',
        warn:    '#C0504A',
        caution: '#C9843A',
        info:    '#5B8DB8',
      },

      // ── Border radius ───────────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        xs:   '4px',
        sm:   '6px',
        DEFAULT: '6px',
        md:   '10px',
        lg:   '14px',
        xl:   '20px',
        '2xl':'24px',
        '3xl':'32px',
        full: '9999px',
      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        mono:  ['var(--font-mono)', 'ui-monospace', 'monospace'],
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
        xs:    ['11px', { lineHeight: '1.45' }],
      },
      letterSpacing: {
        widest2: '0.18em',
        ultra:   '0.22em',
      },

      // ── Box shadow ──────────────────────────────────────────────────────────
      boxShadow: {
        raised:   '0 1px 3px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
        floating: '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
        overlay:  '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.10)',
        'amber-sm':  '0 0 0 2px rgba(212,130,10,0.30)',
        'amber-md':  '0 0 0 1px rgba(212,130,10,0.80), 0 0 24px rgba(212,130,10,0.12)',
      },

      // ── Animations ──────────────────────────────────────────────────────────
      animation: {
        'fade-in':      'fadeIn 0.25s ease-out',
        'fade-in-up':   'fadeInUp 0.3s ease-out',
        'slide-right':  'slideRight 0.3s ease-out',
        'pulse-accent': 'pulseAccent 1.6s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'blink':        'blink 1.1s step-end infinite',
        'spin':         'spin 0.7s linear infinite',
        'scale-in':     'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        pulseAccent: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,130,10,0.4)' },
          '50%':      { boxShadow: '0 0 0 5px rgba(212,130,10,0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
