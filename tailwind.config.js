/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50:  '#f0f6f2',
          100: '#daeae0',
          200: '#aed0bb',
          300: '#7db59a',
          400: '#52997a',
          500: '#3a7d5e',
          600: '#2d6249',
          700: '#214936',
        },
        warm: {
          50:  '#f7f5f0',
          100: '#edeae2',
          200: '#dbd5c9',
          300: '#c3bab0',
          400: '#a29890',
          500: '#7a736c',
          600: '#5a5550',
          700: '#3c3934',
          800: '#242220',
          900: '#131110',
        },
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
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
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
        shimmer:   'shimmer 1.6s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease both',
        'fade-in': 'fade-in 0.2s ease both',
        'orb-1':   'orb-1 26s ease-in-out infinite',
        'orb-2':   'orb-2 32s ease-in-out infinite',
        'orb-3':   'orb-3 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
