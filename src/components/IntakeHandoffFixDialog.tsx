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
import { Loader2, AlertTriangle, CheckCircle2, Wrench, CalendarDays, Clock } from 'lucide-react';
import {
  validateIntakeVisits,
  formatDayLabel,
  visitDayKey,
} from '@/lib/intakeVisitValidation';
import { buildIntakeFixPreview, dayAfter, getLastVisitIndexForDay } from '@/lib/intakeVisitFix';
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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
      setFinalClockOuts({});
      setFixModes({});
      setClosingDrafts({});
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

  const validation = useMemo(
    () => validateIntakeVisits(visits, { sessionConfigs }),
    [visits, sessionConfigs],
  );

  const handoffFlags = useMemo(
    () => validation.flags.filter(f => f.type !== 'outside_session_window'),
    [validation.flags],
  );
  const sessionFlags = useMemo(
    () => validation.flags.filter(f => f.type === 'outside_session_window'),
    [validation.flags],
  );
  const hasHandoffIssues = handoffFlags.length > 0;
  const hasSessionIssues = sessionFlags.length > 0;

  const sessionVisitIndices = useMemo(
    () => [...new Set(sessionFlags.map(f => f.visitIndex))].sort((a, b) => a - b),
    [sessionFlags],
  );

  const preview = useMemo(
    () => buildIntakeFixPreview(visits, sameDayClockOuts, closingVisits),
    [visits, sameDayClockOuts, closingVisits],
  );

  const daysNeedingFinal = preview.stillNeedsFinalClockOut;
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

  const dayIsResolved = (dayKey: string) => {
    const mode = fixModes[dayKey] ?? 'same_day';
    if (mode === 'catch_up') {
      const d = closingDrafts[dayKey];
      return Boolean(d?.visitDate?.trim() && d?.timeIn?.trim() && d?.timeOut?.trim());
    }
    return Boolean(finalClockOuts[dayKey]?.trim());
  };

  const updateVisit = (index: number, patch: Partial<IntakeVisitRecord>) => {
    setVisits(prev => prev.map((visit, i) => (i === index ? { ...visit, ...patch } : visit)));
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

  const handoffReady = !hasHandoffIssues || (
    preview.changes.length > 0
    && (daysNeedingFinal.length === 0 || daysNeedingFinal.every(d => dayIsResolved(d.dayKey)))
  );
  const sessionReady = !hasSessionIssues;
  const hasSomethingToSave = preview.changes.length > 0 || visitsModified;
  const canSave = handoffReady && sessionReady && hasSomethingToSave;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Fix intake issues — {studentName}
          </DialogTitle>
          <DialogDescription>
            Correct session hours (Time In / Time Out must match the selected intake session)
            or fix handoff visits — only the final same-day activity should record Time Out.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading visit history…
          </div>
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
                      {issue.outsideSessionCount > 0 && (issue.prematureCount > 0 || issue.missingFinalClockOut) && ' · '}
                      {issue.prematureCount > 0 && `${issue.prematureCount} early Time Out`}
                      {issue.prematureCount > 0 && issue.missingFinalClockOut && ' · '}
                      {issue.missingFinalClockOut && 'no final Time Out'}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            {hasSessionIssues && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Correct session hours</p>
                {sessionVisitIndices.map(index => {
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
                  const visitFlags = sessionFlags.filter(f => f.visitIndex === index);

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

            {preview.changes.length > 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium mb-1">Handoff changes to apply</p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                  {preview.changes.map(change => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasHandoffIssues && daysNeedingFinal.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Close open intake (handoff / EPE)</p>
                {daysNeedingFinal.map(day => {
                  const idx = getLastVisitIndexForDay(visits, day.dayKey);
                  const visit = idx !== null ? visits[idx] : null;
                  const mode = fixModes[day.dayKey] ?? 'same_day';
                  const draft = closingDrafts[day.dayKey];
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
                            <span className="font-medium">Same day — set Time Out on final activity</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              Use when you know when the student left on {day.dayLabel}.
                            </span>
                          </span>
                        </label>
                        {mode === 'same_day' && (
                          <div className="ml-6 flex items-center gap-2">
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
