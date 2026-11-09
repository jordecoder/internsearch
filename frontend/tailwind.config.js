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
          DEFAULT:         'hsl(var(--hint) / <alpha-value>)',
          foreground:      'hsl(var(--hint-foreground))',
          soft:            'hsl(var(--hint-soft) / <alpha-value>)',
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
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
      // Strong custom curves — built-in CSS easings are too weak.
      transitionTimingFunction: {
        out:      'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer:   'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        120: '120ms',
        160: '160ms',
        180: '180ms',
        250: '250ms',
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
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'orb-1': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '25%':     { transform: 'translate(55px,-35px) scale(1.06)' },
          '50%':     { transform: 'translate(25px,55px) scale(0.96)' },
          '75%':     { transform: 'translate(-35px,20px) scale(1.03)' },
        },
        'orb-2': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%':     { transform: 'translate(-70px,45px) scale(1.09)' },
          '66%':     { transform: 'translate(55px,-55px) scale(0.93)' },
        },
        'orb-3': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '40%':     { transform: 'translate(75px,-40px) scale(1.07)' },
          '80%':     { transform: 'translate(-45px,35px) scale(0.92)' },
        },
      },
      animation: {
        shimmer:          'shimmer 1.4s linear infinite',
        'fade-up':        'fade-up 220ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'fade-in':        'fade-in 150ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'scale-in':       'scale-in 160ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'slide-in-right': 'slide-in-right 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-left':  'slide-in-left 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'orb-1':          'orb-1 26s ease-in-out infinite',
        'orb-2':          'orb-2 32s ease-in-out infinite',
        'orb-3':          'orb-3 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
