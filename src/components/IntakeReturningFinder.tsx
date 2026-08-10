'use client';

import { useState } from 'react';
import { isStudentSearchQueryValid } from '@/lib/studentSearch';
import { studentIsArchived } from '@/lib/cabinets';
import { formatFullName } from '@/lib/personName';
import IntakeMatchCard, { type IntakeMatchStudent } from '@/components/IntakeMatchCard';
import ReturningVisitHistory from '@/components/ReturningVisitHistory';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Archive, CheckCircle2, Clock, Loader2, Users,
} from 'lucide-react';

type ReturningStudent = IntakeMatchStudent & {
  intakeVisits?: unknown[];
};

type Props = {
  selectedExistingStudent: ReturningStudent | null;
  onSelect: (student: ReturningStudent) => void;
  onClear: () => void;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
};

export default function IntakeReturningFinder({
  selectedExistingStudent,
  onSelect,
  onClear,
  cabinetMap,
  drawerMap,
}: Props) {
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<ReturningStudent[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);

  async function searchStudents(query: string) {
    if (!isStudentSearchQueryValid(query)) {
      setStudentSearchResults([]);
      return;
    }
    setStudentSearchLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setStudentSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch {
      setStudentSearchResults([]);
    } finally {
      setStudentSearchLoading(false);
    }
  }

  function handleClear() {
    setStudentSearch('');
    setStudentSearchResults([]);
    onClear();
  }

  return (
    <>
      {!selectedExistingStudent && (
        <Alert>
          <Clock className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="text-sm">Log a returning visit</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Search for the student below, complete today&apos;s intake details on this screen, then submit to add the visit to their record.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Find Existing Student
          </CardTitle>
          <CardDescription className="text-xs">
            Search active and archived students. Archived matches show their archive box so you do not create a second file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name, label ID, or DOB…"
              value={studentSearch}
              onChange={e => {
                setStudentSearch(e.target.value);
                void searchStudents(e.target.value);
              }}
              className="flex-1"
              disabled={!!selectedExistingStudent}
            />
            {studentSearchLoading && (
              <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
            )}
          </div>
          {studentSearchResults.length > 0 && !selectedExistingStudent && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {studentSearchResults.map(s => (
                <IntakeMatchCard
                  key={s._id}
                  student={s}
                  cabinetMap={cabinetMap}
                  drawerMap={drawerMap}
                  onSelect={onSelect}
                  showUseButton={false}
                />
              ))}
            </div>
          )}
          {selectedExistingStudent && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium">
                  {formatFullName(selectedExistingStudent)}
                </span>
                {studentIsArchived(selectedExistingStudent) && (
                  <span className="ui-badge-warning text-[10px]">
                    <Archive className="h-3 w-3" />
                    Archived
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
              {Array.isArray(selectedExistingStudent.intakeVisits)
                && selectedExistingStudent.intakeVisits.length > 0 && (
                <ReturningVisitHistory visits={selectedExistingStudent.intakeVisits} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
