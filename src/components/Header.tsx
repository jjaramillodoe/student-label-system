'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  LogOut, 
  User, 
  Building2, 
  Shield,
  Loader2,
  FileText,
  Moon,
  Sun
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

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated' && session?.user?.role === 'Intake Member') {
      router.push('/intake');
    }
  }, [status, session, router]);

  useEffect(() => {
    setMounted(true);
    const savedDarkMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedDarkMode !== null ? savedDarkMode === 'true' : prefersDark;

    setDarkMode(shouldUseDark);
    document.documentElement.classList.toggle('dark', shouldUseDark);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('darkMode', darkMode.toString());
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode, mounted]);

  const getUserInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRoleBadgeColor = (role?: string | null) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'Data Lead':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'Data Member':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  if (status === 'loading') {
    return (
      <header className="bg-background border-b border-border shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-background/95">
        <div className="w-full px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Student Label System</h1>
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <header className="bg-background border-b border-border shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-background/95">
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="flex justify-between items-center gap-4">
          {/* Left side - Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 border border-primary/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                Student Label System
              </h1>
              {session?.user?.school && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {session.user.school}
                </span>
              )}
            </div>
          </div>

          {/* Right side - User Menu */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode(current => !current)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>

            {/* User info - hidden on mobile */}
            <div className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-foreground">
                  {session?.user?.name || 'User'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${getRoleBadgeColor(session?.user?.role)}`}>
                    {session?.user?.role || 'User'}
                  </span>
                </div>
              </div>
            </div>

            <Separator orientation="vertical" className="h-8 hidden md:block" />

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials(session?.user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {session?.user?.school && (
                  <DropdownMenuItem disabled>
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>{session.user.school}</span>
                  </DropdownMenuItem>
                )}
                {session?.user?.role && (
                  <DropdownMenuItem disabled>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>{session.user.role}</span>
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
      </div>
    </header>
  );
} 