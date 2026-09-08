import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar, useSidebarCollapsed } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { CommandMenu } from '@/components/CommandMenu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Jobs',
  '/saved': 'Saved',
  '/board': 'Application Board',
  '/tailor': 'Resume Tailor',
  '/cover-letter': 'Cover Letter',
  '/interview': 'Interview Prep',
  '/settings': 'Settings',
  '/login': 'Log in',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:block flex-shrink-0">
          <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-60 max-w-[80vw]" hideClose>
            <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            title={PAGE_TITLES[pathname] ?? 'Intern Scout'}
            onOpenMobileSidebar={() => setMobileOpen(true)}
            onOpenCommandMenu={() => setCommandOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </TooltipProvider>
  );
}
