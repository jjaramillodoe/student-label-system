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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppSettings } from '@/lib/useAppSettings';

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

  const isActive = (path: string) => pathname === path;

  return (
    <div className="bg-card border-b border-border shadow-sm mb-6 sticky top-0 z-40 backdrop-blur-sm bg-background/95">
      <div className="w-full px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left side - Admin badge and title */}
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

          {/* Right side - Navigation buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <>
                <Button
                  asChild
                  variant={isActive('/admin/users') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/users">
                    <Users size={16} />
                    <span className="hidden sm:inline">User Management</span>
                    <span className="sm:hidden">Users</span>
                  </Link>
                </Button>
                <Separator orientation="vertical" className="h-6 hidden md:block" />
              </>
            )}

            {isAdminOrDataLead && (
              <>
                <Button
                  asChild
                  variant={isActive('/admin/cabinets') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/cabinets">
                    <LayoutGrid size={16} />
                    <span className="hidden sm:inline">Cabinets</span>
                    <span className="sm:hidden">Cabinets</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/cabinet-health') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/cabinet-health">
                    <HeartPulse size={16} />
                    <span className="hidden sm:inline">Cabinet Health</span>
                    <span className="sm:hidden">Health</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/duplicates') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/duplicates">
                    <CopyCheck size={16} />
                    <span className="hidden sm:inline">Duplicates</span>
                    <span className="sm:hidden">Dupes</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/unassigned') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/unassigned">
                    <Inbox size={16} />
                    <span className="hidden sm:inline">Unassigned</span>
                    <span className="sm:hidden">Queue</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/bulk-move') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/bulk-move">
                    <MoveRight size={16} />
                    <span className="hidden sm:inline">Bulk Move</span>
                    <span className="sm:hidden">Move</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/activity-report') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/activity-report">
                    <BarChart3 size={16} />
                    <span className="hidden sm:inline">Activity</span>
                    <span className="sm:hidden">Report</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/print-queue') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/print-queue">
                    <Printer size={16} />
                    <span className="hidden sm:inline">Print Queue</span>
                    <span className="sm:hidden">Prints</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/validation') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/validation">
                    <ShieldCheck size={16} />
                    <span className="hidden sm:inline">Email Validation</span>
                    <span className="sm:hidden">Validate</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant={isActive('/admin/data-cleanup') ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                >
                  <Link href="/admin/data-cleanup">
                    <Sparkles size={16} />
                    <span className="hidden sm:inline">Cleanup</span>
                    <span className="sm:hidden">Clean</span>
                  </Link>
                </Button>

                {isAdminOrDataLead && (
                  <Button
                    asChild
                    variant={isActive('/admin/school-year') ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <Link href="/admin/school-year">
                      <CalendarRange size={16} />
                      <span className="hidden sm:inline">School Year</span>
                      <span className="sm:hidden">Year</span>
                    </Link>
                  </Button>
                )}

                {isAdminOrDataLead && (
                  <Button
                    asChild
                    variant={isActive('/admin/schools') ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <Link href="/admin/schools">
                      <Settings size={16} />
                      <span className="hidden sm:inline">{isAdmin ? 'Schools' : 'School Settings'}</span>
                      <span className="sm:hidden">{isAdmin ? 'Schools' : 'Settings'}</span>
                    </Link>
                  </Button>
                )}

                {settings.showMigrateDrawers && (
                  <Button
                    asChild
                    variant={isActive('/admin/migrate/drawers') ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <Link href="/admin/migrate/drawers">
                      <ArrowRightLeft size={16} />
                      <span className="hidden sm:inline">Migrate Drawers</span>
                      <span className="sm:hidden">Migrate</span>
                    </Link>
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    asChild
                    variant={isActive('/admin/settings') ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    <Link href="/admin/settings">
                      <Settings size={16} />
                      <span className="hidden sm:inline">Settings</span>
                    </Link>
                  </Button>
                )}
                <Separator orientation="vertical" className="h-6 hidden md:block" />
              </>
            )}

            {canViewAllStudents && (
              <Button
                asChild
                variant={isActive('/admin/students/all') ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <Link href="/admin/students/all">
                  <Users size={16} />
                  <span className="hidden sm:inline">All Students</span>
                  <span className="sm:hidden">Students</span>
                </Link>
              </Button>
            )}

            {canViewEnrollment && (
              <Button
                asChild
                variant={isActive('/admin/enrollment') ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <Link href="/admin/enrollment">
                  <UserPlus size={16} />
                  <span className="hidden sm:inline">Enrollment</span>
                  <span className="sm:hidden">Enroll</span>
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant={isActive('/admin/students/bulk-upload') ? 'default' : 'outline'}
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600"
            >
              <Link href="/admin/students/bulk-upload">
                <Upload size={16} />
                <span className="hidden sm:inline">Bulk Upload</span>
                <span className="sm:hidden">Upload</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 