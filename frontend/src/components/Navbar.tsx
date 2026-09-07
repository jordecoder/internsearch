import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/', label: 'Jobs' },
  { to: '/board', label: 'Board' },
  { to: '/tailor', label: 'Tailor' },
  { to: '/cover-letter', label: 'Cover Letter' },
  { to: '/interview', label: 'Interview' },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  const navLink = (to: string, label: string, mobile = false) => (
    <Link
      key={to}
      to={to}
      className={cn(
        'font-semibold tracking-[0.08em] uppercase transition-colors',
        mobile ? 'text-sm py-2.5 block' : 'text-xs',
        pathname === to ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="relative z-20 max-w-5xl mx-auto w-full">
      <div className="flex h-14 items-center justify-between px-5">
        <Link
          to="/"
          className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          Intern Scout
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5">
          {LINKS.map((l) => navLink(l.to, l.label))}
          <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </nav>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen((o) => !o)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 top-14 z-10 bg-black/20 md:hidden" onClick={() => setMenuOpen(false)} />
          <nav className="md:hidden absolute inset-x-0 top-full z-20 mx-5 rounded-xl border border-border bg-card shadow-lg px-4 py-1 animate-fade-in divide-y divide-border">
            {LINKS.map((l) => navLink(l.to, l.label, true))}
          </nav>
        </>
      )}
    </header>
  );
}
