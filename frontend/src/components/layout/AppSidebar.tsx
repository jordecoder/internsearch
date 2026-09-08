import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Briefcase, Bookmark, Kanban, FileEdit, Mail, MessagesSquare, Settings,
  ChevronsLeft, ChevronsRight, Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Discover',
    items: [
      { to: '/', label: 'Jobs', icon: Briefcase },
      { to: '/saved', label: 'Saved', icon: Bookmark },
    ],
  },
  {
    label: 'Applications',
    items: [{ to: '/board', label: 'Application Board', icon: Kanban }],
  },
  {
    label: 'AI Tools',
    items: [
      { to: '/tailor', label: 'Resume Tailor', icon: FileEdit },
      { to: '/cover-letter', label: 'Cover Letter', icon: Mail },
      { to: '/interview', label: 'Interview Prep', icon: MessagesSquare },
    ],
  },
];

const COLLAPSE_KEY = 'intern_scout_sidebar_collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const active = pathname === item.to;
  const Icon = item.icon;

  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('h-[17px] w-[17px] flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-background transition-[width] duration-150',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center px-0' : 'justify-between px-4')}>
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 text-foreground" onClick={onNavigate}>
            <Compass className="h-4.5 w-4.5 text-primary" />
            <span className="text-sm font-bold tracking-tight" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              Intern Scout
            </span>
          </Link>
        )}
        {collapsed && <Compass className="h-4.5 w-4.5 text-primary" />}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-2.5 py-2.5 space-y-0.5">
        <NavLink item={{ to: '/settings', label: 'Settings', icon: Settings }} collapsed={collapsed} onNavigate={onNavigate} />
        <button
          onClick={onToggle}
          className={cn(
            'hidden md:flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <ChevronsRight className="h-[17px] w-[17px]" /> : <ChevronsLeft className="h-[17px] w-[17px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
