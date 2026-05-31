'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Users, 
  LayoutGrid, 
  Home,
  HeartPulse,
  CopyCheck,
  Inbox,
  MoveRight,
  ArrowRightLeft,
  Upload,
  BarChart3,
  Printer,
  Sparkles,
  Settings,
  CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const Navigation = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  const isAdmin = userRole === 'Admin';
  const isAdminOrDataLead = ['Admin', 'Data Lead'].includes(userRole as string);

  const navItems = [
    {
      href: '/',
      label: 'Dashboard',
      icon: Home,
      show: true,
    },
    {
      href: '/admin/users',
      label: 'Users',
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
      label: 'Health',
      icon: HeartPulse,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/duplicates',
      label: 'Duplicates',
      icon: CopyCheck,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/unassigned',
      label: 'Unassigned',
      icon: Inbox,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/bulk-move',
      label: 'Bulk Move',
      icon: MoveRight,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/activity-report',
      label: 'Activity',
      icon: BarChart3,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/print-queue',
      label: 'Prints',
      icon: Printer,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/data-cleanup',
      label: 'Cleanup',
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
      href: '/admin/migrate/drawers',
      label: 'Migrate',
      icon: ArrowRightLeft,
      show: isAdminOrDataLead,
    },
    {
      href: '/admin/students/bulk-upload',
      label: 'Bulk Upload',
      icon: Upload,
      show: true,
    },
  ].filter(item => item.show);

  return (
    <nav className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border w-fit">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        
        return (
          <div key={item.href} className="flex items-center">
            <Button
              asChild
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "gap-2 h-9",
                active && "shadow-sm"
              )}
            >
              <Link href={item.href}>
                <Icon size={16} className="shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.split(' ')[0]}</span>
              </Link>
            </Button>
            {index < navItems.length - 1 && (
              <Separator orientation="vertical" className="h-6 mx-1" />
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default Navigation; 