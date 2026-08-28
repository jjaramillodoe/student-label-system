'use client';

import { forwardRef } from 'react';
import {
  AlertCircle, Check, Copy, Mail, ShieldAlert, Users,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import IntakeMatchCard, { type IntakeMatchStudent } from '@/components/IntakeMatchCard';
import { buildIntakeDuplicateAlertMailto } from '@/lib/intakeDuplicateAlert';

export type IntakeDuplicateMatchLists = {
  exact: IntakeMatchStudent[];
  fuzzy: IntakeMatchStudent[];
  legacyExact: IntakeMatchStudent[];
  legacyFuzzy: IntakeMatchStudent[];
};

type DataLead = {
  name: string;
  email: string;
  role: string;
} | null;

type Props = {
  matches: IntakeDuplicateMatchLists;
  siblingAcknowledged: boolean;
  onSiblingAcknowledgedChange: (value: boolean) => void;
  onUseAsReturning?: (student: IntakeMatchStudent) => void;
  dataLead: DataLead;
  copied: boolean;
  onCopyAlert: () => void;
  /** Full plain-text alert used for mailto body (same as copy button). */
  alertMessage?: string;
  cabinetMap: Record<string, string>;
  drawerMap: Record<string, string>;
  siblingCheckboxId?: string;
};

const IntakeDuplicatePanel = forwardRef<HTMLDivElement, Props>(function IntakeDuplicatePanel(
  {
    matches,
    siblingAcknowledged,
    onSiblingAcknowledgedChange,
    onUseAsReturning,
    dataLead,
    copied,
    onCopyAlert,
    alertMessage,
    cabinetMap,
    drawerMap,
    siblingCheckboxId = 'siblingFlag',
  },
  ref,
) {
  const live = [...matches.exact, ...matches.fuzzy];
  const legacy = [...matches.legacyExact, ...matches.legacyFuzzy];
  const dataLeadMailto = dataLead?.email && alertMessage
    ? buildIntakeDuplicateAlertMailto(dataLead.email, alertMessage)
    : dataLead?.email
      ? `mailto:${dataLead.email}`
      : null;

  return (
    <div
      ref={ref}
      className={`rounded-lg border-2 p-4 space-y-3 transition-colors ${
        siblingAcknowledged
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600'
          : 'border-destructive bg-destructive/5'
      }`}
    >
      <div className="flex items-start gap-2">
        {siblingAcknowledged
          ? <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          : <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}
        <div>
          <p className={`font-semibold text-sm ${siblingAcknowledged ? 'text-amber-800 dark:text-amber-200' : 'text-destructive'}`}>
            {siblingAcknowledged
              ? 'Flagged as different person — Data Lead will review'
              : 'Possible existing student(s) found'}
          </p>
          <p className={`text-xs mt-0.5 ${siblingAcknowledged ? 'text-amber-700 dark:text-amber-300' : 'text-destructive/80'}`}>
            Review name, DOB, and address before registering. Low name matches (for example 7%)
            are hidden. Same last name + same DOB can still flag siblings.
          </p>
        </div>
      </div>

      {live.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">In this system</p>
          {live.map((s, i) => (
            <IntakeMatchCard
              key={s._id || i}
              student={s}
              cabinetMap={cabinetMap}
              drawerMap={drawerMap}
              onUseAsReturning={onUseAsReturning}
            />
          ))}
        </div>
      )}

      {legacy.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-violet-800 dark:text-violet-300">ASISTS / legacy roster</p>
          {legacy.map((s, i) => (
            <IntakeMatchCard
              key={s._id || `legacy-${i}`}
              student={s}
              cabinetMap={cabinetMap}
              drawerMap={drawerMap}
              showUseButton={false}
            />
          ))}
        </div>
      )}

      <div className="rounded-md bg-muted/60 border border-border px-3 py-2.5 space-y-2">
        {dataLead && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Not sure? Contact your {dataLead.role}
              </p>
              <p className="text-sm font-semibold text-foreground">{dataLead.name}</p>
            </div>
            {dataLeadMailto && (
              <a
                href={dataLeadMailto}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
              >
                <Mail className="h-3.5 w-3.5" />
                Email with alert
              </a>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={onCopyAlert}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-all ${
              copied
                ? 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                : 'border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            {copied
              ? <><Check className="h-3.5 w-3.5" /> Copied!</>
              : <><Copy className="h-3.5 w-3.5" /> Copy alert message</>}
          </button>
          <span className="text-xs text-muted-foreground">
            Or paste into Teams / Slack. Email link opens with this alert filled in.
          </span>
        </div>
      </div>

      <div className={`rounded-md border px-3 py-3 flex items-start gap-3 transition-colors ${
        siblingAcknowledged
          ? 'border-amber-400 bg-amber-100/60 dark:bg-amber-900/20'
          : 'border-border bg-muted/30'
      }`}>
        <Checkbox
          id={siblingCheckboxId}
          checked={siblingAcknowledged}
          onCheckedChange={v => onSiblingAcknowledgedChange(v === true)}
          className="mt-0.5"
        />
        <label htmlFor={siblingCheckboxId} className="text-sm cursor-pointer select-none">
          <span className="font-medium">This is a different person</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Check this if the student is a sibling, twin, or coincidental match — not the person on file.
            The record will be flagged for your Data Lead to review.
          </span>
        </label>
      </div>
    </div>
  );
});

export default IntakeDuplicatePanel;
