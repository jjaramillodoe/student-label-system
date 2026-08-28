'use client';

import type { ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  User,
  Building2,
  Shield,
  Moon,
  Sun,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import CommandPalette from '@/components/CommandPalette';

type AppTopBarProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
    school?: string | null;
  } | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenMobileNav?: () => void;
  /** Left-column eyebrow. Dashboard uses “Workspace”. */
  eyebrow?: string;
  /** Left-column title. Defaults to the user’s school. */
  title?: string;
  /** Optional third line (e.g. school under “Student Intake”). */
  subtitle?: string | null;
  leading?: ReactNode;
  actions?: ReactNode;
  showCommandPalette?: boolean;
  showMobileNav?: boolean;
};

function getUserInitials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getRoleBadgeColor(role?: string | null) {
  switch (role) {
    case 'Admin':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    case 'Data Lead':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    case 'Data Member':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    case 'Intake Member':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

export default function AppTopBar({
  user,
  darkMode,
  onToggleDarkMode,
  onOpenMobileNav,
  eyebrow = 'Workspace',
  title,
  subtitle,
  leading,
  actions,
  showCommandPalette = true,
  showMobileNav = true,
}: AppTopBarProps) {
  const router = useRouter();
  const heading = title || user?.school || 'Student Label System';
  const extraLine = subtitle === undefined ? null : subtitle;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {showMobileNav && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden h-9 w-9 shrink-0"
              onClick={onOpenMobileNav}
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          {leading}
          <div className="min-w-0">
            <p className="ui-eyebrow">{eyebrow}</p>
            <p className="text-sm font-medium truncate">{heading}</p>
            {extraLine ? (
              <p className="text-[11px] text-muted-foreground truncate">{extraLine}</p>
            ) : title && user?.school ? (
              <p className="text-[11px] text-muted-foreground truncate md:hidden">{user.school}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 min-w-0">
          {actions}
          {showCommandPalette && <CommandPalette />}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">
                {user?.name || 'User'}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded border ${getRoleBadgeColor(user?.role)}`}>
                {user?.role || 'User'}
              </span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-8 hidden sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getUserInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              {user?.school && (
                <DropdownMenuItem disabled>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>{user.school}</span>
                </DropdownMenuItem>
              )}
              {user?.role && (
                <DropdownMenuItem disabled>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>{user.role}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
