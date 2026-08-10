'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Clock, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/lib/useAppSettings';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
];

/** Public / auth routes — no idle prompt. */
function isExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth')
    || pathname.startsWith('/student/')
    || pathname.startsWith('/archive/box')
  );
}

const CHECK_MS = 15_000;
const DEFAULT_GRACE_SECONDS = 60;

/**
 * After N minutes without pointer/keyboard activity, ask if the user is still here.
 * If they do not confirm, sign them out. Configurable in Admin → System Settings.
 */
export default function IdleSessionGuard() {
  const { status } = useSession();
  const pathname = usePathname() || '';
  const { settings, loading: settingsLoading } = useAppSettings();

  const enabled = settings.idleTimeoutEnabled !== false;
  const idleMinutes = Math.min(240, Math.max(1, Number(settings.idleTimeoutMinutes) || 15));
  const graceSeconds = Math.min(
    300,
    Math.max(15, Number(settings.idlePromptGraceSeconds) || DEFAULT_GRACE_SECONDS),
  );

  const [promptOpen, setPromptOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(graceSeconds);
  const lastActivityRef = useRef(Date.now());
  const promptOpenRef = useRef(false);

  const markActivity = useCallback(() => {
    if (promptOpenRef.current) return;
    lastActivityRef.current = Date.now();
  }, []);

  const staySignedIn = useCallback(() => {
    promptOpenRef.current = false;
    setPromptOpen(false);
    lastActivityRef.current = Date.now();
    setSecondsLeft(graceSeconds);
  }, [graceSeconds]);

  const doSignOut = useCallback(() => {
    promptOpenRef.current = false;
    setPromptOpen(false);
    void signOut({ callbackUrl: '/auth/signin' });
  }, []);

  // Track activity while authenticated on app pages
  useEffect(() => {
    if (status !== 'authenticated' || !enabled || isExemptPath(pathname)) return;

    lastActivityRef.current = Date.now();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, markActivity, { passive: true });
    }
    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, markActivity);
      }
    };
  }, [status, enabled, pathname, markActivity]);

  // Idle check → open prompt
  useEffect(() => {
    if (status !== 'authenticated' || settingsLoading || !enabled || isExemptPath(pathname)) {
      return;
    }

    const idleMs = idleMinutes * 60 * 1000;
    const id = window.setInterval(() => {
      if (promptOpenRef.current) return;
      if (Date.now() - lastActivityRef.current >= idleMs) {
        promptOpenRef.current = true;
        setSecondsLeft(graceSeconds);
        setPromptOpen(true);
      }
    }, CHECK_MS);

    return () => window.clearInterval(id);
  }, [status, settingsLoading, enabled, pathname, idleMinutes, graceSeconds]);

  // Countdown while prompt is open
  useEffect(() => {
    if (!promptOpen) return;

    const id = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(id);
          doSignOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [promptOpen, doSignOut]);

  if (status !== 'authenticated' || !enabled || isExemptPath(pathname)) {
    return null;
  }

  return (
    <Dialog
      open={promptOpen}
      onOpenChange={(open) => {
        if (!open) staySignedIn();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Still using the app?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed space-y-2">
            <span className="block">
              No activity for about <strong>{idleMinutes} minutes</strong>.
              Confirm to stay signed in, or you will be signed out in{' '}
              <strong>{secondsLeft} second{secondsLeft === 1 ? '' : 's'}</strong>
              {' '}to protect student data on shared computers.
            </span>
            {pathname.startsWith('/intake') && (
              <span className="block text-muted-foreground">
                If you were filling Intake, a draft is saved in this browser so you can resume after signing back in.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="gap-2" onClick={doSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out now
          </Button>
          <Button type="button" className="gap-2" onClick={staySignedIn} autoFocus>
            Yes, I&apos;m still here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
