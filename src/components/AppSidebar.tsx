'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getVisibleNavGroups,
  isNavPathActive,
  type NavGroup,
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

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const className = cn(
    'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
    collapsed && 'justify-center px-2',
    active
      ? 'bg-primary text-primary-foreground shadow-sm'
      : item.emphasize
        ? 'text-foreground hover:bg-muted'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        className={className}
      >
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-80')} />
        {!collapsed && <span className="truncate">{label}</span>}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={className}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-80')} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function groupHasActiveItem(group: NavGroup, pathname: string | null): boolean {
  return group.items.some(
    (item) => !item.external && isNavPathActive(pathname, item.href),
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
  const mobileTitleId = useId();
  const mobilePanelRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  /** Manual expand/collapse for collapsible groups (default: open). */
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!mobileOpen) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = mobilePanelRef.current;
    const getFocusable = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
          )
        : [];

    const focusables = getFocusable();
    (focusables[0] ?? panel)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onMobileClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus();
    };
  }, [mobileOpen, onMobileClose]);

  const isGroupExpanded = (group: NavGroup) => {
    if (!group.collapsible) return true;
    if (groupHasActiveItem(group, pathname)) return true;
    if (groupOpen[group.id] !== undefined) return groupOpen[group.id];
    return true; // start open so Admin tools (User Management, etc.) stay visible
  };

  const toggleGroup = (groupId: string, currentlyOpen: boolean) => {
    setGroupOpen((prev) => ({ ...prev, [groupId]: !currentlyOpen }));
  };

  const sidebarInner = (opts?: { showClose?: boolean; titleId?: string; forceExpanded?: boolean }) => {
    const railCollapsed = opts?.forceExpanded ? false : collapsed;
    return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-2 border-b border-border/80 px-3 py-4', railCollapsed && 'justify-center px-2')}>
        <Link
          href="/"
          onClick={onMobileClose}
          className={cn('flex min-w-0 items-center gap-2.5', railCollapsed && 'justify-center')}
        >
          <div className="ui-icon-mark h-9 w-9 rounded-xl shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          {!railCollapsed && (
            <div className="min-w-0">
              <p id={opts?.titleId} className="truncate text-sm font-semibold tracking-tight">
                Label System
              </p>
              {schoolName && (
                <p className="truncate text-[11px] text-muted-foreground">{schoolName}</p>
              )}
            </div>
          )}
        </Link>
        {opts?.showClose && (
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
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Main">
        {groups.map((group) => {
          const expanded = railCollapsed || isGroupExpanded(group);
          const collapsible = Boolean(group.collapsible) && !railCollapsed;
          const forcedOpen = groupHasActiveItem(group, pathname);

          return (
            <div key={group.id} className="space-y-1">
              {!railCollapsed && (
                collapsible ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (forcedOpen) return;
                      toggleGroup(group.id, expanded);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-1 rounded-md px-2.5 py-1 text-left',
                      forcedOpen
                        ? 'cursor-default'
                        : 'hover:bg-muted/60',
                    )}
                    aria-expanded={expanded}
                    aria-controls={`nav-group-${group.id}`}
                  >
                    <span className="ui-eyebrow">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                        expanded && 'rotate-180',
                        forcedOpen && 'opacity-40',
                      )}
                    />
                  </button>
                ) : (
                  <p className="ui-eyebrow px-2.5 mb-1.5">{group.label}</p>
                )
              )}
              {expanded && (
                <div id={`nav-group-${group.id}`} className="space-y-1">
                  {group.items.map((item) => {
                    const labelOverride =
                      item.href === '/admin/schools' && role !== 'Admin'
                        ? 'School Settings'
                        : undefined;
                    return (
                      <NavLinkRow
                        key={item.href}
                        item={item}
                        active={!item.external && isNavPathActive(pathname, item.href)}
                        collapsed={railCollapsed}
                        onNavigate={onMobileClose}
                        labelOverride={labelOverride}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {!opts?.forceExpanded && (
        <div className="hidden border-t border-border/80 p-2 md:block">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('w-full gap-2 text-muted-foreground', railCollapsed && 'px-0')}
            onClick={onToggleCollapsed}
            aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {railCollapsed ? <ChevronRight className="h-4 w-4" /> : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 border-r border-border/80 bg-card/95 backdrop-blur-md transition-[width] duration-200',
          collapsed ? 'md:w-[4.5rem]' : 'md:w-60',
        )}
      >
        {sidebarInner()}
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
          <aside
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={mobileTitleId}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] border-r border-border bg-card shadow-xl outline-none ui-enter"
          >
            {sidebarInner({ showClose: true, titleId: mobileTitleId, forceExpanded: true })}
          </aside>
        </div>
      )}
    </>
  );
}
