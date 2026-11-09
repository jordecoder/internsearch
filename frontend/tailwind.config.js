/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        sidebar:    'hsl(var(--sidebar))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Blue hint: links, focus, active indicators, info. Keep it subtle.
        hint: {
          DEFAULT:           'hsl(var(--hint) / <alpha-value>)',
          foreground:        'hsl(var(--hint-foreground))',
          soft:              'hsl(var(--hint-soft) / <alpha-value>)',
          'soft-foreground': 'hsl(var(--hint-soft-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          soft:    'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          soft:    'hsl(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          soft:    'hsl(var(--danger-soft) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg:    'var(--radius)',
        md:    'calc(var(--radius) - 4px)',
        sm:    'calc(var(--radius) - 6px)',
        xl:    'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 14px)',
      },
      boxShadow: {
        tile:    'var(--shadow-tile)',
        float:   'var(--shadow-float)',
        control: 'var(--shadow-control)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        sans:    ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      // Strong custom curves — the built-in CSS easings are too weak.
      transitionTimingFunction: {
        out:      'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        spring:   'cubic-bezier(0.32, 0.72, 0, 1)',
        expo:     'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        120: '120ms',
        160: '160ms',
        180: '180ms',
        250: '250ms',
        400: '400ms',
        600: '600ms',
      },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        // Popovers/menus: never from scale(0); pair with an origin-aware transform-origin.
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'sheet-in-right': {
          from: { transform: 'translateX(104%)' },
          to:   { transform: 'translateX(0)' },
        },
        'sheet-in-left': {
          from: { transform: 'translateX(-104%)' },
          to:   { transform: 'translateX(0)' },
        },
        'sheet-in-bottom': {
          from: { transform: 'translateY(104%)' },
          to:   { transform: 'translateY(0)' },
        },
        'backdrop-in': {
          from: { opacity: '0', backdropFilter: 'blur(0px)' },
          to:   { opacity: '1' },
        },
        'icon-in': {
          '0%':   { opacity: '0', transform: 'scale(0.82) translateY(10px)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)', filter: 'blur(0)' },
        },
        'aurora-1': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%':     { transform: 'translate3d(8vw,-6vh,0) scale(1.12)' },
          '66%':     { transform: 'translate3d(-4vw,7vh,0) scale(0.94)' },
        },
        'aurora-2': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '40%':     { transform: 'translate3d(-9vw,5vh,0) scale(1.08)' },
          '75%':     { transform: 'translate3d(5vw,-8vh,0) scale(0.92)' },
        },
        'aurora-3': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%':     { transform: 'translate3d(6vw,6vh,0) scale(1.15)' },
        },
        'pulse-dot': {
          '0%':   { boxShadow: '0 0 0 0 hsl(var(--hint) / 0.45)' },
          '70%':  { boxShadow: '0 0 0 7px hsl(var(--hint) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--hint) / 0)' },
        },
      },
      animation: {
        shimmer:           'shimmer 1.4s linear infinite',
        'fade-up':         'fade-up 220ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'fade-in':         'fade-in 150ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'scale-in':        'scale-in 180ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'sheet-in-right':  'sheet-in-right 520ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'sheet-in-left':   'sheet-in-left 460ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'sheet-in-bottom': 'sheet-in-bottom 520ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'backdrop-in':     'backdrop-in 400ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'icon-in':         'icon-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'aurora-1':        'aurora-1 26s ease-in-out infinite',
        'aurora-2':        'aurora-2 32s ease-in-out infinite',
        'aurora-3':        'aurora-3 22s ease-in-out infinite',
        'pulse-dot':       'pulse-dot 2.4s cubic-bezier(0.23, 1, 0.32, 1) infinite',
      },
    },
  },
  plugins: [],
};
