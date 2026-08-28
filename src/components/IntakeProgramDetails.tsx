'use client';

import { Dispatch, SetStateAction } from 'react';
import { cn } from '@/lib/utils';
import {
  findIntakeSession,
  formatSessionTimeRange,
  type IntakeSession,
} from '@/lib/intakeSession';
import { nowHHMM } from '@/lib/intakeVisitTime';
import type { IntakeFieldSetter, IntakeFormState } from '@/lib/intakeForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, ClipboardList, Clock } from 'lucide-react';

type Props = {
  form: IntakeFormState;
  setForm: Dispatch<SetStateAction<IntakeFormState>>;
  setField: IntakeFieldSetter;
  toggleActivity: (activity: string) => void;
  profileLocked: boolean;
  intakeActivityOptions: string[];
  intakeSessions: IntakeSession[];
  sessionTimeFieldErrors: { timeIn?: string; timeOut?: string };
};

export default function IntakeProgramDetails({
  form,
  setForm,
  setField,
  toggleActivity,
  profileLocked,
  intakeActivityOptions,
  intakeSessions,
  sessionTimeFieldErrors,
}: Props) {
  return (
    <>
      {form.intakeStudentStatus !== 'Other' && (
        <>
          {profileLocked && (
            <Alert className="border-primary/30 bg-primary/5">
              <ClipboardList className="h-4 w-4" />
              <AlertTitle className="text-sm">Today&apos;s visit</AlertTitle>
              <AlertDescription className="text-xs">
                Complete fresh intake details for this visit. Previous visits are saved in the accordion above and are not changed.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">BE or ESL <span className="text-destructive">*</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <td className="px-4 py-2 font-medium text-muted-foreground">Education Status</td>
                      <td className="px-4 py-2 text-center font-semibold">BE</td>
                      <td className="px-4 py-2 text-center font-semibold">ESL</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-4 py-3"></td>
                      {['BE', 'ESL'].map(opt => (
                        <td key={opt} className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name="educationStatus"
                            value={opt}
                            checked={form.educationStatus === opt}
                            onChange={() => setField('educationStatus', opt)}
                            className="accent-primary scale-125"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Intake Activity <span className="text-destructive">*</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...intakeActivityOptions].sort((a, b) => a.localeCompare(b)).map(activity => (
                  <label key={activity} className="flex items-center gap-2.5 cursor-pointer select-none rounded-md border px-3 py-2.5 hover:bg-accent transition-colors">
                    <Checkbox
                      checked={form.intakeActivity.includes(activity)}
                      onCheckedChange={() => toggleActivity(activity)}
                      id={`activity-${activity}`}
                    />
                    <span className="text-sm">{activity}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Placement Class</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={form.placementClass}
                onChange={e => setField('placementClass', e.target.value)}
                placeholder="e.g. ESL Level 3, ABE, HSE…"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Intake Session <span className="text-destructive">*</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <td className="px-3 py-2 font-medium text-muted-foreground">Time of Day</td>
                      {intakeSessions.map(s => (
                        <td key={s.name} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                          <div>{s.name}</div>
                          <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                            {formatSessionTimeRange(s)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-3"></td>
                      {intakeSessions.map(s => (
                        <td key={s.name} className="px-2 py-3 text-center">
                          <input
                            type="radio"
                            name="intakeSession"
                            value={s.name}
                            checked={form.intakeSession === s.name}
                            onChange={() => setField('intakeSession', s.name)}
                            className="accent-primary scale-125"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Time In <span className="text-destructive">*</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={form.timeIn}
                  onChange={e => setField('timeIn', e.target.value)}
                  className={cn('max-w-[180px]', sessionTimeFieldErrors.timeIn && 'border-destructive')}
                  aria-invalid={Boolean(sessionTimeFieldErrors.timeIn)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setField('timeIn', nowHHMM())} className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Now
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Defaults to the current time — adjust if needed.
                {form.intakeSession && findIntakeSession(intakeSessions, form.intakeSession) && (
                  <> Allowed window for {form.intakeSession}:{' '}
                    <strong>
                      {formatSessionTimeRange(findIntakeSession(intakeSessions, form.intakeSession)!)}
                    </strong>.
                  </>
                )}
              </p>
              {sessionTimeFieldErrors.timeIn && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{sessionTimeFieldErrors.timeIn}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Is the student leaving the building or staying? <span className="text-destructive">*</span></CardTitle>
              <CardDescription className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                If the student is leaving you MUST enter a Time Out
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-6">
                {['Leaving', 'Staying'].map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="isLeaving"
                      value={opt}
                      checked={form.isLeaving === opt}
                      onChange={() => setForm(f => ({ ...f, isLeaving: opt, timeOut: opt === 'Leaving' ? f.timeOut : '' }))}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">{opt}</span>
                  </label>
                ))}
              </div>

              {form.isLeaving === 'Leaving' && (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
                  <Label htmlFor="timeOut" className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" /> Time Out <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="timeOut"
                      type="time"
                      value={form.timeOut}
                      onChange={e => setField('timeOut', e.target.value)}
                      className={cn('max-w-[180px] bg-background', sessionTimeFieldErrors.timeOut && 'border-destructive')}
                      aria-invalid={Boolean(sessionTimeFieldErrors.timeOut)}
                      required
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setField('timeOut', nowHHMM())} className="gap-1.5 bg-background">
                      <Clock className="h-3.5 w-3.5" /> Now
                    </Button>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    You must enter a time out because the student is leaving the building.
                  </p>
                  {sessionTimeFieldErrors.timeOut && (
                    <Alert variant="destructive" className="py-2 bg-background">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{sessionTimeFieldErrors.timeOut}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {form.intakeStudentStatus === 'Other' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Describe the purpose <span className="text-destructive">*</span></CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.otherNote}
              onChange={e => setField('otherNote', e.target.value)}
              rows={3}
              placeholder="Describe why this student is here…"
              required={form.intakeStudentStatus === 'Other'}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
