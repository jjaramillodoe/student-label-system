'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Wrench } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { canFixIntakeHandoff } from '@/lib/intakeVisitFix';
import { formatFullName } from '@/lib/personName';

interface IntakeIssueSummary {
  studentId: string;
  firstName: string;
  lastName: string;
  dayLabels: string[];
}

interface IntakeIssuesBannerProps {
  reviewHref?: string;
  onFixStudent?: (issue: IntakeIssueSummary) => void;
  compact?: boolean;
  className?: string;
  refreshToken?: number;
}

export default function IntakeIssuesBanner({
  reviewHref = '/admin/enrollment?issuesOnly=1',
  onFixStudent,
  compact = false,
  className = '',
  refreshToken = 0,
}: IntakeIssuesBannerProps) {
  const [count, setCount] = useState(0);
  const [issues, setIssues] = useState<IntakeIssueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/intake-issues');
      if (!res.ok) {
        setCount(0);
        setIssues([]);
        return;
      }
      const data = await res.json();
      setCount(data.count ?? 0);
      setIssues(data.issues ?? []);
    } catch {
      setCount(0);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  if (loading || count === 0) return null;

  if (compact) {
    return (
      <div className={`rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center justify-between gap-2 ${className}`}>
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {count} intake issue{count !== 1 ? 's' : ''} need correction
        </span>
        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
          <Link href={reviewHref}>Review</Link>
        </Button>
      </div>
    );
  }

  return (
    <Alert className={`border-amber-400 bg-amber-50 dark:bg-amber-950/25 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        {count} student{count !== 1 ? 's' : ''} need intake time corrections
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <p className="mb-2">
          Some students have a missing Time-Out after the session ended, overlapping visit times,
          or times outside the session window. Same-day return visits after Leaving are allowed.
          Use Fix to set an end time, dismiss an earlier visit for re-admit, or correct hours.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="default" className="h-8 gap-1.5" asChild>
            <Link href={reviewHref}>
              <Wrench className="h-3.5 w-3.5" />
              Review on Enrollment
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        {onFixStudent && issues.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {issues.slice(0, 5).map(issue => (
              <li key={issue.studentId} className="flex items-center justify-between gap-2">
                <span>
                  {formatFullName(issue)}
                  <span className="text-amber-700/80 dark:text-amber-300/80">
                    {' '}({issue.dayLabels.join(', ')})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => onFixStudent(issue)}
                >
                  Fix
                </Button>
              </li>
            ))}
            {issues.length > 5 && (
              <li className="text-xs text-amber-700/80">+ {issues.length - 5} more…</li>
            )}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function useCanFixIntake(role?: string | null) {
  return canFixIntakeHandoff(role);
}
