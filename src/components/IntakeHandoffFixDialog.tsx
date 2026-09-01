'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, AlertTriangle, CheckCircle2, Wrench, CalendarDays, Clock, HelpCircle,
} from 'lucide-react';
import {
  validateIntakeVisits,
  formatDayLabel,
  visitDayKey,
} from '@/lib/intakeVisitValidation';
import {
  buildIntakeFixPreview,
  dayAfter,
  getLastVisitIndexForDay,
  listEarlierOpenVisits,
  suggestDefaultTimeOut,
} from '@/lib/intakeVisitFix';
import { formatMinutesOfDay, nowMinutesOfDay, todayDayKey } from '@/lib/intakeCalendar';
import {
  DEFAULT_INTAKE_SESSION_CONFIGS,
  findIntakeSession,
  formatSessionTimeRange,
  getIntakeSessionTimeFieldErrors,
  type IntakeSession,
} from '@/lib/intakeSession';
import { cn } from '@/lib/utils';

interface IntakeVisitRecord {
  date?: string;
  timeIn?: string;
  timeOut?: string | null;
  isLeaving?: string;
  intakeSession?: string;
  intakeActivity?: string[];
  recordedBy?: { name?: string; email?: string };
}

type FixMode = 'same_day' | 'catch_up';

interface ClosingDraft {
  visitDate: string;
  timeIn: string;
  timeOut: string;
}

function todayDateKey(): string {
  return todayDayKey();
}

function nowHHMM(): string {
  return formatMinutesOfDay(nowMinutesOfDay());
}

interface IntakeHandoffFixDialogProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFixed?: () => void;
}

export default function IntakeHandoffFixDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  onFixed,
}: IntakeHandoffFixDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [visits, setVisits] = useState<IntakeVisitRecord[]>([]);
  const [sessionConfigs, setSessionConfigs] = useState<IntakeSession[]>(DEFAULT_INTAKE_SESSION_CONFIGS);
  const originalVisitsRef = useRef<string>('[]');
  const [finalClockOuts, setFinalClockOuts] = useState<Record<string, string>>({});
  const [fixModes, setFixModes] = useState<Record<string, FixMode>>({});
  const [closingDrafts, setClosingDrafts] = useState<Record<string, ClosingDraft>>({});
  const [extraClockOuts, setExtraClockOuts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/students/${studentId}`);
      if (!res.ok) throw new Error('Failed to load student');
      const data = await res.json();
      const sessions: IntakeSession[] = Array.isArray(data.schoolIntakeSessions)
        && data.schoolIntakeSessions.length
        ? data.schoolIntakeSessions
        : DEFAULT_INTAKE_SESSION_CONFIGS;
      setSessionConfigs(sessions);

      const list: IntakeVisitRecord[] = Array.isArray(data.intakeVisits) && data.intakeVisits.length
        ? [...data.intakeVisits].sort(
            (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
          )
        : data.timeIn
          ? [{
              date: data.createdAt,
              timeIn: data.timeIn,
              timeOut: data.timeOut ?? null,
              isLeaving: data.isLeaving,
              intakeSession: data.intakeSession,
              intakeActivity: data.intakeActivity,
              recordedBy: data.createdBy,
            }]
          : [];
      setVisits(list);
      originalVisitsRef.current = JSON.stringify(list);

      const loaded = validateIntakeVisits(list, { sessionConfigs: sessions });
      const defaults: Record<string, string> = {};
      for (const issue of loaded.dayIssues) {
        if (!issue.missingFinalClockOut) continue;
        const idx = getLastVisitIndexForDay(list, issue.dayKey);
        const visit = idx !== null ? list[idx] : null;
        if (!visit) continue;
        defaults[issue.dayKey] = suggestDefaultTimeOut({
          visit,
          session: findIntakeSession(sessions, visit.intakeSession),
        });
      }
      setFinalClockOuts(defaults);
      setFixModes({});
      setClosingDrafts({});
      setExtraClockOuts({});
    } catch {
      setError('Could not load intake visit history.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const closingVisits = useMemo(
    () => Object.entries(fixModes)
      .filter(([, mode]) => mode === 'catch_up')
      .map(([forDayKey]) => {
        const draft = closingDrafts[forDayKey];
        if (!draft?.visitDate?.trim() || !draft.timeIn?.trim() || !draft.timeOut?.trim()) return null;
        return {
          forDayKey,
          visitDate: draft.visitDate.trim(),
          timeIn: draft.timeIn.trim(),
          timeOut: draft.timeOut.trim(),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null),
    [fixModes, closingDrafts],
  );

  const sameDayClockOuts = useMemo(
    () => Object.entries(finalClockOuts)
      .filter(([dayKey, timeOut]) => timeOut.trim() && (fixModes[dayKey] ?? 'same_day') === 'same_day')
      .map(([dayKey, timeOut]) => ({ dayKey, timeOut: timeOut.trim() })),
    [finalClockOuts, fixModes],
  );

  const extraClockOutList = useMemo(
    () => Object.entries(extraClockOuts)
      .filter(([, timeOut]) => timeOut.trim())
      .map(([index, timeOut]) => ({ visitIndex: Number(index), timeOut: timeOut.trim() })),
    [extraClockOuts],
  );

  const validation = useMemo(
    () => validateIntakeVisits(visits, { sessionConfigs }),
    [visits, sessionConfigs],
  );

  const preview = useMemo(
    () => buildIntakeFixPreview(
      visits,
      sameDayClockOuts,
      closingVisits,
      undefined,
      extraClockOutList,
      { sessionConfigs },
    ),
    [visits, sameDayClockOuts, closingVisits, extraClockOutList, sessionConfigs],
  );

  const pendingValidation = useMemo(
    () => validateIntakeVisits(preview.visits, { sessionConfigs }),
    [preview.visits, sessionConfigs],
  );

  const timeEditIndices = useMemo(
    () => [...new Set(
      validation.flags
        .filter(f => f.type === 'outside_session_window' || f.type === 'overlapping_times')
        .map(f => f.visitIndex),
    )].sort((a, b) => a - b),
    [validation.flags],
  );

  const daysNeedingFinal = useMemo(
    () => validation.dayIssues
      .filter(d => d.missingFinalClockOut)
      .map(d => ({
        dayKey: d.dayKey,
        dayLabel: d.dayLabel,
        visitIndex: getLastVisitIndexForDay(visits, d.dayKey) ?? -1,
      }))
      .filter(d => d.visitIndex >= 0),
    [validation.dayIssues, visits],
  );

  const earlierOpen = useMemo(
    () => listEarlierOpenVisits(visits, { sessionConfigs }),
    [visits, sessionConfigs],
  );

  const visitsModified = JSON.stringify(visits) !== originalVisitsRef.current;

  const setMode = (dayKey: string, mode: FixMode) => {
    setFixModes(prev => ({ ...prev, [dayKey]: mode }));
    if (mode === 'catch_up' && !closingDrafts[dayKey]) {
      setClosingDrafts(prev => ({
        ...prev,
        [dayKey]: {
          visitDate: dayAfter(dayKey) > todayDateKey() ? dayAfter(dayKey) : todayDateKey(),
          timeIn: nowHHMM(),
          timeOut: '',
        },
      }));
    }
  };

  const updateVisit = (index: number, patch: Partial<IntakeVisitRecord>) => {
    setVisits(prev => prev.map((visit, i) => (i === index ? { ...visit, ...patch } : visit)));
  };

  const applySuggestedEnd = (dayKey: string, timeOut: string) => {
    setFixModes(prev => ({ ...prev, [dayKey]: 'same_day' }));
    setFinalClockOuts(prev => ({ ...prev, [dayKey]: timeOut }));
  };

  const applyDismissAndReadmit = () => {
    setExtraClockOuts(prev => {
      const next = { ...prev };
      for (const item of earlierOpen) {
        next[item.visitIndex] = item.suggestedTimeOut;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/students/${studentId}/intake-visits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visits,
          finalClockOuts: sameDayClockOuts,
          closingVisits,
          extraClockOuts: extraClockOutList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save fixes');
      }
      onFixed?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save fixes');
    } finally {
      setSaving(false);
    }
  };

  const hasSomethingToSave = preview.changes.length > 0 || visitsModified;
  const remainingMessages = [...new Set(pendingValidation.flags.map(f => f.message))];
  const canSave = hasSomethingToSave && remainingMessages.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Fix intake issues — {studentName}
          </DialogTitle>
          <DialogDescription>
            Set a missing Time Out, correct overlapping clocks, or adjust session hours.
            Students may leave and return the same day — each completed cycle needs its own Time Out.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading visit history…
          </div>
        )}

        {!loading && (
          <details className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              How to resolve these issues
            </summary>
            <ul className="mt-2 list-disc list-inside space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong className="text-foreground">Handoff:</strong> the student stays on campus
                with another staff member. Mark earlier activities <strong className="text-foreground">Staying</strong>.
                Only the last activity needs Time Out when they leave.
              </li>
              <li>
                <strong className="text-foreground">Left, then returned:</strong> mark
                {' '}<strong className="text-foreground">Leaving</strong> with Time Out when they depart.
                Log a new visit when they come back the same day (same session or a later one).
              </li>
              <li>
                <strong className="text-foreground">Missing Time-Out:</strong> the session or day ended
                and the last visit is still open. Use <strong className="text-foreground">Set End Time</strong>
                {' '}(now or session end), or add a catch-up visit the next day.
              </li>
              <li>
                <strong className="text-foreground">Overlapping times:</strong> Time Out on an earlier visit
                must be at or before the next Time In. Adjust the clocks, or mark the earlier visit Staying
                if it was a handoff.
              </li>
            </ul>
          </details>
        )}

        {!loading && validation.hasIssues && (
          <div className="space-y-4">
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Issues found</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm mt-1 space-y-0.5">
                  {validation.dayIssues.map(issue => (
                    <li key={issue.dayKey}>
                      {issue.dayLabel}:
                      {issue.outsideSessionCount > 0 && ` ${issue.outsideSessionCount} outside session hours`}
                      {issue.outsideSessionCount > 0 && (issue.overlappingCount > 0 || issue.missingFinalClockOut) && ' · '}
                      {issue.overlappingCount > 0 && 'overlapping times'}
                      {issue.overlappingCount > 0 && issue.missingFinalClockOut && ' · '}
                      {issue.missingFinalClockOut && 'missing Time-Out'}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            {timeEditIndices.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Adjust visit times</p>
                {timeEditIndices.map(index => {
                  const visit = visits[index];
                  if (!visit) return null;
                  const dayKey = visitDayKey(visit.date) || 'unknown';
                  const session = findIntakeSession(sessionConfigs, visit.intakeSession);
                  const fieldErrors = getIntakeSessionTimeFieldErrors({
                    intakeSession: visit.intakeSession,
                    timeIn: visit.timeIn,
                    timeOut: visit.timeOut,
                    sessions: sessionConfigs,
                  });
                  const visitFlags = validation.flags.filter(f => f.visitIndex === index);

                  return (
                    <div key={index} className="rounded-md border p-3 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {formatDayLabel(dayKey)}
                          {visit.intakeActivity?.length ? ` — ${visit.intakeActivity.join(', ')}` : ''}
                        </p>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {visitFlags.map(flag => (
                            <li key={flag.message}>{flag.message}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Intake session</Label>
                        <Select
                          value={visit.intakeSession || ''}
                          onValueChange={value => updateVisit(index, { intakeSession: value })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select session" />
                          </SelectTrigger>
                          <SelectContent>
                            {sessionConfigs.map(s => (
                              <SelectItem key={s.name} value={s.name}>
                                {s.name} ({formatSessionTimeRange(s)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Time In
                          </Label>
                          <Input
                            type="time"
                            className={cn('h-8 text-sm', fieldErrors.timeIn && 'border-destructive')}
                            value={visit.timeIn || ''}
                            onChange={e => updateVisit(index, { timeIn: e.target.value })}
                          />
                          {fieldErrors.timeIn && (
                            <p className="text-xs text-destructive">{fieldErrors.timeIn}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Time Out
                          </Label>
                          <Input
                            type="time"
                            className={cn('h-8 text-sm', fieldErrors.timeOut && 'border-destructive')}
                            value={visit.timeOut || ''}
                            onChange={e => updateVisit(index, { timeOut: e.target.value || null })}
                          />
                          {fieldErrors.timeOut && (
                            <p className="text-xs text-destructive">{fieldErrors.timeOut}</p>
                          )}
                        </div>
                      </div>

                      {session && (
                        <p className="text-xs text-muted-foreground">
                          Allowed window for {session.name}:{' '}
                          <strong>{formatSessionTimeRange(session)}</strong>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {earlierOpen.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Dismiss &amp; Re-admit</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use when the student left and came back. Clock out the earlier visit so the later
                      activity is a returning intake.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={applyDismissAndReadmit}
                  >
                    Clock out earlier visits
                  </Button>
                </div>
                {earlierOpen.map(item => (
                  <div key={item.visitIndex} className="rounded-md border p-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        Visit #{item.visitIndex + 1} — {item.dayLabel}
                        {item.activity ? ` · ${item.activity}` : ''}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Time In {item.timeIn || '—'} · suggested Time Out {item.suggestedTimeOut}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Time Out</Label>
                      <Input
                        type="time"
                        className="h-8 text-sm w-[140px]"
                        value={extraClockOuts[item.visitIndex] || ''}
                        onChange={e => setExtraClockOuts(prev => ({
                          ...prev,
                          [item.visitIndex]: e.target.value,
                        }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {preview.changes.length > 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium mb-1">Changes to apply</p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                  {preview.changes.map(change => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            {daysNeedingFinal.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Set End Time</p>
                {daysNeedingFinal.map(day => {
                  const idx = getLastVisitIndexForDay(visits, day.dayKey);
                  const visit = idx !== null ? visits[idx] : null;
                  const mode = fixModes[day.dayKey] ?? 'same_day';
                  const draft = closingDrafts[day.dayKey];
                  const session = visit
                    ? findIntakeSession(sessionConfigs, visit.intakeSession)
                    : undefined;
                  const sessionEnd = session?.endTime || '';
                  const suggestedNow = nowHHMM();
                  return (
                    <div key={day.dayKey} className="rounded-md border p-3 space-y-3">
                      <p className="text-xs font-medium text-foreground">
                        {day.dayLabel}
                        {visit?.intakeActivity?.length ? ` — last activity: ${visit.intakeActivity.join(', ')}` : ''}
                      </p>

                      <div className="flex flex-col gap-2">
                        <label className="flex items-start gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`fix-mode-${day.dayKey}`}
                            checked={mode === 'same_day'}
                            onChange={() => setMode(day.dayKey, 'same_day')}
                            className="mt-1 accent-primary"
                          />
                          <span>
                            <span className="font-medium">Set End Time on the last visit</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              Use when you know when the student left on {day.dayLabel}.
                            </span>
                          </span>
                        </label>
                        {mode === 'same_day' && (
                          <div className="ml-6 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Label htmlFor={`final-out-${day.dayKey}`} className="text-xs shrink-0">
                                Time Out
                              </Label>
                              <Input
                                id={`final-out-${day.dayKey}`}
                                type="time"
                                className="h-8 text-sm max-w-[160px]"
                                value={finalClockOuts[day.dayKey] || ''}
                                onChange={e => setFinalClockOuts(prev => ({
                                  ...prev,
                                  [day.dayKey]: e.target.value,
                                }))}
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => applySuggestedEnd(day.dayKey, suggestedNow)}
                              >
                                Use now ({suggestedNow})
                              </Button>
                              {sessionEnd && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => applySuggestedEnd(day.dayKey, sessionEnd)}
                                >
                                  Use session end ({sessionEnd})
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        <label className="flex items-start gap-2 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`fix-mode-${day.dayKey}`}
                            checked={mode === 'catch_up'}
                            onChange={() => setMode(day.dayKey, 'catch_up')}
                            className="mt-1 accent-primary"
                          />
                          <span>
                            <span className="font-medium">Catch-up activity on a later date</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              Use when staff forgot to clock the student out and are adding the closing visit the next day (or later).
                            </span>
                          </span>
                        </label>
                        {mode === 'catch_up' && (
                          <div className="ml-6 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-xs flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Activity date
                              </Label>
                              <Input
                                type="date"
                                className="h-8 text-sm max-w-[200px]"
                                min={dayAfter(day.dayKey)}
                                value={draft?.visitDate || ''}
                                onChange={e => setClosingDrafts(prev => ({
                                  ...prev,
                                  [day.dayKey]: {
                                    visitDate: e.target.value,
                                    timeIn: prev[day.dayKey]?.timeIn || nowHHMM(),
                                    timeOut: prev[day.dayKey]?.timeOut || '',
                                  },
                                }))}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                Time In
                              </Label>
                              <Input
                                type="time"
                                className="h-8 text-sm"
                                value={draft?.timeIn || ''}
                                onChange={e => setClosingDrafts(prev => ({
                                  ...prev,
                                  [day.dayKey]: {
                                    visitDate: prev[day.dayKey]?.visitDate || dayAfter(day.dayKey),
                                    timeIn: e.target.value,
                                    timeOut: prev[day.dayKey]?.timeOut || '',
                                  },
                                }))}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                Time Out (required)
                              </Label>
                              <Input
                                type="time"
                                className="h-8 text-sm"
                                value={draft?.timeOut || ''}
                                onChange={e => setClosingDrafts(prev => ({
                                  ...prev,
                                  [day.dayKey]: {
                                    visitDate: prev[day.dayKey]?.visitDate || dayAfter(day.dayKey),
                                    timeIn: prev[day.dayKey]?.timeIn || nowHHMM(),
                                    timeOut: e.target.value,
                                  },
                                }))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !validation.hasIssues && (
          <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>No intake issues</AlertTitle>
            <AlertDescription>This student&apos;s intake visits look correct.</AlertDescription>
          </Alert>
        )}

        {!loading && remainingMessages.length > 0 && hasSomethingToSave && (
          <p className="text-sm text-destructive" role="alert">
            {remainingMessages[0]}
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !canSave}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Apply fixes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
