'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getVisibleNavGroups,
  isNavPathActive,
  type NavItem,
} from '@/lib/navConfig';

type AppSidebarProps = {
  role?: string | null;
  schoolName?: string | null;
  showMigrateDrawers?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function NavLinkRow({
  item,
  active,
  collapsed,
  onNavigate,
  labelOverride,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  labelOverride?: string;
}) {
  const Icon = item.icon;
  const label = labelOverride || item.label;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : item.emphasize
            ? 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-80')} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export default function AppSidebar({
  role,
  schoolName,
  showMigrateDrawers,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const groups = getVisibleNavGroups(role, { showMigrateDrawers });

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-2 border-b border-border/80 px-3 py-4', collapsed && 'justify-center px-2')}>
        <Link
          href="/"
          onClick={onMobileClose}
          className={cn('flex min-w-0 items-center gap-2.5', collapsed && 'justify-center')}
        >
          <div className="ui-icon-mark h-9 w-9 rounded-xl shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Label System</p>
              {schoolName && (
                <p className="truncate text-[11px] text-muted-foreground">{schoolName}</p>
              )}
            </div>
          )}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 shrink-0 md:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            {!collapsed && (
              <p className="ui-eyebrow px-2.5 mb-1.5">{group.label}</p>
            )}
            {group.items.map((item) => {
              const labelOverride =
                item.href === '/admin/schools' && role !== 'Admin'
                  ? 'School Settings'
                  : undefined;
              return (
                <NavLinkRow
                  key={item.href}
                  item={item}
                  active={isNavPathActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onMobileClose}
                  labelOverride={labelOverride}
                />
              );
            })}
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-border/80 p-2 md:block">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('w-full gap-2 text-muted-foreground', collapsed && 'px-0')}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 border-r border-border/80 bg-card/95 backdrop-blur-md transition-[width] duration-200',
          collapsed ? 'md:w-[4.5rem]' : 'md:w-60',
        )}
      >
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu overlay"
            onClick={onMobileClose}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] border-r border-border bg-card shadow-xl ui-enter">
            {sidebarInner}
          </aside>
        </div>
      )}
    </>
  );
}
