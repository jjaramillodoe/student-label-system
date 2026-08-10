'use client';

import { isStudentSearchQueryValid } from '@/lib/studentSearch';
import type { IntakeCheckResult } from '@/lib/intakeForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle, CheckCircle2, Database, Loader2, Lock, Users,
} from 'lucide-react';
import IntakeMatchCard, { type IntakeMatchStudent } from '@/components/IntakeMatchCard';

type Props = {
  intakeStudentStatus: string;
  assistsQuery: string;
  onAssistsQueryChange: (value: string) => void;
  runAssistsGateCheck: () => void;
  checkResult: IntakeCheckResult;
  assistsGateChecked: boolean;
  assistsHasMatches: boolean;
  assistsNotFoundAck: boolean;
  setAssistsNotFoundAck: (value: boolean) => void;
  assistsDifferentPersonAck: boolean;
  setAssistsDifferentPersonAck: (value: boolean) => void;
  assistsLegacySameAck: boolean;
  setAssistsLegacySameAck: (value: boolean) => void;
  setSiblingAcknowledged: (value: boolean) => void;
  newAssistsUnlocked: boolean;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
  selectAsReturning: (student: IntakeMatchStudent) => void;
  confirmLegacySamePerson: (student: IntakeMatchStudent) => void;
  /** Optional school lookup (non-NEW) */
  schoolLookup: string;
  schoolLookupLoading: boolean;
  schoolLookupDone: boolean;
  schoolLookupResults: any[];
  onSchoolLookupChange: (value: string) => void;
};

export default function IntakeAssistsGate({
  intakeStudentStatus,
  assistsQuery,
  onAssistsQueryChange,
  runAssistsGateCheck,
  checkResult,
  assistsGateChecked,
  assistsHasMatches,
  assistsNotFoundAck,
  setAssistsNotFoundAck,
  assistsDifferentPersonAck,
  setAssistsDifferentPersonAck,
  assistsLegacySameAck,
  setAssistsLegacySameAck,
  setSiblingAcknowledged,
  newAssistsUnlocked,
  cabinetMap,
  drawerMap,
  selectAsReturning,
  confirmLegacySamePerson,
  schoolLookup,
  schoolLookupLoading,
  schoolLookupDone,
  schoolLookupResults,
  onSchoolLookupChange,
}: Props) {
  return (
    <>
      {intakeStudentStatus === 'NEW' && (
        <Card className="border-violet-300 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-violet-900 dark:text-violet-200">
              <Database className="h-4 w-4" />
              Check ASISTS first
              <Badge variant="outline" className="text-[10px] font-normal">Required for NEW</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Search the school ASISTS / legacy roster and this system (active + archived) before collecting other personal information.
              If a match appears, confirm whether it is the student sitting with you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assistsSearch">
                Search ASISTS / school records <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="assistsSearch"
                  value={assistsQuery}
                  onChange={e => onAssistsQueryChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runAssistsGateCheck();
                    }
                  }}
                  placeholder="Name, DOB, or both — e.g. Mary Smith 01/15/1990 or 1979-05-22"
                  className="flex-1 bg-background"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  className="gap-2 shrink-0"
                  disabled={checkResult.status === 'checking' || !isStudentSearchQueryValid(assistsQuery)}
                  onClick={() => runAssistsGateCheck()}
                >
                  {checkResult.status === 'checking' ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
                  ) : (
                    <><Database className="h-4 w-4" /> Check ASISTS</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Type a name, a date of birth (MM/DD/YYYY or YYYY-MM-DD), or both.
                A DOB-only search returns only students born that day. Results update as you type.
              </p>
            </div>

            {assistsGateChecked && !assistsHasMatches && (
              <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-3 py-3 space-y-3">
                <Alert className="border-0 bg-transparent p-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 dark:text-green-200 text-sm">No ASISTS / school match</AlertTitle>
                  <AlertDescription className="text-xs text-green-700 dark:text-green-300">
                    No active, archived, or ASISTS/legacy record matched “{assistsQuery.trim()}”.
                  </AlertDescription>
                </Alert>
                <div className="flex items-start gap-3 rounded-md border border-green-300/80 bg-background/70 px-3 py-2.5">
                  <Checkbox
                    id="assistsNotFoundAck"
                    checked={assistsNotFoundAck}
                    onCheckedChange={v => {
                      setAssistsNotFoundAck(Boolean(v));
                      if (v) {
                        setAssistsDifferentPersonAck(false);
                        setAssistsLegacySameAck(false);
                      }
                    }}
                    className="mt-0.5"
                  />
                  <label htmlFor="assistsNotFoundAck" className="text-sm cursor-pointer select-none">
                    <span className="font-medium">I checked ASISTS — this student was not found</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Required before gathering the rest of their personal information.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {assistsGateChecked && assistsHasMatches && (
              <div className={`rounded-lg border-2 p-4 space-y-3 ${
                newAssistsUnlocked
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600'
                  : 'border-violet-400 bg-background dark:border-violet-700'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-violet-700 dark:text-violet-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-violet-900 dark:text-violet-100">
                      Possible match — is this the student sitting with you?
                    </p>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      Confirm same person, or acknowledge they are not the same before continuing as NEW.
                    </p>
                  </div>
                </div>

                {(checkResult.exact.length > 0 || checkResult.fuzzy.length > 0) && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">In this system</p>
                    {[...checkResult.exact, ...checkResult.fuzzy].map((s, i) => (
                      <IntakeMatchCard
                        key={s._id || i}
                        student={s}
                        cabinetMap={cabinetMap}
                        drawerMap={drawerMap}
                        onUseAsReturning={selectAsReturning}
                      />
                    ))}
                  </div>
                )}

                {(checkResult.legacyExact.length > 0 || checkResult.legacyFuzzy.length > 0) && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-violet-800 dark:text-violet-300">ASISTS / legacy roster</p>
                    {[...checkResult.legacyExact, ...checkResult.legacyFuzzy].map((s, i) => (
                      <IntakeMatchCard
                        key={s._id || `legacy-${i}`}
                        student={s}
                        cabinetMap={cabinetMap}
                        drawerMap={drawerMap}
                        showUseButton={false}
                        onConfirmSameLegacy={confirmLegacySamePerson}
                      />
                    ))}
                  </div>
                )}

                {assistsLegacySameAck && (
                  <Alert className="border-violet-300 bg-violet-50/80 dark:bg-violet-950/40">
                    <CheckCircle2 className="h-4 w-4 text-violet-700" />
                    <AlertTitle className="text-sm">Same person from ASISTS</AlertTitle>
                    <AlertDescription className="text-xs">
                      Continue below to create their file in this system. They do not have a live RETURNING record here yet.
                    </AlertDescription>
                  </Alert>
                )}

                {!assistsLegacySameAck && (
                  <div className={`rounded-md border px-3 py-3 flex items-start gap-3 ${
                    assistsDifferentPersonAck
                      ? 'border-amber-400 bg-amber-100/60 dark:bg-amber-900/20'
                      : 'border-border bg-muted/30'
                  }`}>
                    <Checkbox
                      id="assistsDifferentPerson"
                      checked={assistsDifferentPersonAck}
                      onCheckedChange={v => {
                        const on = v === true;
                        setAssistsDifferentPersonAck(on);
                        setSiblingAcknowledged(on);
                        if (on) {
                          setAssistsLegacySameAck(false);
                          setAssistsNotFoundAck(false);
                        }
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor="assistsDifferentPerson" className="text-sm cursor-pointer select-none">
                      <span className="font-medium">Not the same person sitting here</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Check this if the match is a sibling, twin, or coincidence. The NEW registration will be flagged for Data Lead review.
                      </span>
                    </label>
                  </div>
                )}

                {assistsDifferentPersonAck && (
                  <Alert className="border-amber-300 bg-amber-50/90 dark:border-amber-700 dark:bg-amber-950/40">
                    <CheckCircle2 className="h-4 w-4 text-amber-700" />
                    <AlertTitle className="text-sm text-amber-950 dark:text-amber-100">
                      Continue as a new student
                    </AlertTitle>
                    <AlertDescription className="text-xs text-amber-900/90 dark:text-amber-100/90">
                      Personal information is unlocked below. Complete the form — this registration will be flagged for Data Lead review.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {intakeStudentStatus === 'NEW' && !newAssistsUnlocked && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Personal information and the rest of the form unlock after this ASISTS step.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {intakeStudentStatus !== 'NEW' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Check school records
            </CardTitle>
            <CardDescription className="text-xs">
              Optional search of this system (active + archived) and the school ASISTS / legacy roster.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Name, Label ID, or DOB (MM/DD/YYYY)…"
                value={schoolLookup}
                onChange={e => onSchoolLookupChange(e.target.value)}
                className="flex-1 bg-background"
              />
              {schoolLookupLoading && (
                <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
              )}
            </div>
            {schoolLookupDone && schoolLookupResults.length === 0 && isStudentSearchQueryValid(schoolLookup) && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200 text-sm">No school match</AlertTitle>
                <AlertDescription className="text-xs text-green-700 dark:text-green-300">
                  No active, archived, or ASISTS/legacy match for this search.
                </AlertDescription>
              </Alert>
            )}
            {schoolLookupResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {schoolLookupResults.map((s: any) => (
                  <IntakeMatchCard
                    key={s._id}
                    student={s}
                    cabinetMap={cabinetMap}
                    drawerMap={drawerMap}
                    onUseAsReturning={s._legacy ? undefined : selectAsReturning}
                    showUseButton={!s._legacy}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
