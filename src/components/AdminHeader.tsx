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

  const primaryLinks: NavLink[] = [
    {
      href: '/admin/users',
      label: 'User Management',
      shortLabel: 'Users',
      icon: Users,
      show: isAdmin,
    },
    {
      href: '/admin/cabinets',
      label: 'Cabinets',
      icon: LayoutGrid,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/cabinet-health',
      label: 'Cabinet Health',
      shortLabel: 'Health',
      icon: HeartPulse,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/duplicates',
      label: 'Duplicates',
      shortLabel: 'Dupes',
      icon: CopyCheck,
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
      href: '/admin/students/all',
      label: 'All Students',
      shortLabel: 'Students',
      icon: Users,
      show: canViewAllStudents,
    },
    {
      href: '/admin/enrollment',
      label: 'Enrollment',
      shortLabel: 'Enroll',
      icon: UserPlus,
      show: canViewEnrollment,
    },
    {
      href: '/admin/print-queue',
      label: 'Print Queue',
      shortLabel: 'Prints',
      icon: Printer,
      show: isAdminOrDataLead,
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

  const moreLinks: NavLink[] = [
    {
      href: '/admin/bulk-move',
      label: 'Bulk Move',
      icon: MoveRight,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/activity-report',
      label: 'Activity Report',
      icon: BarChart3,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/label-stock',
      label: 'Label Stock',
      icon: Package,
      show: isAdminOrDataLead,
    },
    {
      href: '/reports',
      label: 'Print Reports',
      icon: TrendingUp,
      show: isAdminOrDataLead,
    },
    {
      href: '/audit',
      label: 'Audit Log',
      icon: List,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/validation',
      label: 'Email Validation',
      icon: ShieldCheck,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/data-cleanup',
      label: 'Data Cleanup',
      icon: Sparkles,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/school-year',
      label: 'School Year',
      icon: CalendarRange,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/schools',
      label: isAdmin ? 'Schools' : 'School Settings',
      icon: Settings,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/thoughtspot-analytics',
      label: 'ThoughtSpot Analytics',
      icon: LineChart,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/migrate/drawers',
      label: 'Migrate Drawers',
      icon: ArrowRightLeft,
      show: isAdminOrDataLead && settings.showMigrateDrawers,
    },
    {
      href: '/admin/settings',
      label: 'App Settings',
      icon: Settings,
      show: isAdmin,
    },
  ].filter(item => item.show);

  const moreActive = moreLinks.some(link => isActive(link.href));

  return (
    <div className="bg-card border-b border-border shadow-sm mb-6 sticky top-0 z-40 backdrop-blur-sm bg-background/95">
      <div className="w-full px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-md border border-primary/20">
              <Shield size={16} className="text-primary" />
              <span className="text-sm font-semibold text-primary">Admin Panel</span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session?.user?.name || 'Admin'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {primaryLinks.map(link => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Button
                  key={link.href}
                  asChild
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'gap-2',
                    link.emphasize && !active && 'bg-green-600 hover:bg-green-700 text-white border-green-600',
                  )}
                >
                  <Link href={link.href}>
                    <Icon size={16} />
                    <span className="hidden sm:inline">{link.label}</span>
                    <span className="sm:hidden">{link.shortLabel || link.label}</span>
                  </Link>
                </Button>
              );
            })}

            {moreLinks.length > 0 && (
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>More admin tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {moreLinks.map(link => {
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
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
