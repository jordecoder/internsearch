import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar, useSidebarCollapsed } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';

// '/login' deliberately has no entry: the login card already shows "Log in" as
// its own heading, so a page title next to the hamburger button would just be
// dead-looking duplicate text sitting beside the account button that does the
// same thing.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Jobs',
  '/saved': 'Saved',
  '/board': 'Application Board',
  '/tailor': 'Resume Tailor',
  '/cover-letter': 'Cover Letter',
  '/interview': 'Interview Prep',
  '/settings': 'Settings',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

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
            title={PAGE_TITLES[pathname] ?? ''}
            onOpenMobileSidebar={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
