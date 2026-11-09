import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Briefcase, Bookmark, Kanban, Sparkles, MessagesSquare, Settings,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { cn, relativeTime, sourceLabel } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AppMark } from '@/components/AppMark';
import { useJobsQuery } from '@/hooks/useJobsQuery';
import { useBoardQuery } from '@/hooks/useBoardQuery';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

const COLLAPSE_KEY = 'intern_scout_sidebar_collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar';

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const active = pathname === item.to;
  const Icon = item.icon;

  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium tracking-[-0.01em]',
        'transition-[background-color,color,box-shadow] duration-160 ease-out',
        focusRing,
        active
          ? 'bg-card text-foreground shadow-control'
          : 'text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground',
        collapsed && 'w-9 justify-center px-0 mx-auto',
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] flex-shrink-0 transition-colors duration-160',
          active ? 'text-hint' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.count !== undefined && item.count > 0 && (
        <span className={cn('text-[12px] font-medium tabular-nums', active ? 'text-muted-foreground' : 'text-muted-foreground/90')}>
          {item.count}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { jobs, exportedAt } = useJobsQuery();
  const { username } = useAuth();
  const { data: board } = useBoardQuery(!!username);

  const counts = useMemo(() => {
    const entries = Object.values(board ?? {});
    return {
      saved: entries.filter((e) => e.status !== 'skipped').length,
      active: entries.filter((e) => ['applied', 'interviewing', 'offer'].includes(e.status)).length,
    };
  }, [board]);

  const sources = useMemo(() => {
    const s = [...new Set(jobs.map((j) => sourceLabel(j.source)))];
    return s.length > 2 ? `${s.slice(0, 2).join(', ')} +${s.length - 2}` : s.join(' and ');
  }, [jobs]);

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Discover',
      items: [
        { to: '/', label: 'Jobs', icon: Briefcase, count: jobs.length },
        { to: '/saved', label: 'Saved', icon: Bookmark, count: counts.saved },
      ],
    },
    {
      label: 'Track',
      items: [{ to: '/board', label: 'Board', icon: Kanban, count: counts.active }],
    },
    {
      label: 'Prepare',
      items: [
        { to: '/apply', label: 'Apply Agent', icon: Sparkles },
        { to: '/interview', label: 'Interview Prep', icon: MessagesSquare },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border/70 bg-sidebar',
        'transition-[width] duration-250 ease-out motion-reduce:transition-none',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-14 flex-shrink-0 items-center', collapsed ? 'justify-center' : 'px-4')}>
        <Link to="/" onClick={onNavigate} className={cn('flex items-center gap-2.5 rounded-lg', focusRing)} aria-label="Intern Scout home">
          <AppMark size={28} />
          {!collapsed && <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">Intern Scout</span>}
        </Link>
      </div>

      <nav className={cn('flex-1 overflow-y-auto pb-4 pt-3', collapsed ? 'px-2' : 'px-3')}>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[12px] font-semibold tracking-[-0.003em] text-muted-foreground">{group.label}</p>
              )}
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className={cn('flex-shrink-0 space-y-1 pb-3 pt-2', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && exportedAt && (
          <div className="mx-1 mb-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] text-muted-foreground">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="h-2 w-2 rounded-full bg-hint animate-pulse-dot" />
            </span>
            <span className="leading-tight">
              Scouted {relativeTime(exportedAt)}
              {sources && <span className="block text-[11px]">From {sources}</span>}
            </span>
          </div>
        )}
        <NavLink item={{ to: '/settings', label: 'Settings', icon: Settings }} collapsed={collapsed} onNavigate={onNavigate} />
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'pressable hidden md:flex h-9 w-full items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground',
            focusRing,
            collapsed && 'w-9 justify-center px-0 mx-auto',
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
