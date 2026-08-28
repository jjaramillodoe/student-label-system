'use client';

import { RefObject } from 'react';
import { USA_NAME_HINT } from '@/lib/usaName';
import {
  beEslAgeErrorMessage,
  buildEligibilityNoticeTicket,
  checkBeEslAgeEligibility,
  downloadEligibilityNoticeTicket,
  evaluateIntakeDob,
  intakeDobMaxIso,
  intakeDobMinIso,
  requiresBeEslAgeCheck,
} from '@/lib/beEslEligibility';
import type { IntakeCheckResult, IntakeFieldSetter, IntakeFormState } from '@/lib/intakeForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  User, Calendar, Phone, Mail, MapPin, Lock, ShieldAlert,
  ExternalLink, FileDown, Info,
} from 'lucide-react';
import IntakeAddressFields, {
  type IntakeAddressVerification,
  type IntakeAddressValues,
} from '@/components/IntakeAddressFields';
import IntakeDuplicatePanel from '@/components/IntakeDuplicatePanel';
import { DateHumanHint, BeEslAgeHint } from '@/components/IntakeDobHints';
import type { IntakeMatchStudent } from '@/components/IntakeMatchCard';

type DataLead = {
  name: string;
  email: string;
  role: string;
} | null;

type Props = {
  form: IntakeFormState;
  setField: IntakeFieldSetter;
  profileLocked: boolean;
  lockedFieldClass: string | undefined;
  intakeDobEval: ReturnType<typeof evaluateIntakeDob>;
  beEslAgeCheck: ReturnType<typeof checkBeEslAgeEligibility> | null;
  dobBlocksForm: boolean;
  newAssistsUnlocked: boolean;
  checkResult: IntakeCheckResult;
  assistsLegacySameAck: boolean;
  assistsDifferentPersonAck: boolean;
  siblingAcknowledged: boolean;
  setSiblingAcknowledged: (value: boolean) => void;
  setAssistsDifferentPersonAck: (value: boolean) => void;
  selectAsReturning: (student: IntakeMatchStudent) => void;
  dataLead: DataLead;
  copied: boolean;
  onCopyAlert: () => void;
  alertMessage?: string;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
  dobDuplicatePanelRef: RefObject<HTMLDivElement | null>;
  staffName: string | null | undefined;
  school: string | null | undefined;
  intakeAddress: IntakeAddressValues;
  setIntakeAddress: (values: IntakeAddressValues) => void;
  addressVerification: IntakeAddressVerification | null;
  setAddressVerification: (v: IntakeAddressVerification | null) => void;
  geoclientConfigured: boolean | null;
};

export default function IntakePersonalInfoCard({
  form,
  setField,
  profileLocked,
  lockedFieldClass,
  intakeDobEval,
  beEslAgeCheck,
  dobBlocksForm,
  newAssistsUnlocked,
  checkResult,
  assistsLegacySameAck,
  assistsDifferentPersonAck,
  siblingAcknowledged,
  setSiblingAcknowledged,
  setAssistsDifferentPersonAck,
  selectAsReturning,
  dataLead,
  copied,
  onCopyAlert,
  alertMessage,
  cabinetMap,
  drawerMap,
  dobDuplicatePanelRef,
  staffName,
  school,
  intakeAddress,
  setIntakeAddress,
  addressVerification,
  setAddressVerification,
  geoclientConfigured,
}: Props) {
  return (
    <>
      {intakeDobEval.nearEligible && intakeDobEval.beEsl.bannerMessage && (
        <Alert className="border-amber-300 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/30">
          <Info className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-sm text-amber-950 dark:text-amber-100">
            Near-eligible for BE / ESL
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-900/90 dark:text-amber-100/90 space-y-3">
            <p>{intakeDobEval.beEsl.bannerMessage}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-amber-400 bg-white/80 hover:bg-white dark:bg-background"
              onClick={() => {
                const content = buildEligibilityNoticeTicket({
                  firstName: form.firstName,
                  lastName: form.lastName,
                  dobIso: form.dob,
                  eligibleOnIso: intakeDobEval.beEsl.eligibleOnIso,
                  daysUntilEligible: intakeDobEval.beEsl.daysUntilEligible,
                  staffName: staffName ?? null,
                  school: school ?? null,
                });
                const safeLast = (form.lastName || 'student').replace(/[^\w-]+/g, '_');
                const datePart = intakeDobEval.beEsl.eligibleOnIso || 'eligibility';
                downloadEligibilityNoticeTicket(
                  `eligibility-notice-${safeLast}-${datePart}.txt`,
                  content,
                );
              }}
            >
              <FileDown className="h-3.5 w-3.5" />
              Export Eligibility Notice
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Personal Information
            {profileLocked && (
              <Badge variant="outline" className="ml-auto text-xs font-normal gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" /> From student record
              </Badge>
            )}
          </CardTitle>
          {profileLocked && (
            <CardDescription className="text-xs">
              Name and dates cannot be changed here. Update on All Students if corrections are needed.
            </CardDescription>
          )}
          {form.intakeStudentStatus === 'NEW' && !profileLocked && (
            <CardDescription className="text-xs">
              Name and DOB were checked against ASISTS. Complete gender and start date, then contact details below.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-[1fr_4.5rem_1fr] gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={e => setField('firstName', e.target.value)}
              placeholder="First name"
              required
              readOnly={profileLocked}
              className={lockedFieldClass}
              autoComplete="given-name"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="middleInitial">MI</Label>
            <Input
              id="middleInitial"
              value={form.middleInitial}
              onChange={e => setField('middleInitial', e.target.value)}
              placeholder="M"
              maxLength={1}
              readOnly={profileLocked}
              className={`${lockedFieldClass ?? ''} uppercase`}
              autoComplete="additional-name"
              spellCheck={false}
              aria-label="Middle initial"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={e => setField('lastName', e.target.value)}
              placeholder="Last name"
              required
              readOnly={profileLocked}
              className={lockedFieldClass}
              autoComplete="family-name"
              spellCheck={false}
            />
          </div>
          {!profileLocked && (
            <p className="sm:col-span-3 text-xs text-muted-foreground -mt-1">
              {USA_NAME_HINT}
            </p>
          )}
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="dob" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Date of Birth <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <Input
                id="dob"
                type="date"
                value={form.dob}
                onChange={e => setField('dob', e.target.value)}
                min={intakeDobMinIso()}
                max={intakeDobMaxIso()}
                className={`sm:max-w-[220px] ${lockedFieldClass ?? ''} ${
                  form.dob && intakeDobEval.boundaryError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
                required
                readOnly={profileLocked}
              />
              {form.dob && <DateHumanHint value={form.dob} />}
            </div>
            {form.dob && intakeDobEval.boundaryError && (
              <p className="text-xs font-medium text-destructive" role="alert">
                {intakeDobEval.boundaryError}
              </p>
            )}
            {form.dob
              && !intakeDobEval.boundaryError
              && beEslAgeCheck
              && requiresBeEslAgeCheck(form) && (
              <BeEslAgeHint check={beEslAgeCheck} />
            )}
            {!form.dob && form.intakeStudentStatus !== 'Other' && (
              <p className="text-xs text-muted-foreground">
                Must be at least 16 to enroll in adult education. BE/ESL requires age 21
                (or within 6 weeks of turning 21).
              </p>
            )}
            {form.intakeStudentStatus === 'NEW' && newAssistsUnlocked && checkResult.status === 'needs_dob' && (
              <p className="text-xs font-medium text-sky-800 dark:text-sky-300">
                Enter DOB to scan for duplicates and possible siblings (same DOB + similar name, or same address).
              </p>
            )}
            {form.intakeStudentStatus === 'NEW'
              && newAssistsUnlocked
              && checkResult.status === 'found'
              && !assistsLegacySameAck && (
              <IntakeDuplicatePanel
                ref={dobDuplicatePanelRef}
                matches={checkResult}
                siblingAcknowledged={siblingAcknowledged || assistsDifferentPersonAck}
                onSiblingAcknowledgedChange={on => {
                  setSiblingAcknowledged(on);
                  if (on) setAssistsDifferentPersonAck(true);
                }}
                onUseAsReturning={selectAsReturning}
                dataLead={dataLead}
                copied={copied}
                onCopyAlert={onCopyAlert}
                alertMessage={alertMessage}
                cabinetMap={cabinetMap}
                drawerMap={drawerMap}
                siblingCheckboxId="siblingFlag"
              />
            )}
          </div>

          {dobBlocksForm && (
            <div className="sm:col-span-3">
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="text-sm">Cannot continue intake</AlertTitle>
                <AlertDescription className="text-xs space-y-2">
                  <p>
                    {intakeDobEval.boundaryError
                      || intakeDobEval.beEsl.ineligibleMessage
                      || (beEslAgeCheck ? beEslAgeErrorMessage(beEslAgeCheck) : 'Update the date of birth to continue.')}
                  </p>
                  {intakeDobEval.beEsl.applicable
                    && !intakeDobEval.boundaryError
                    && intakeDobEval.beEsl.ineligibleMessage && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
                      <a href="https://p2g.nyc/contact/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Pathways to Graduation (P2G)
                      </a>
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!dobBlocksForm && (
          <>
          {form.intakeStudentStatus === 'NEW' && (
            <div className="space-y-2">
              <Label>Gender <span className="text-destructive">*</span></Label>
              <div className="flex gap-6 pt-1">
                {['M', 'F'].map(g => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={form.gender === g}
                      onChange={() => setField('gender', g)}
                      className="accent-primary"
                      required={form.intakeStudentStatus === 'NEW'}
                    />
                    <span className="text-sm font-medium">{g === 'M' ? 'Male' : 'Female'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.intakeStudentStatus === 'NEW' && (
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
              <Input id="startDate" type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} required />
            </div>
          )}

          {['RETURNING', 'CTE Orientation'].includes(form.intakeStudentStatus) && (
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="originalStartDate">Original Start Date</Label>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <Input
                  id="originalStartDate"
                  type="date"
                  value={form.originalStartDate}
                  onChange={e => setField('originalStartDate', e.target.value)}
                  className={`sm:max-w-[220px] ${lockedFieldClass ?? ''}`}
                  readOnly={profileLocked}
                />
                {form.originalStartDate && <DateHumanHint value={form.originalStartDate} />}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.intakeStudentStatus === 'RETURNING'
                  ? 'If returning student, check ASISTS for the start date'
                  : 'If student is continuing intake, get prev. start date from intake registration'}
              </p>
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {!dobBlocksForm && (form.intakeStudentStatus === 'NEW' || profileLocked) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Contact &amp; Address
              {profileLocked && (
                <Badge variant="outline" className="ml-auto text-xs font-normal gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" /> From student record
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {profileLocked
                ? 'Contact and address on file. Update on All Students if corrections are needed.'
                : 'Optional contact info. Verify the home address with NYC Geoclient before registering.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cellPhone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Cell Phone
                </Label>
                <Input
                  id="cellPhone"
                  type="tel"
                  value={form.cellPhone}
                  onChange={e => setField('cellPhone', e.target.value)}
                  placeholder="(555) 555-5555"
                  readOnly={profileLocked}
                  className={lockedFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homePhone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Home Phone
                </Label>
                <Input
                  id="homePhone"
                  type="tel"
                  value={form.homePhoneSameAsCell ? form.cellPhone : form.homePhone}
                  onChange={e => setField('homePhone', e.target.value)}
                  placeholder="(555) 555-5555"
                  readOnly={profileLocked || form.homePhoneSameAsCell}
                  disabled={!profileLocked && form.homePhoneSameAsCell}
                  className={lockedFieldClass}
                />
                {!profileLocked && (
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
                    <Checkbox
                      id="homePhoneSameAsCell"
                      checked={form.homePhoneSameAsCell}
                      onCheckedChange={(checked) => setField('homePhoneSameAsCell', checked === true)}
                    />
                    Same as Cell Phone
                  </label>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder="student@email.com"
                  readOnly={profileLocked}
                  className={lockedFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactNameRelationship">Emergency Contact Name / Relationship</Label>
                <Input
                  id="emergencyContactNameRelationship"
                  value={form.emergencyContactNameRelationship}
                  onChange={e => setField('emergencyContactNameRelationship', e.target.value)}
                  placeholder="Name / relationship"
                  readOnly={profileLocked}
                  className={lockedFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  value={form.emergencyContactPhone}
                  onChange={e => setField('emergencyContactPhone', e.target.value)}
                  placeholder="(555) 555-5555"
                  readOnly={profileLocked}
                  className={lockedFieldClass}
                />
              </div>
            </div>
            <IntakeAddressFields
              values={intakeAddress}
              onChange={setIntakeAddress}
              verification={addressVerification}
              onVerificationChange={setAddressVerification}
              geoclientConfigured={geoclientConfigured}
              readOnly={profileLocked}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
