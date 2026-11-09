import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Moon, Sun, LogOut, Settings as SettingsIcon } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommandMenu } from '@/components/CommandMenu';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface TopBarProps {
  title: string;
  /** Content is scrolled under the bar: show the frosted material + hairline. */
  scrolled: boolean;
  /** The page's large title has left the screen: show the compact title. */
  compact: boolean;
  onOpenMobileSidebar: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const iconButton =
  'pressable flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function TopBar({ title, scrolled, compact, onOpenMobileSidebar }: TopBarProps) {
  const { username, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
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
    <header
      className={cn(
        'absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-2 px-3 sm:px-5',
        'border-b transition-[background-color,border-color,backdrop-filter] duration-400 ease-out',
        scrolled ? 'material border-border/80' : 'border-transparent bg-background/0',
      )}
    >
      <button onClick={onOpenMobileSidebar} className={cn(iconButton, 'md:hidden')} aria-label="Open menu">
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {/* Compact title — fades in once the large title scrolls away */}
      <p
        aria-hidden={!compact}
        className={cn(
          'pointer-events-none absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold tracking-[-0.012em] text-foreground',
          'transition-[opacity,transform] duration-400 ease-out',
          compact ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
        )}
      >
        {title}
      </p>

      <div className="flex-1" aria-hidden />

      <div className="flex items-center gap-1">
        <CommandMenu
          open={searchOpen}
          onOpenChange={setSearchOpen}
          anchor={
            <button
              className={cn(
                'pressable group mr-1 hidden sm:flex h-9 w-56 lg:w-64 items-center gap-2 rounded-full bg-card/70 px-3.5 text-[13px] text-muted-foreground shadow-control',
                'hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              <Search className="h-[15px] w-[15px] flex-shrink-0" />
              <span className="flex-1 text-left truncate">Search</span>
              <kbd className="font-sans text-[11px] font-medium tracking-wide text-muted-foreground">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          }
        />
        <button onClick={() => setSearchOpen(true)} className={cn(iconButton, 'sm:hidden')} aria-label="Search">
          <Search className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={iconButton} aria-label="Notifications">
              <Bell className="h-[17px] w-[17px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2.5 py-2 text-[13px] leading-relaxed text-muted-foreground">
              New job alerts go to your Telegram bot. In-app notifications are coming later.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={toggle}
          className={iconButton}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
        </button>

        {username ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="pressable ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Account menu"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide">{username.slice(0, 2)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-semibold text-foreground">{username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <SettingsIcon className="h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="pressable ml-1 h-8 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Log in
          </button>
        )}
      </div>
    </header>
  );
}
