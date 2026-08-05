'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import AppTopBar from '@/components/AppTopBar';
import Footer from '@/components/Footer';
import { useAppSettings } from '@/lib/useAppSettings';
import { canUseAppShell } from '@/lib/navConfig';
import { cn } from '@/lib/utils';

const NO_SHELL_PREFIXES = ['/auth', '/intake', '/student', '/archive', '/docs'];

function shouldUseShell(pathname: string): boolean {
  return !NO_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname() || '';
  const router = useRouter();
  const { settings } = useAppSettings();
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const useShell = shouldUseShell(pathname);
  const role = session?.user?.role;
  const shellEligible = canUseAppShell(role);

  useEffect(() => {
    setMounted(true);
    const savedDarkMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedDarkMode !== null ? savedDarkMode === 'true' : prefersDark;
    setDarkMode(shouldUseDark);
    document.documentElement.classList.toggle('dark', shouldUseDark);

    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    if (savedCollapsed !== null) setCollapsed(savedCollapsed === 'true');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('darkMode', darkMode.toString());
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('sidebar-collapsed', collapsed.toString());
  }, [collapsed, mounted]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!useShell) return;
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated' && role === 'Intake Member') {
      router.push('/intake');
    }
  }, [useShell, status, role, router]);

  // Fullscreen / kiosk-style routes keep their own chrome
  if (!useShell) {
    const hideFooter =
      pathname.startsWith('/auth')
      || pathname.startsWith('/intake')
      || pathname.startsWith('/student')
      || pathname.startsWith('/archive');
    return (
      <>
        {children}
        {!hideFooter && <Footer />}
      </>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!session) return null;

  // Rare: role without shell (shouldn't stay on these routes long)
  if (!shellEligible) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar
        role={role}
        schoolName={session.user?.school}
        showMigrateDrawers={settings.showMigrateDrawers}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          'flex min-h-screen flex-1 flex-col min-w-0 transition-[padding] duration-200',
          collapsed ? 'md:pl-[4.5rem]' : 'md:pl-60',
        )}
      >
        <AppTopBar
          user={session.user}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="w-full max-w-full flex-1 px-4 sm:px-6 py-6">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
