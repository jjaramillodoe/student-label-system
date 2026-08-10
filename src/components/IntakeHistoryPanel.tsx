'use client';

import { useState } from 'react';
import {
  CalendarDays, Clock, FileText, Loader2, RefreshCw, User, Users,
} from 'lucide-react';
import Avery5163LabelContent from '@/components/Avery5163LabelContent';
import Avery94205LabelContent from '@/components/Avery94205LabelContent';
import AveryPrintGuidance from '@/components/AveryPrintGuidance';
import PrintConfirmBar from '@/components/PrintConfirmBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fmtHM, nowHHMM, totalVisitMinutes, visitMinutes } from '@/lib/intakeVisitTime';
import { formatFullName } from '@/lib/personName';

function ReprintHistoryLabel({ student }: { student: any }) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<'avery5163' | 'avery94205'>('avery5163');
  const [downloading, setDownloading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { downloadAveryDocx } = await import('@/lib/downloadAveryDocx');
      await downloadAveryDocx(layout, [student], { skipStock: true });
      setAwaitingConfirm(true);
    } catch {
      alert('Error generating Word document. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleConfirmPrinted() {
    setConfirming(true);
    try {
      const res = await fetch('/api/print-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: [{
            studentId: student.studentId,
            labelId: student.labelId,
            firstName: student.firstName,
            lastName: student.lastName,
            dob: student.dob,
            school: student.school,
          }],
          labelCount: 1,
          layout,
          status: 'completed',
          consumeStock: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to record print');
      setAwaitingConfirm(false);
      setOpen(false);
    } catch {
      alert('Could not save print history. Try again.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => setOpen(true)} title="Download Word label">
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Word Doc</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAwaitingConfirm(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download Label (Word)</DialogTitle>
            <DialogDescription>
              {formatFullName(student)} — print from Word on Letter at 100%
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as 'avery5163' | 'avery94205')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avery5163">Avery 5163 (2"×4")</SelectItem>
                  <SelectItem value="avery94205">Avery 94205 (1.5"×3.75")</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AveryPrintGuidance layout={layout} />
            <div
              className="mx-auto bg-white"
              style={{
                width: layout === 'avery5163' ? '4in' : '3.75in',
                height: layout === 'avery5163' ? '2in' : '1.5in',
                boxSizing: 'border-box',
                padding: '0.07in 0.1in',
                border: '1px dashed #bbb',
              }}
            >
              {layout === 'avery5163' ? (
                <Avery5163LabelContent student={student} sequence={1} />
              ) : (
                <Avery94205LabelContent student={student} sequence={1} />
              )}
            </div>
          </div>
          {awaitingConfirm ? (
            <PrintConfirmBar
              variant="inline"
              plural={false}
              confirming={confirming}
              onConfirm={() => void handleConfirmPrinted()}
              onDecline={() => setAwaitingConfirm(false)}
            />
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            {!awaitingConfirm && (
              <>
                <Button variant="outline" onClick={() => { setAwaitingConfirm(false); setOpen(false); }}>Close</Button>
                <Button onClick={handleDownload} disabled={downloading} className="gap-2">
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {downloading ? 'Generating…' : 'Download Word Doc'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VisitActivityPicker({
  options,
  value,
  onChange,
  idPrefix,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  function toggle(activity: string) {
    onChange(
      value.includes(activity)
        ? value.filter(a => a !== activity)
        : [...value, activity],
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Intake Activity</Label>
      <div className="grid grid-cols-1 gap-1.5">
        {options.map(activity => (
          <label
            key={activity}
            className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-2.5 py-2 hover:bg-accent transition-colors"
          >
            <Checkbox
              checked={value.includes(activity)}
              onCheckedChange={() => toggle(activity)}
              id={`${idPrefix}-${activity}`}
            />
            <span className="text-sm">{activity}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Add-Visit button (log another time for a returning student) ──────────────
function AddVisitButton({
  student,
  activityOptions,
  onSaved,
}: {
  student: any;
  activityOptions: string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [timeIn, setTimeIn] = useState(nowHHMM());
  const [leaving, setLeaving] = useState<'Leaving' | 'Staying' | ''>('');
  const [timeOut, setTimeOut] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const priorVisits: any[] = Array.isArray(student.intakeVisits) ? student.intakeVisits : [];
  const priorTotal = totalVisitMinutes(priorVisits);

  function visitDateIso(date: string, time: string) {
    const [h, m] = time.split(':').map(v => parseInt(v, 10));
    const d = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(h) && !Number.isNaN(m)) d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  function reset() {
    const d = new Date();
    setVisitDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setTimeIn(nowHHMM()); setLeaving(''); setTimeOut(''); setActivities([]); setError('');
  }

  async function save() {
    if (!visitDate) { setError('Please select the activity date.'); return; }
    if (!timeIn) { setError('Please enter a time in.'); return; }
    if (leaving === 'Leaving' && !timeOut) { setError('Please enter a time out — the student is leaving.'); return; }
    setSaving(true);
    setError('');
    try {
      const out = leaving === 'Leaving' ? timeOut : undefined;
      const res = await fetch(`/api/students/${student._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appendVisit: {
            date: visitDateIso(visitDate, timeIn),
            timeIn,
            timeOut: out ?? null,
            isLeaving: leaving || null,
            intakeActivity: activities,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add visit.');
        return;
      }
      setOpen(false);
      reset();
      onSaved();
    } catch {
      setError('Failed to add visit. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost" size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => { reset(); setOpen(true); }}
        title="Log another visit"
      >
        <Clock className="h-4 w-4" />
        <span className="hidden sm:inline">Add Visit</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Another Visit</DialogTitle>
            <DialogDescription>{formatFullName(student)} · DOB {student.dob}</DialogDescription>
          </DialogHeader>

          {priorVisits.length > 0 && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex items-center justify-between">
              <span>{priorVisits.length} previous visit{priorVisits.length !== 1 ? 's' : ''}</span>
              <Badge variant="outline" className="text-[10px]">Total so far: {fmtHM(priorTotal)}</Badge>
            </div>
          )}

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Activity date
              </Label>
              <Input
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                className="max-w-[200px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Time In</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} className="max-w-[160px]" />
                <Button type="button" variant="outline" size="sm" onClick={() => setTimeIn(nowHHMM())} className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Now
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Leaving or staying?</Label>
              <div className="flex gap-4">
                {(['Leaving', 'Staying'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <input
                      type="radio" name="addVisitLeaving" value={opt}
                      checked={leaving === opt}
                      onChange={() => { setLeaving(opt); if (opt === 'Staying') setTimeOut(''); }}
                      className="accent-primary"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {leaving === 'Leaving' && (
              <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5">
                <Label className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Time Out
                </Label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} className="max-w-[160px] bg-background" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTimeOut(nowHHMM())} className="gap-1.5 bg-background">
                    <Clock className="h-3.5 w-3.5" /> Now
                  </Button>
                </div>
                {timeIn && timeOut && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    This visit: {fmtHM(visitMinutes(timeIn, timeOut) ?? 0)}
                  </p>
                )}
              </div>
            )}

            <VisitActivityPicker
              options={activityOptions}
              value={activities}
              onChange={setActivities}
              idPrefix={`add-visit-${student._id}`}
            />

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Clock className="h-4 w-4" /> Add Visit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(students: any[]) {
  const groups = new Map<string, any[]>();
  for (const s of students) {
    const label = s.createdAt ? dayLabel(s.createdAt) : 'Unknown date';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }
  return groups;
}

interface HistoryPanelProps {
  students: any[];
  loading: boolean;
  filter: 'today' | 'week';
  onFilterChange: (f: 'today' | 'week') => void;
  scope: 'mine' | 'all';
  onScopeChange: (s: 'mine' | 'all') => void;
  currentUserEmail: string;
  canViewAll: boolean;
  activityOptions: string[];
  onRefresh: () => void;
}

export default function HistoryPanel({
  students, loading, filter, onFilterChange,
  scope, onScopeChange, currentUserEmail, canViewAll,
  activityOptions,
  onRefresh,
}: HistoryPanelProps) {
  const todayCount = students.filter(s => s.createdAt && dayLabel(s.createdAt) === 'Today').length;
  const weekCount = students.length;
  const groups = groupByDay(students);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFilterChange('today')}
              className={`ui-chip ${filter === 'today' ? 'ui-chip-active' : ''}`}
            >
              <Clock className="h-3.5 w-3.5" /> Today
              <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${filter === 'today' ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                {todayCount}
              </span>
            </button>
            <button
              onClick={() => onFilterChange('week')}
              className={`ui-chip ${filter === 'week' ? 'ui-chip-active' : ''}`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> This Week
              <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${filter === 'week' ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                {weekCount}
              </span>
            </button>
          </div>

          {/* Scope filter — only Data Leads / Admins see the toggle */}
          {canViewAll && (
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
              <button
                onClick={() => onScopeChange('mine')}
                className={`ui-chip border-transparent ${scope === 'mine' ? 'bg-background text-foreground shadow-sm' : ''}`}
              >
                <User className="h-3 w-3" /> My registrations
              </button>
              <button
                onClick={() => onScopeChange('all')}
                className={`ui-chip border-transparent ${scope === 'all' ? 'bg-background text-foreground shadow-sm' : ''}`}
              >
                <Users className="h-3 w-3" /> All staff
              </button>
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5 text-muted-foreground">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            No students registered {filter === 'today' ? 'today' : 'this week'}
            {scope === 'mine' ? ' by you' : ''} yet.
          </p>
        </div>
      )}

      {!loading && groups.size > 0 && (
        <div className="space-y-5">
          {[...groups.entries()].map(([day, rows]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{day}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{rows.length}</span>
              </div>
              <div className="rounded-lg border overflow-hidden divide-y">
                {rows.map((s, i) => {
                  const isMe = s.createdBy?.email === currentUserEmail;
                  return (
                    <div key={s._id || i} className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors">
                      {/* Avatar initial */}
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                        {(s.firstName?.[0] ?? '?').toUpperCase()}
                      </div>
                      {/* Name + details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {formatFullName(s)}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span>DOB: {s.dob}</span>
                          {s.createdAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />{formatTime(s.createdAt)}
                            </span>
                          )}
                          {s.program && <span>{s.program}</span>}
                          {/* Registrant — shown in "All staff" scope or when not the current user */}
                          {s.createdBy?.name && (scope === 'all' || !isMe) && (
                            <span className={`flex items-center gap-1 ${isMe ? 'text-primary font-medium' : ''}`}>
                              <User className="h-3 w-3" />
                              {isMe ? 'You' : s.createdBy.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Cabinet info */}
                      {s.cabinetName && (
                        <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                          <span className="font-medium text-foreground text-right truncate max-w-[120px]">{s.cabinetName}</span>
                          {s.drawerName && <span>{s.drawerName}</span>}
                        </div>
                      )}
                      {/* Status badge */}
                      <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                        {s.status || 'Active'}
                      </Badge>
                      {/* Add another visit */}
                      <AddVisitButton student={s} activityOptions={activityOptions} onSaved={onRefresh} />
                      {/* Reprint */}
                      <ReprintHistoryLabel student={s} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

