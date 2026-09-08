import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Moon, Sun, UserRound, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommandMenu } from '@/components/CommandMenu';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

interface TopBarProps {
  title: string;
  onOpenMobileSidebar: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

export function TopBar({ title, onOpenMobileSidebar }: TopBarProps) {
  const { username, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4">
      <button
        onClick={onOpenMobileSidebar}
        className="md:hidden -ml-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Open menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <h1 className="hidden sm:block text-sm font-semibold text-foreground flex-shrink-0">{title}</h1>

      <CommandMenu
        open={searchOpen}
        onOpenChange={setSearchOpen}
        anchor={
          <button
            className="ml-auto sm:ml-4 flex-1 max-w-sm flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted transition-colors"
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1 text-left truncate">Search jobs, pages…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground/80">
              {isMac ? '⌘' : 'Ctrl'}K
            </kbd>
          </button>
        }
      />

      {/* Absorbs any leftover space so the icon cluster below stays pinned to the
          right edge instead of drifting toward the middle once the search box
          (capped at max-w-sm) stops growing on wide screens. */}
      <div className="flex-1" aria-hidden />

      <div className="flex items-center gap-1 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2 py-2 text-xs text-muted-foreground leading-relaxed">
              In-app notifications aren't wired up yet — new job alerts are still sent to your Telegram bot.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {username ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <span className="text-xs font-bold uppercase">{username.slice(0, 2)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="h-3.5 w-3.5" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          pathname !== '/login' && (
            <Button size="sm" variant="outline" onClick={() => navigate('/login')} className="h-8 gap-1.5">
              <UserRound className="h-3.5 w-3.5" /> Log in
            </Button>
          )
        )}
      </div>
    </header>
  );
}
