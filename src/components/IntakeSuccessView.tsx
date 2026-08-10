'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Boxes, ExternalLink, MapPin, Printer, QrCode, ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import QRCode from '@/components/QRCode';
import { formatStudentAddressStacked } from '@/lib/addressValidation';
import { googleMapsSearchUrl } from '@/lib/googleMaps';
import { checkBeEslAgeEligibility } from '@/lib/beEslEligibility';
import { findIntakeSession, formatSessionTimeRange, formatTime12, type IntakeSession } from '@/lib/intakeSession';
import { getStudentStorageDisplay } from '@/lib/studentLocation';
import { studentHasArchiveBoxLocation } from '@/lib/cabinets';
import { formatHumanDate } from '@/lib/utils';
import { formatFullName } from '@/lib/personName';
import type { Cabinet } from '@/types/cabinet';

export function buildP2gReferralMessage(
  student: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    phone?: string;
    email?: string;
    labelId?: string;
    studentId?: string;
  },
  form: {
    phone?: string;
    email?: string;
    intakeStudentStatus?: string;
    educationStatus?: string;
  },
  user?: { name?: string | null; email?: string | null } | null,
): string {
  const name = formatFullName(student) || '—';
  const dobLabel = student.dob ? (formatHumanDate(student.dob) ?? student.dob) : '—';
  const phone = form.phone?.trim() || student.phone?.trim() || '—';
  const email = form.email?.trim() || student.email?.trim() || '—';
  const studentId = student.labelId || student.studentId || '—';
  const staffName = user?.name || user?.email || 'Intake staff';
  const today = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const ageCheck = student.dob ? checkBeEslAgeEligibility(String(student.dob)) : null;
  const eligibleDate = ageCheck?.eligibleOnIso ? formatHumanDate(ageCheck.eligibleOnIso) : null;

  return [
    'Subject: Student referral — Pathways to Graduation (under 21)',
    '',
    'Hello,',
    '',
    'I am referring a student who is under 21 years of age and is not eligible for our BE/ESL programs. They may be a better fit for Pathways to Graduation (P2G).',
    '',
    'Student information:',
    `  Name: ${name}`,
    `  Date of birth: ${dobLabel}`,
    `  Student ID: ${studentId}`,
    `  Phone: ${phone}`,
    `  Email: ${email}`,
    ...(form.intakeStudentStatus ? [`  Intake status: ${form.intakeStudentStatus}`] : []),
    ...(form.educationStatus ? [`  Education interest: ${form.educationStatus}`] : []),
    ...(eligibleDate ? [`  BE/ESL eligible on: ${eligibleDate}`] : []),
    '',
    'Please direct the student to contact Pathways to Graduation for enrollment options:',
    '  https://p2g.nyc/contact/',
    '',
    `Recorded by: ${staffName}`,
    `Date: ${today}`,
    '',
    'Thank you.',
  ].join('\n');
}

function SummaryRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 text-sm py-2 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function IntakeSuccessSummary({
  student,
  form,
  savedAsVisit,
  intakeSessions,
  cabinets,
}: {
  student: any;
  form: any;
  savedAsVisit: boolean;
  intakeSessions: IntakeSession[];
  cabinets: Cabinet[];
}) {
  const cabinetMap = Object.fromEntries(cabinets.map(c => [c._id, c.name]));
  const drawerMap = Object.fromEntries(
    cabinets.flatMap(c => c.drawers.map(d => [d._id, d.name])),
  );
  const storage = getStudentStorageDisplay(student, cabinetMap, drawerMap, {
    showSection: true,
  });
  const sessionConfig = findIntakeSession(intakeSessions, form.intakeSession);
  const address = formatStudentAddressStacked({
    address: student.address,
    apt: student.apt,
    city: student.city,
    state: student.state,
    zip: student.zip,
  });
  const mapsUrl = googleMapsSearchUrl({
    latitude: student.addressGeoclient?.latitude,
    longitude: student.addressGeoclient?.longitude,
    address: student.address,
    city: student.city,
    state: student.state,
    zip: student.zip,
  });
  const dobLabel = student.dob ? (formatHumanDate(student.dob) ?? student.dob) : null;

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {formatFullName(student)}
        </CardTitle>
        <CardDescription>
          {savedAsVisit
            ? 'Today\'s visit was saved to this student\'s intake history.'
            : 'New student record created in the system.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{student.status || 'Active'}</Badge>
          {form.intakeStudentStatus && (
            <Badge variant="secondary">{form.intakeStudentStatus}</Badge>
          )}
          {student.siblingFlag && (
            <span className="ui-badge-warning text-xs">
              <ShieldAlert className="h-3 w-3" /> Sibling flag
            </span>
          )}
          {student.addressValidationStatus && (
            <Badge variant="outline" className="text-xs capitalize">
              Address: {String(student.addressValidationStatus).replace(/_/g, ' ')}
            </Badge>
          )}
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">
            {savedAsVisit ? 'Visit recorded' : 'Registration saved'}
          </p>
          <SummaryRow label="Student ID" value={student.labelId || student.studentId} />
          <SummaryRow label="Date of birth" value={dobLabel} />
          {!savedAsVisit && form.gender && <SummaryRow label="Gender" value={form.gender} />}
          {!savedAsVisit && form.startDate && (
            <SummaryRow label="Start date" value={formatHumanDate(form.startDate) ?? form.startDate} />
          )}
          {form.educationStatus && <SummaryRow label="BE or ESL" value={form.educationStatus} />}
          {form.intakeActivity?.length > 0 && (
            <SummaryRow label="Intake activity" value={form.intakeActivity.join(', ')} />
          )}
          {form.placementClass?.trim() && (
            <SummaryRow label="Placement class" value={form.placementClass.trim()} />
          )}
          {form.intakeSession && (
            <SummaryRow
              label="Session"
              value={sessionConfig
                ? `${form.intakeSession} (${formatSessionTimeRange(sessionConfig)})`
                : form.intakeSession}
            />
          )}
          {form.timeIn && (
            <SummaryRow label="Time in" value={formatTime12(form.timeIn)} />
          )}
          {form.isLeaving && <SummaryRow label="Leaving / staying" value={form.isLeaving} />}
          {form.isLeaving === 'Leaving' && form.timeOut && (
            <SummaryRow label="Time out" value={formatTime12(form.timeOut)} />
          )}
          {(form.phone?.trim() || student.phone) && (
            <SummaryRow label="Phone" value={form.phone?.trim() || student.phone} />
          )}
          {(form.email?.trim() || student.email) && (
            <SummaryRow label="Email" value={form.email?.trim() || student.email} />
          )}
          {form.notes?.trim() && <SummaryRow label="Notes" value={form.notes.trim()} />}
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">
            File location
          </p>
          <SummaryRow
            label={storage.primaryLabel}
            value={storage.primary}
          />
          <SummaryRow
            label={storage.secondaryLabel}
            value={storage.secondary}
          />
          {storage.section && (
            <SummaryRow label="Sec" value={storage.section} />
          )}
          {student.archiveBoxId && (
            <div className="pt-2 pb-1">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                <Link href={`/archive/box/${student.archiveBoxId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View archive box
                </Link>
              </Button>
            </div>
          )}
        </div>

        {address?.streetLine && (
          <div className="text-sm space-y-1">
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p>{address.streetLine}</p>
                {address.cityStateZip && (
                  <p className="text-xs">{address.cityStateZip}</p>
                )}
              </div>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-5"
              >
                <ExternalLink className="h-3 w-3" />
                View on Google Maps
              </a>
            )}
          </div>
        )}

        {!savedAsVisit && (
          <Alert>
            <Printer className="h-4 w-4 text-muted-foreground" />
            <AlertTitle className="text-sm">
              Labels are printed later (not at this desk)
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                This student will appear under <strong className="text-foreground">Needs label</strong> on the Dashboard
                until someone prints their Avery sheet.
              </p>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
                <Link href="/?needsLabel=1">
                  <Printer className="h-3.5 w-3.5" />
                  Open Find &amp; print → Needs label
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function IntakeArchivedFileLocation({ student }: { student: any }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const hasBoxLocation = studentHasArchiveBoxLocation(student);
  const boxUrl = student.archiveBoxId && origin
    ? `${origin}/archive/box/${student.archiveBoxId}`
    : null;

  if (!hasBoxLocation) {
    return (
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <Boxes className="h-4 w-4 text-amber-600" />
        <AlertTitle>Archived — box location not recorded</AlertTitle>
        <AlertDescription className="text-sm">
          This student&apos;s file was archived but no archive box is on record. Ask your Data Lead
          to assign a box in Admin → Cabinets before adding paperwork to the physical file.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20 px-5 py-4 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300/50 flex-shrink-0">
          <Boxes className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-foreground">
            {student.archiveBoxLabel || 'Archive box'}
          </div>
          {student.archiveSchoolYear && (
            <p className="text-xs text-muted-foreground">{student.archiveSchoolYear}</p>
          )}
          {student.archiveLocation && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span><strong className="text-foreground">Storage:</strong> {student.archiveLocation}</span>
            </div>
          )}
        </div>
        <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-800 bg-amber-50">
          Archived file
        </Badge>
      </div>

      {boxUrl && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-md border border-amber-200/80 bg-background/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md border bg-white p-1.5">
              <QRCode value={boxUrl} size={88} level="M" />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1">
                <QrCode className="h-3.5 w-3.5" /> Scan to open archive box
              </p>
              <p>Staff can scan this code to find the box and add paperwork to the existing file.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            <Link href={`/archive/box/${student.archiveBoxId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              View archive box
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

