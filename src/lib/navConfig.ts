import {
  Users,
  LayoutGrid,
  HeartPulse,
  CopyCheck,
  Inbox,
  ArrowRightLeft,
  MoveRight,
  Upload,
  BarChart3,
  Printer,
  Sparkles,
  CalendarRange,
  Settings,
  UserPlus,
  ShieldCheck,
  Package,
  TrendingUp,
  List,
  LineChart,
  ClipboardList,
  FileText,
  BookOpen,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';

export type NavRole = 'Admin' | 'Data Lead' | 'Data Member' | 'Intake Member' | string;

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that can see this item. Empty = all authenticated staff with shell access. */
  roles?: NavRole[];
  /** Requires app setting showMigrateDrawers */
  requiresMigrateDrawers?: boolean;
  emphasize?: boolean;
  /** Open in a new tab (external docs, etc.) */
  external?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
  /** Start collapsed when no child route is active (Admin tools). */
  defaultCollapsed?: boolean;
};

export const SHELL_ROLES: NavRole[] = ['Admin', 'Data Lead', 'Data Member'];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'daily',
    label: 'Daily',
    items: [
      { href: '/', label: 'Dashboard', icon: FileText },
      { href: '/intake', label: 'Intake', icon: ClipboardList, roles: ['Admin', 'Data Lead'], emphasize: true },
      { href: '/admin/unassigned', label: 'Unassigned', icon: Inbox, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/print-queue', label: 'Print Queue', icon: Printer, roles: ['Admin', 'Data Lead'] },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    items: [
      { href: '/admin/students/all', label: 'All Students', icon: Users },
      { href: '/admin/students/bulk-upload', label: 'Bulk Upload', icon: Upload, emphasize: true },
      { href: '/admin/enrollment', label: 'Enrollment', icon: UserPlus },
      { href: '/admin/duplicates', label: 'Duplicates', icon: CopyCheck, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/validation', label: 'Email Validation', icon: ShieldCheck, roles: ['Admin'] },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    items: [
      { href: '/admin/cabinets', label: 'Cabinets', icon: LayoutGrid, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/cabinet-health', label: 'Cabinet Health', icon: HeartPulse, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/bulk-move', label: 'Bulk Move', icon: MoveRight, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/school-year', label: 'School Year', icon: CalendarRange, roles: ['Admin', 'Data Lead'] },
    ],
  },
  {
    id: 'print',
    label: 'Print',
    items: [
      { href: '/admin/label-stock', label: 'Label Stock', icon: Package, roles: ['Admin', 'Data Lead'] },
      { href: '/reports', label: 'Print Reports', icon: TrendingUp, roles: ['Admin', 'Data Lead'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    defaultCollapsed: true,
    items: [
      { href: '/admin/users', label: 'User Management', icon: Users, roles: ['Admin'] },
      { href: '/admin/schools', label: 'Schools', icon: Settings, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/activity-report', label: 'Activity Report', icon: BarChart3, roles: ['Admin', 'Data Lead'] },
      { href: '/audit', label: 'Audit Log', icon: List, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/data-cleanup', label: 'Data Cleanup', icon: Sparkles, roles: ['Admin', 'Data Lead'] },
      { href: '/admin/thoughtspot-analytics', label: 'ThoughtSpot', icon: LineChart, roles: ['Admin'] },
      {
        href: '/admin/migrate/drawers',
        label: 'Migrate Drawers',
        icon: ArrowRightLeft,
        roles: ['Admin', 'Data Lead'],
        requiresMigrateDrawers: true,
      },
      { href: '/admin/settings', label: 'App Settings', icon: Settings, roles: ['Admin'] },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { href: '/docs', label: 'In-app guide', icon: BookOpen },
      { href: MINTLIFY_DOCS_URL, label: 'Full docs', icon: ExternalLink, external: true },
    ],
  },
];

export function canUseAppShell(role?: string | null): boolean {
  return SHELL_ROLES.includes(role as NavRole);
}

export function isNavItemVisible(
  item: NavItem,
  role?: string | null,
  opts?: { showMigrateDrawers?: boolean },
): boolean {
  if (item.requiresMigrateDrawers && !opts?.showMigrateDrawers) return false;
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role as NavRole);
}

export function isNavPathActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  if (href === '/admin/schools') return pathname.startsWith('/admin/schools');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getVisibleNavGroups(
  role?: string | null,
  opts?: { showMigrateDrawers?: boolean },
): NavGroup[] {
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item, role, opts)),
    }))
    .filter((group) => group.items.length > 0);
}
