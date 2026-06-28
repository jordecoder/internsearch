import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();

  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={cn(
        'text-xs font-semibold tracking-[0.08em] uppercase transition-colors',
        pathname === to
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="relative z-20 flex h-14 items-center justify-between px-5 max-w-5xl mx-auto w-full">
      <Link
        to="/"
        className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        Intern Scout
      </Link>
      <nav className="flex items-center gap-5">
        {link('/', 'Jobs')}
        {link('/tailor', 'Tailor')}
        <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </nav>
    </header>
  );
}
