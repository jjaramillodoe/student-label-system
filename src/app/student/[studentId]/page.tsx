'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar, BookOpen, Archive, Layers, School,
  Tag, ArrowLeft, Printer, Users, Boxes, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFullName } from '@/lib/personName';

interface StudentDetail {
  _id: string;
  /** Barcode on the physical label: {year}-{initials}-{counter} */
  labelId?: string;
  /** Demographic ID: {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS} */
  studentId?: string;
  firstName: string;
  lastName: string;
  dob: string;
  school?: string;
  cabinet?: string;
  drawer?: string;
  cabinetName?: string | null;
  drawerName?: string | null;
  archiveBoxLabel?: string | null;
  archiveLocation?: string | null;
  archiveSchoolYear?: string | null;
  archiveBoxId?: string | null;
  archived?: boolean;
  status?: string;
  program?: string;
  siblingFlag?: boolean;
  siblingConfirmed?: boolean;
  siblings?: Array<{ _id: string; firstName: string; lastName: string; labelId?: string; studentId?: string }>;
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="mt-0.5 text-blue-500 shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/students/lookup?studentId=${encodeURIComponent(studentId)}`);
        if (res.status === 404) { setError('Student not found.'); return; }
        if (!res.ok) { setError('Failed to load student record.'); return; }
        const data = await res.json();
        setStudent(data);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="space-y-3 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-8 max-w-sm w-full">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{error}</h1>
          <p className="text-sm text-gray-500 mt-2">ID: {studentId}</p>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => router.back()}>
            <ArrowLeft size={16} /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const fullName = formatFullName(student);
  const initials = `${student.firstName?.[0] ?? ''}${student.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-900 border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Student Record</p>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{fullName}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => window.print()}
        >
          <Printer size={14} /> Print
        </Button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Avatar + ID card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xl font-bold text-blue-700 dark:text-blue-300 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{fullName}</h2>
            {student.labelId && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">Label: {student.labelId}</p>
            )}
            {student.studentId && (
              <p className="text-xs text-gray-400 font-mono">ID: {student.studentId}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {student.status && (
                <Badge variant={student.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                  {student.status}
                </Badge>
              )}
              {student.siblingFlag && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50">
                  Sibling flag
                </Badge>
              )}
              {student.siblingConfirmed && (
                <Badge variant="outline" className="text-xs border-blue-400 text-blue-700 bg-blue-50">
                  <Users size={10} className="mr-1" /> Confirmed sibling
                </Badge>
              )}
            </div>

            {/* Sibling links */}
            {student.siblings && student.siblings.length > 0 && (
              <div className="mt-2 w-full">
                <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                  <Users size={12} /> Sibling records
                </p>
                <div className="flex flex-col gap-1">
                  {student.siblings.map(sib => (
                    <a
                      key={sib._id}
                      href={`/student/${sib.labelId || sib.studentId}`}
                      className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 transition-colors text-blue-800 font-medium flex items-center justify-between"
                    >
                      <span>{formatFullName(sib)}</span>
                      <span className="font-mono text-blue-500">{sib.labelId || sib.studentId}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border px-5 py-1">
          <Field icon={Calendar}     label="Date of Birth"  value={student.dob} />
          <Field icon={School}       label="School"         value={student.school} />
          {student.archived || student.status === 'Archived' ? (
            <>
              <Field icon={Boxes}      label="Archive Box"    value={student.archiveBoxLabel} />
              <Field icon={MapPin}     label="Storage Location" value={student.archiveLocation} />
              <Field icon={Calendar}   label="Archive Year"   value={student.archiveSchoolYear} />
              {student.archiveBoxId && (
                <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="mt-0.5 text-blue-500 shrink-0">
                    <Boxes size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Box QR</p>
                    <a
                      href={`/archive/box/${student.archiveBoxId}`}
                      className="text-sm font-semibold text-blue-600 hover:underline mt-0.5 inline-block"
                    >
                      View archive box
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Field icon={Archive}      label="Cabinet"        value={student.cabinetName} />
              <Field icon={Layers}       label="Drawer"         value={student.drawerName} />
            </>
          )}
          <Field icon={BookOpen}     label="Program"        value={student.program} />
          <Field icon={Tag}  label="Label ID"    value={student.labelId} />
          <Field icon={Tag}  label="Student ID"  value={student.studentId} />
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Adult Education Student Record · Scanned from label
        </p>
      </div>

      {/* Print-only clean view */}
      <style>{`
        @media print {
          body > *:not(#print-student-card) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
