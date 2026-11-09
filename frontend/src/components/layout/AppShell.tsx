import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar, useSidebarCollapsed } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';

// Shown in the toolbar once the page's own large title scrolls away (iOS large-title behaviour).
const PAGE_TITLES: Record<string, string> = {
  '/': 'Jobs',
  '/saved': 'Saved',
  '/board': 'Board',
  '/apply': 'Apply Agent',
  '/interview': 'Interview Prep',
  '/settings': 'Settings',
};

/** Scroll distance after which the large title has left the screen. */
const COMPACT_AT = 96;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scroll, setScroll] = useState({ scrolled: false, compact: false });
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
    setScroll({ scrolled: false, compact: false });
  }, [pathname]);

  const onScroll = () => {
    const top = mainRef.current?.scrollTop ?? 0;
    const next = { scrolled: top > 4, compact: top > COMPACT_AT };
    setScroll((s) => (s.scrolled === next.scrolled && s.compact === next.compact ? s : next));
  };

  // The login screen is a full-bleed, chrome-free moment.
  if (pathname === '/login') {
    return (
      <TooltipProvider>
        <div className="min-h-[100dvh] bg-background">{children}</div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        <div className="hidden md:block flex-shrink-0">
          <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-72 max-w-[85vw]" hideClose>
            <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar
            title={PAGE_TITLES[pathname] ?? ''}
            scrolled={scroll.scrolled}
            compact={scroll.compact}
            onOpenMobileSidebar={() => setMobileOpen(true)}
          />
          {/* Content scrolls beneath the translucent toolbar */}
          <main ref={mainRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain pt-14">
            <div key={pathname} className="page-enter">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
