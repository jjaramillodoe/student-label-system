'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Barcode from 'react-barcode';
import {
  User,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Hash,
  ScanLine,
  Boxes,
  ExternalLink,
  AlertCircle,
  Pencil,
  Building2,
  Layers,
  FolderInput,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import QRCode from '@/components/QRCode';
import type { Student } from '@/components/StudentTable';
import { formatFullName } from '@/lib/personName';
import { formatStudentAddressStacked, type StudentAddressInput } from '@/lib/addressValidation';
import { googleMapsSearchUrl } from '@/lib/googleMaps';
import { getStudentStorageDisplay } from '@/lib/studentLocation';
import { buildStudentQrPayload } from '@/lib/qrPayload';
import { formatShortDate, normalizeMongoId } from '@/lib/utils';

function studentAddressInput(student: Student): StudentAddressInput {
  if (student.addressStandardized?.address?.trim()) {
    return {
      address: student.addressStandardized.address,
      apt: student.apt || student.addressStandardized.apt,
      city: student.addressStandardized.city,
      state: student.addressStandardized.state,
      zip: student.addressStandardized.zip,
    };
  }
  return {
    address: student.address ?? undefined,
    apt: student.apt ?? undefined,
    city: student.city ?? undefined,
    state: student.state ?? undefined,
    zip: student.zip ?? undefined,
  };
}

function Field({
  label,
  icon,
  children,
  className,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground break-words">{children}</div>
    </div>
  );
}

function EmptyValue({ label = 'Not provided' }: { label?: string }) {
  return <span className="font-normal text-muted-foreground">{label}</span>;
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'Active') return 'default';
  if (status === 'Inactive' || status === 'Archived') return 'secondary';
  return 'outline';
}

function collectMissing(student: Student): string[] {
  const missing: string[] = [];
  if (!student.email?.trim()) missing.push('Email');
  if (!student.phone?.trim() && !student.homePhone?.trim() && !student.cellPhone?.trim()) missing.push('Phone');
  const addr = formatStudentAddressStacked(studentAddressInput(student));
  if (!addr?.streetLine && !addr?.cityStateZip) missing.push('Address');
  if (!student.dob?.trim()) missing.push('Date of birth');
  if (!student.startDate?.trim()) missing.push('Start date');
  if (!student.labelId?.trim() && !student.studentId?.trim()) missing.push('Student / Label ID');

  const isArchived = Boolean(student.archived || student.status === 'Archived');
  if (!isArchived) {
    if (!student.cabinet?.trim()) missing.push('Cabinet');
    if (!student.drawer?.trim()) missing.push('Drawer');
    if (!student.drawerSection?.trim()) missing.push('Cabinet section');
  } else if (!student.archiveBoxLabel?.trim() && !student.archiveLocation?.trim()) {
    missing.push('Archive box');
  }

  return missing;
}

type StudentDetailsDialogProps = {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
  showQRCode?: boolean;
  onEdit?: (student: Student) => void;
  /** Called after a successful archive → active drawer re-file */
  onStudentUpdated?: () => void;
  /** Show Data Lead re-file control (Admin / Data Lead) */
  canRefileArchived?: boolean;
};

export default function StudentDetailsDialog({
  student,
  open,
  onOpenChange,
  cabinetMap,
  drawerMap,
  showQRCode = true,
  onEdit,
  onStudentUpdated,
  canRefileArchived = false,
}: StudentDetailsDialogProps) {
  const [refiling, setRefiling] = useState(false);
  const [refileError, setRefileError] = useState('');
  const [refileSuccess, setRefileSuccess] = useState('');

  async function refileToNextDrawer() {
    if (!student?._id) return;
    setRefiling(true);
    setRefileError('');
    setRefileSuccess('');
    try {
      const id = normalizeMongoId(student._id) ?? String(student._id);
      const res = await fetch('/api/admin/assign-next-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: [id],
          reactivateFromArchive: true,
          source: 'student-details-refile',
          note: 'Re-filed from archive to next available active drawer',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-file student');
      }
      setRefileSuccess(data.message || 'Student re-filed to an active drawer and set Active.');
      onStudentUpdated?.();
    } catch (err) {
      setRefileError(err instanceof Error ? err.message : 'Failed to re-file student');
    } finally {
      setRefiling(false);
    }
  }

  if (!student) return null;

  const fullName = formatFullName(student);
  const addressInput = studentAddressInput(student);
  const stacked = formatStudentAddressStacked(addressInput);
  const mapsUrl = googleMapsSearchUrl({
    latitude: student.addressGeoclient?.latitude,
    longitude: student.addressGeoclient?.longitude,
    address: stacked?.streetLine || student.address,
    city: addressInput.city ?? student.city,
    state: addressInput.state ?? student.state,
    zip: addressInput.zip ?? student.zip,
  });
  const storage = getStudentStorageDisplay(student, cabinetMap, drawerMap, { showSection: true });
  const missing = collectMissing(student);
  const barcodeValue = student.labelId || student.studentId || '';
  const qrPayload = student.studentId
    ? buildStudentQrPayload({ studentId: student.studentId })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <div className="border-b border-border/60 bg-muted/30 px-6 py-5">
          <DialogHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{fullName}</span>
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Demographics, storage location, and scannable IDs
                </DialogDescription>
              </div>
              {onEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onEdit(student)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(student.status)}>{student.status || 'Unknown'}</Badge>
              {student.school && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {student.school}
                </span>
              )}
              {student.fiscalYear && (
                <span className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  FY {student.fiscalYear}
                </span>
              )}
              {student.archived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-5">
          {missing.length > 0 && (
            <div className="flex gap-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3.5 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Missing information</p>
                <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                  {missing.join(' · ')}
                </p>
              </div>
            </div>
          )}

          {/* Contact & demographics */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Contact & demographics</h3>
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border/60 bg-background p-4 sm:grid-cols-2">
              <Field label="First name">{student.firstName || <EmptyValue />}</Field>
              <Field label="Middle initial">{student.middleInitial?.trim() || <EmptyValue />}</Field>
              <Field label="Last name">{student.lastName || <EmptyValue />}</Field>
              <Field label="Date of birth" icon={<Calendar className="h-3.5 w-3.5" />}>
                {student.dob ? formatShortDate(student.dob) || student.dob : <EmptyValue />}
              </Field>
              <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
                {student.email?.trim() ? (
                  <a href={`mailto:${student.email}`} className="text-primary hover:underline">
                    {student.email}
                  </a>
                ) : (
                  <EmptyValue />
                )}
              </Field>
              <Field label="Home phone" icon={<Phone className="h-3.5 w-3.5" />}>
                {(student.homePhone || student.phone)?.trim() ? (
                  <a href={`tel:${student.homePhone || student.phone}`} className="text-primary hover:underline">
                    {student.homePhone || student.phone}
                  </a>
                ) : (
                  <EmptyValue />
                )}
              </Field>
              <Field label="Cell phone" icon={<Phone className="h-3.5 w-3.5" />}>
                {student.cellPhone?.trim() ? (
                  <a href={`tel:${student.cellPhone}`} className="text-primary hover:underline">
                    {student.cellPhone}
                  </a>
                ) : (
                  <EmptyValue />
                )}
              </Field>
              {student.agencyId && (
                <Field label="Agency ID">{student.agencyId}</Field>
              )}
              {(student.emergencyContactNameRelationship || student.emergencyContactPhone) && (
                <>
                  <Field label="Emergency contact">{student.emergencyContactNameRelationship || <EmptyValue />}</Field>
                  <Field label="Emergency phone">
                    {student.emergencyContactPhone?.trim() ? (
                      <a href={`tel:${student.emergencyContactPhone}`} className="text-primary hover:underline">
                        {student.emergencyContactPhone}
                      </a>
                    ) : (
                      <EmptyValue />
                    )}
                  </Field>
                </>
              )}
              <Field label="Home address" icon={<MapPin className="h-3.5 w-3.5" />} className="sm:col-span-2">
                {stacked?.streetLine || stacked?.cityStateZip ? (
                  <div className="space-y-1">
                    {stacked.streetLine && <div>{stacked.streetLine}</div>}
                    {stacked.cityStateZip && (
                      <div className="font-normal text-muted-foreground">{stacked.cityStateZip}</div>
                    )}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open in Google Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <EmptyValue />
                )}
              </Field>
            </div>
          </section>

          {/* Enrollment */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Enrollment</h3>
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border/60 bg-background p-4 sm:grid-cols-2">
              <Field label="Start date">
                {student.startDate
                  ? formatShortDate(student.startDate) || student.startDate
                  : <EmptyValue label="Not set" />}
              </Field>
              <Field label="End date">
                {student.endDate
                  ? formatShortDate(student.endDate) || student.endDate
                  : <EmptyValue label="Not set" />}
              </Field>
              <Field label="Fiscal year">{student.fiscalYear || <EmptyValue />}</Field>
              <Field label="Status">
                <Badge variant={statusVariant(student.status)} className="mt-0.5">
                  {student.status || 'Unknown'}
                </Badge>
              </Field>
              {student.siblingConfirmed && (
                <Field label="Sibling link" className="sm:col-span-2">
                  Confirmed
                  {student.siblingWith?.length
                    ? ` with ${student.siblingWith.length} related record${student.siblingWith.length === 1 ? '' : 's'}`
                    : ''}
                </Field>
              )}
            </div>
          </section>

          {/* Storage */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {storage.isArchived ? (
                <Boxes className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Layers className="h-4 w-4 text-muted-foreground" />
              )}
              {storage.isArchived ? 'Archive location' : 'Cabinet storage'}
            </h3>
            <div className="rounded-lg border border-border/60 bg-background p-4">
              {storage.isArchived && (student.archiveBoxLabel || student.archiveLocation) ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Archive box">
                      <span className="text-base font-semibold">{student.archiveBoxLabel || '—'}</span>
                      {student.archiveSchoolYear && (
                        <div className="mt-0.5 font-normal text-muted-foreground">
                          {student.archiveSchoolYear}
                        </div>
                      )}
                    </Field>
                    <Field label="Storage location">
                      <span className="text-base font-semibold">{student.archiveLocation || '—'}</span>
                      {student.archiveBoxId && (
                        <Link
                          href={`/archive/box/${student.archiveBoxId}`}
                          className="mt-1 block text-xs font-medium text-primary hover:underline"
                        >
                          View archive box →
                        </Link>
                      )}
                    </Field>
                  </div>
                  {canRefileArchived && (
                    <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Returning students usually stay in the archive box. Use re-file only when the
                        physical file should move back into an active cabinet drawer.
                      </p>
                      {refileError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertDescription className="text-xs">{refileError}</AlertDescription>
                        </Alert>
                      )}
                      {refileSuccess && (
                        <Alert className="py-2 border-green-300 bg-green-50 dark:bg-green-950/30">
                          <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                            {refileSuccess}
                          </AlertDescription>
                        </Alert>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={refiling}
                        onClick={() => void refileToNextDrawer()}
                      >
                        {refiling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                        Re-file to next active drawer
                      </Button>
                    </div>
                  )}
                </div>
              ) : storage.isArchived ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">No archive box assigned yet</p>
                    <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">
                      Go to Admin → Cabinets, open the archived cabinet, and use
                      &quot;Move Students to Boxes&quot; to assign a box and location — or re-file
                      into an active drawer if the file is coming back into circulation.
                    </p>
                  </div>
                  {canRefileArchived && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={refiling}
                      onClick={() => void refileToNextDrawer()}
                    >
                      {refiling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                      Re-file to next active drawer
                    </Button>
                  )}
                  {refileError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertDescription className="text-xs">{refileError}</AlertDescription>
                    </Alert>
                  )}
                  {refileSuccess && (
                    <Alert className="py-2 border-green-300 bg-green-50 dark:bg-green-950/30">
                      <AlertDescription className="text-xs text-green-800 dark:text-green-200">
                        {refileSuccess}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Cabinet">
                    <span className="text-base font-semibold">
                      {storage.primary !== '—' ? storage.primary : <EmptyValue label="Not assigned" />}
                    </span>
                  </Field>
                  <Field label="Drawer">
                    <span className="text-base font-semibold">
                      {storage.secondary !== '—' ? storage.secondary : <EmptyValue label="Not assigned" />}
                    </span>
                  </Field>
                  <Field label="Section">
                    <span className="text-base font-semibold">
                      {storage.section || <EmptyValue label="Not assigned" />}
                    </span>
                  </Field>
                </div>
              )}
            </div>
          </section>

          {/* IDs & codes */}
          {(student.labelId || student.studentId) && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Hash className="h-4 w-4 text-muted-foreground" />
                IDs & barcodes
              </h3>
              <div className="space-y-4 rounded-lg border border-border/60 bg-background p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Label ID (on printed labels)">
                    {student.labelId ? (
                      <span className="font-mono text-base">{student.labelId}</span>
                    ) : (
                      <EmptyValue />
                    )}
                  </Field>
                  <Field label="Demographic student ID">
                    {student.studentId ? (
                      <span className="font-mono text-base break-all">{student.studentId}</span>
                    ) : (
                      <EmptyValue />
                    )}
                  </Field>
                </div>

                {barcodeValue && (
                  <>
                    <Separator />
                    <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/40 p-5">
                      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <ScanLine className="h-3.5 w-3.5" />
                        Barcode
                        {student.labelId ? ' · Label ID' : ' · Student ID'}
                      </div>
                      <div className="flex w-full flex-col items-center rounded-md bg-white p-4 dark:bg-zinc-950">
                        <Barcode
                          value={barcodeValue}
                          width={2}
                          height={72}
                          fontSize={14}
                          margin={0}
                          displayValue={false}
                        />
                        <div className="mt-2 break-all text-center font-mono text-xs text-muted-foreground">
                          {barcodeValue}
                        </div>
                      </div>

                      {showQRCode && qrPayload && (
                        <>
                          <Separator className="w-24" />
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              QR code
                            </div>
                            <p className="max-w-xs text-center text-xs text-muted-foreground">
                              Opens the student details page (ID, name, DOB, cabinet, drawer, school).
                            </p>
                            <div className="rounded-md bg-white p-3 dark:bg-zinc-950">
                              <QRCode value={qrPayload} size={120} level="L" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
