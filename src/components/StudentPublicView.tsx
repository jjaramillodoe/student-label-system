'use client';

import {
  Calendar, BookOpen, Archive, Layers, School,
  Tag, Users, Boxes, MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatFullName } from '@/lib/personName';
import type { PublicStudentLookup } from '@/lib/publicStudentLookup';
import { HistoryBackButton, PrintPageButton } from '@/components/PublicRecordActions';

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

export default function StudentPublicView({ student }: { student: PublicStudentLookup }) {
  const fullName = formatFullName(student);
  const initials = `${student.firstName?.[0] ?? ''}${student.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b px-4 py-3 flex items-center gap-3">
        <HistoryBackButton className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Student Record</p>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{fullName}</h1>
        </div>
        <PrintPageButton className="gap-1.5 shrink-0" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
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

        <p className="text-center text-xs text-gray-400 pb-4">
          Adult Education Student Record · Scanned from label
        </p>
      </div>
    </div>
  );
}
