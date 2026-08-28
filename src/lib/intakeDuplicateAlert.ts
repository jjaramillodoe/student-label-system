import { formatStudentAddressStacked } from '@/lib/addressValidation';
import { addressMatchLabel, type AddressMatchKind } from '@/lib/addressDuplicate';
import { formatFullName } from '@/lib/personName';

type AlertStudent = {
  firstName?: string;
  lastName?: string;
  dob?: string;
  phone?: string;
  email?: string;
  labelId?: string;
  studentId?: string;
  externalId?: string;
  status?: string;
  _legacy?: boolean;
  _similarity?: number;
  _dobMismatch?: boolean;
  _sameDob?: boolean;
  _addressMatch?: AddressMatchKind;
  _addressExisting?: string;
};

type AlertMatchLists = {
  exact: AlertStudent[];
  fuzzy: AlertStudent[];
  legacyExact?: AlertStudent[];
  legacyFuzzy?: AlertStudent[];
};

function formatDob(iso?: string | null): string {
  if (!iso?.trim()) return '—';
  const d = new Date(`${iso.trim()}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function displayOrDash(value?: string | null): string {
  const t = value?.trim();
  return t ? t : '—';
}

function studentIdLine(s: AlertStudent): string {
  return s.labelId || s.studentId || s.externalId || '—';
}

function appendMatchBlock(lines: string[], matches: AlertStudent[], heading: string) {
  if (matches.length === 0) return;
  lines.push(heading);
  matches.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${formatFullName(s) || '—'}`);
    lines.push(`     DOB: ${formatDob(s.dob)}`);
    lines.push(`     Label / ID: ${studentIdLine(s)}`);
    lines.push(`     Status: ${displayOrDash(s.status || (s._legacy ? 'ASISTS / Legacy' : undefined))}`);
    if (typeof s._similarity === 'number') {
      lines.push(`     Name similarity: ${s._similarity}%`);
    }
    if (s._sameDob) lines.push(`     Same date of birth as the new student`);
    if (s._dobMismatch) lines.push(`     Note: DOB differs from the new student`);
    if (s._addressMatch) {
      lines.push(`     Address match: ${addressMatchLabel(s._addressMatch)}`);
      if (s._addressExisting) lines.push(`     Address on file: ${s._addressExisting}`);
    }
    lines.push(``);
  });
}

export type BuildIntakeDuplicateAlertInput = {
  form: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    phone?: string;
    homePhone?: string;
    email?: string;
  };
  matches: AlertMatchLists;
  address?: {
    streetLine?: string;
    cityStateZip?: string;
  } | null;
  /** Intake staff reporting the alert */
  reportedBy?: string | null;
  school?: string | null;
  /** Intake confirmed “different person” / sibling path */
  flaggedDifferentPerson?: boolean;
  reviewUrl?: string;
  now?: Date;
};

/**
 * Plain-text alert for email / Teams / Slack when intake finds a possible duplicate.
 */
export function buildIntakeDuplicateAlertMessage(input: BuildIntakeDuplicateAlertInput): string {
  const now = input.now ?? new Date();
  const when = now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const incomingName = formatFullName(input.form.firstName, input.form.lastName);
  const live = [...(input.matches.exact || []), ...(input.matches.fuzzy || [])];
  const legacy = [...(input.matches.legacyExact || []), ...(input.matches.legacyFuzzy || [])];
  const reviewUrl = input.reviewUrl || '/admin/duplicates';

  const addrLine = input.address?.streetLine
    ? `${input.address.streetLine}${input.address.cityStateZip ? `, ${input.address.cityStateZip}` : ''}`
    : null;

  const lines: string[] = [
    `Subject: Possible duplicate student — Intake alert`,
    ``,
    `Hello,`,
    ``,
    input.flaggedDifferentPerson
      ? `Intake flagged a NEW registration as a different person from a possible match (sibling, twin, or name coincidence). Please review.`
      : `Intake needs a Data Lead review — a NEW registration may match a student already on file.`,
    ``,
    `Reported: ${when}`,
    `School: ${displayOrDash(input.school)}`,
    `Reported by: ${displayOrDash(input.reportedBy)}`,
    ``,
    `Student being registered (NEW)`,
    `  Name: ${displayOrDash(incomingName)}`,
    `  DOB: ${formatDob(input.form.dob)}`,
    `  Phone: ${displayOrDash(input.form.homePhone || input.form.phone)}`,
    `  Email: ${displayOrDash(input.form.email)}`,
    ...(addrLine ? [`  Address: ${addrLine}`] : [`  Address: —`]),
    ``,
  ];

  if (live.length === 0 && legacy.length === 0) {
    lines.push(`No match details were attached. Please check the Duplicates review page.`);
    lines.push(``);
  } else {
    appendMatchBlock(lines, live, `Possible match(es) in this system`);
    appendMatchBlock(lines, legacy, `Possible match(es) on ASISTS / legacy roster`);
  }

  lines.push(`What to do`);
  lines.push(`  1. Open the Duplicates review page (link below).`);
  lines.push(`  2. Decide: same person, siblings, or coincidence.`);
  lines.push(`  3. Merge, dismiss, or confirm siblings — then tell intake whether to continue as NEW or switch to RETURNING.`);
  lines.push(``);
  lines.push(`Duplicates review: ${reviewUrl}`);
  lines.push(``);
  lines.push(`Thank you.`);

  return lines.join('\n');
}

/** Build a mailto: URL with subject + body for one-click Data Lead email. */
export function buildIntakeDuplicateAlertMailto(
  email: string,
  message: string,
): string {
  const subjectMatch = message.match(/^Subject:\s*(.+)$/m);
  const subject = subjectMatch?.[1]?.trim() || 'Possible duplicate student — Intake alert';
  const body = message.replace(/^Subject:\s*.+\n\n?/, '');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Convenience when address comes from intake geoclient / form fields. */
export function stackedAddressForAlert(
  address: Parameters<typeof formatStudentAddressStacked>[0] | null | undefined,
): { streetLine?: string; cityStateZip?: string } | null {
  if (!address) return null;
  const stacked = formatStudentAddressStacked(address);
  if (!stacked?.streetLine && !stacked?.cityStateZip) return null;
  return stacked;
}
