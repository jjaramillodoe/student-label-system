'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  LayoutGrid,
  HeartPulse,
  CopyCheck,
  Inbox,
  ArrowRightLeft,
  MoveRight,
  Upload,
  Shield,
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
  MoreHorizontal,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppSettings } from '@/lib/useAppSettings';
import { cn } from '@/lib/utils';

type NavLink = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  show: boolean;
  emphasize?: boolean;
  group?: string;
};

export default function AdminHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRole = session?.user?.role;
  const { settings } = useAppSettings();

  if (!['Admin', 'Data Lead', 'Data Member'].includes(userRole as string)) {
    return null;
  }

  const isAdmin = userRole === 'Admin';
  const isAdminOrDataLead = ['Admin', 'Data Lead'].includes(userRole as string);
  const canViewEnrollment = ['Admin', 'Data Lead', 'Data Member'].includes(userRole as string);
  const canViewAllStudents = canViewEnrollment;

  const isActive = (path: string) =>
    path === '/admin/schools'
      ? Boolean(pathname?.startsWith('/admin/schools'))
      : pathname === path || Boolean(pathname?.startsWith(`${path}/`));

  /** Always visible on desktop; on mobile only these three stay outside More */
  const rushPrimary: NavLink[] = [
    {
      href: '/admin/cabinets',
      label: 'Cabinets',
      icon: LayoutGrid,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/print-queue',
      label: 'Print Queue',
      shortLabel: 'Prints',
      icon: Printer,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/unassigned',
      label: 'Unassigned',
      shortLabel: 'Queue',
      icon: Inbox,
      show: isAdminOrDataLead,
    },
    {
      href: '/intake',
      label: 'Intake',
      icon: ClipboardList,
      show: isAdminOrDataLead,
      emphasize: true,
    },
    {
      href: '/admin/students/all',
      label: 'All Students',
      shortLabel: 'Students',
      icon: Users,
      show: canViewAllStudents,
    },
    {
      href: '/admin/students/bulk-upload',
      label: 'Bulk Upload',
      shortLabel: 'Upload',
      icon: Upload,
      show: true,
      emphasize: true,
    },
  ].filter(item => item.show);

  /** On narrow screens, keep only cabinets / print / unassigned as buttons */
  const mobileRushHrefs = new Set(['/admin/cabinets', '/admin/print-queue', '/admin/unassigned']);

  const moreByGroup: Array<{ group: string; links: NavLink[] }> = [
    {
      group: 'Students',
      links: [
        { href: '/admin/enrollment', label: 'Enrollment', icon: UserPlus, show: canViewEnrollment },
        { href: '/admin/duplicates', label: 'Duplicates', icon: CopyCheck, show: isAdminOrDataLead },
        { href: '/admin/validation', label: 'Email Validation', icon: ShieldCheck, show: isAdminOrDataLead },
      ].filter(l => l.show),
    },
    {
      group: 'Print',
      links: [
        { href: '/admin/label-stock', label: 'Label Stock', icon: Package, show: isAdminOrDataLead },
        { href: '/reports', label: 'Print Reports', icon: TrendingUp, show: isAdminOrDataLead },
      ].filter(l => l.show),
    },
    {
      group: 'Storage',
      links: [
        { href: '/admin/cabinet-health', label: 'Cabinet Health', icon: HeartPulse, show: isAdminOrDataLead },
        { href: '/admin/bulk-move', label: 'Bulk Move', icon: MoveRight, show: isAdminOrDataLead },
      ].filter(l => l.show),
    },
    {
      group: 'Intake',
      links: [
        { href: '/intake', label: 'Open Intake', icon: ClipboardList, show: isAdminOrDataLead },
      ].filter(l => l.show),
    },
    {
      group: 'Admin',
      links: [
        { href: '/admin/users', label: 'User Management', icon: Users, show: isAdmin },
        { href: '/admin/activity-report', label: 'Activity Report', icon: BarChart3, show: isAdminOrDataLead },
        { href: '/audit', label: 'Audit Log', icon: List, show: isAdminOrDataLead },
        { href: '/admin/data-cleanup', label: 'Data Cleanup', icon: Sparkles, show: isAdminOrDataLead },
        { href: '/admin/school-year', label: 'School Year', icon: CalendarRange, show: isAdminOrDataLead },
        { href: '/admin/schools', label: isAdmin ? 'Schools' : 'School Settings', icon: Settings, show: isAdminOrDataLead },
        { href: '/admin/thoughtspot-analytics', label: 'ThoughtSpot Analytics', icon: LineChart, show: isAdminOrDataLead },
        {
          href: '/admin/migrate/drawers',
          label: 'Migrate Drawers',
          icon: ArrowRightLeft,
          show: isAdminOrDataLead && settings.showMigrateDrawers,
        },
        { href: '/admin/settings', label: 'App Settings', icon: Settings, show: isAdmin },
      ].filter(l => l.show),
    },
  ].filter(g => g.links.length > 0);

  const moreActive = moreByGroup.some(g => g.links.some(link => isActive(link.href)));

  /** Links that appear only in More on mobile (not in the three rush buttons) */
  const mobileMoreExtras = rushPrimary.filter(l => !mobileRushHrefs.has(l.href));

  return (
    <div className="bg-card border-b border-border shadow-sm mb-6 sticky top-0 z-40 backdrop-blur-sm bg-background/95">
      <div className="w-full px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-md border border-primary/20">
              <Shield size={16} className="text-primary" />
              <span className="text-sm font-semibold text-primary">Admin</span>
            </div>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <span className="text-sm text-muted-foreground hidden md:inline">
              {session?.user?.name || 'Admin'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {rushPrimary.map(link => {
              const Icon = link.icon;
              const active = isActive(link.href);
              const hideOnMobile = !mobileRushHrefs.has(link.href);
              return (
                <Button
                  key={link.href}
                  asChild
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'gap-2',
                    hideOnMobile && 'hidden md:inline-flex',
                    link.emphasize && !active && 'bg-green-600 hover:bg-green-700 text-white border-green-600',
                  )}
                >
                  <Link href={link.href}>
                    <Icon size={16} />
                    <span className="hidden lg:inline">{link.label}</span>
                    <span className="lg:hidden">{link.shortLabel || link.label}</span>
                  </Link>
                </Button>
              );
            })}

            {moreByGroup.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={moreActive ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <MoreHorizontal size={16} />
                    <span className="hidden sm:inline">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 max-h-[70vh] overflow-y-auto">
                  {/* Mobile: surface primary links that were hidden */}
                  {mobileMoreExtras.length > 0 && (
                    <div className="md:hidden">
                      <DropdownMenuLabel>Quick links</DropdownMenuLabel>
                      {mobileMoreExtras.map(link => {
                        const Icon = link.icon;
                        return (
                          <DropdownMenuItem key={`m-${link.href}`} asChild>
                            <Link href={link.href} className={cn(isActive(link.href) && 'bg-accent')}>
                              <Icon size={16} className="mr-2" />
                              {link.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                    </div>
                  )}
                  {moreByGroup.map((group, gi) => (
                    <div key={group.group}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{group.group}</DropdownMenuLabel>
                      {group.links.map(link => {
                        const Icon = link.icon;
                        return (
                          <DropdownMenuItem key={link.href} asChild>
                            <Link
                              href={link.href}
                              className={cn(isActive(link.href) && 'bg-accent')}
                            >
                              <Icon size={16} className="mr-2" />
                              {link.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
