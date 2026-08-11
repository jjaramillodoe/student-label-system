/**
 * Review helpers: match school_legacy_roster rows against live students
 * and flag low-quality / garbage ASISTS import data.
 */

import { isPossibleDuplicate, matchPercent } from '@/lib/fuzzyName';

export type GarbageFlagCode =
  | 'short_first_name'
  | 'short_last_name'
  | 'placeholder_name'
  | 'missing_dob'
  | 'invalid_dob'
  | 'dob_future'
  | 'dob_too_old'
  | 'missing_external_id'
  | 'numeric_name'
  | 'same_single_initials';

export type GarbageFlag = {
  code: GarbageFlagCode;
  label: string;
  severity: 'error' | 'warning' | 'info';
};

export type LiveMatchSummary = {
  _id: string;
  firstName: string;
  lastName: string;
  dob?: string;
  studentId?: string;
  labelId?: string;
  status?: string;
  similarity: number;
  matchKind: 'exact_name_dob' | 'external_id' | 'fuzzy' | 'id_name_conflict';
};

export type LegacyReviewRow = {
  _id: string;
  firstName: string;
  lastName: string;
  dob: string;
  externalId?: string;
  sourceFilename?: string;
  sourceTable?: string;
  garbage: GarbageFlag[];
  liveMatches: LiveMatchSummary[];
};

const PLACEHOLDERS = new Set([
  'tbd', 'n/a', 'na', 'none', 'unknown', 'test', 'xxx', 'xx', 'temp',
  'student', 'firstname', 'lastname', 'fname', 'lname', '-', '.',
]);

function lettersOnly(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
}

function isIsoDob(dob: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dob);
}

export function detectLegacyGarbage(row: {
  firstName?: string;
  lastName?: string;
  dob?: string;
  externalId?: string;
}): GarbageFlag[] {
  const flags: GarbageFlag[] = [];
  const first = String(row.firstName || '').trim();
  const last = String(row.lastName || '').trim();
  const firstL = lettersOnly(first);
  const lastL = lettersOnly(last);
  const dob = String(row.dob || '').trim();
  const externalId = String(row.externalId || '').trim();

  if (firstL.length <= 1) {
    flags.push({
      code: 'short_first_name',
      label: `First name too short (“${first || '—'}”)`,
      severity: 'error',
    });
  }
  if (lastL.length <= 1) {
    flags.push({
      code: 'short_last_name',
      label: `Last name too short (“${last || '—'}”)`,
      severity: 'error',
    });
  }

  if (PLACEHOLDERS.has(first.toLowerCase()) || PLACEHOLDERS.has(last.toLowerCase())) {
    flags.push({
      code: 'placeholder_name',
      label: 'Placeholder name (TBD / N/A / test / …)',
      severity: 'error',
    });
  }

  if (/^\d+$/.test(first) || /^\d+$/.test(last)) {
    flags.push({
      code: 'numeric_name',
      label: 'Name is numeric only',
      severity: 'error',
    });
  }

  if (firstL.length === 1 && lastL.length === 1 && firstL === lastL) {
    flags.push({
      code: 'same_single_initials',
      label: 'First and last are the same single letter',
      severity: 'warning',
    });
  }

  if (!dob) {
    flags.push({
      code: 'missing_dob',
      label: 'Missing date of birth',
      severity: 'error',
    });
  } else if (!isIsoDob(dob) || Number.isNaN(Date.parse(dob))) {
    flags.push({
      code: 'invalid_dob',
      label: `Invalid DOB (“${dob}”)`,
      severity: 'error',
    });
  } else {
    const year = Number(dob.slice(0, 4));
    const today = new Date().toISOString().slice(0, 10);
    if (dob > today) {
      flags.push({
        code: 'dob_future',
        label: 'DOB is in the future',
        severity: 'error',
      });
    } else if (year < 1920) {
      flags.push({
        code: 'dob_too_old',
        label: `Birth year ${year} looks too old (before 1920)`,
        severity: 'warning',
      });
    }
  }

  if (!externalId) {
    flags.push({
      code: 'missing_external_id',
      label: 'Missing ASISTS / external ID',
      severity: 'info',
    });
  }

  return flags;
}

type LiveStudent = {
  _id: unknown;
  firstName?: string;
  lastName?: string;
  dob?: string;
  studentId?: string;
  labelId?: string;
  status?: string;
  externalId?: string;
};

function fullName(s: { firstName?: string; lastName?: string }) {
  return `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
}

function serializeLive(
  s: LiveStudent,
  similarity: number,
  matchKind: LiveMatchSummary['matchKind'],
): LiveMatchSummary {
  return {
    _id: String(s._id),
    firstName: String(s.firstName || ''),
    lastName: String(s.lastName || ''),
    dob: s.dob ? String(s.dob) : undefined,
    studentId: s.studentId ? String(s.studentId) : undefined,
    labelId: s.labelId ? String(s.labelId) : undefined,
    status: s.status ? String(s.status) : undefined,
    similarity,
    matchKind,
  };
}

/**
 * Compare one legacy row to the live student set.
 */
export function matchLegacyAgainstLive(
  legacy: { firstName?: string; lastName?: string; dob?: string; externalId?: string },
  liveStudents: LiveStudent[],
  byDob: Map<string, LiveStudent[]>,
  byStudentId: Map<string, LiveStudent>,
): LiveMatchSummary[] {
  const matches: LiveMatchSummary[] = [];
  const seen = new Set<string>();
  const push = (m: LiveMatchSummary) => {
    if (seen.has(m._id)) return;
    seen.add(m._id);
    matches.push(m);
  };

  const ext = String(legacy.externalId || '').trim().toLowerCase();
  if (ext) {
    const byId = byStudentId.get(ext);
    if (byId) {
      const sameName = fullName(legacy) === fullName(byId);
      const sameDob = Boolean(legacy.dob && byId.dob && legacy.dob === byId.dob);
      push(serializeLive(
        byId,
        sameName && sameDob ? 100 : matchPercent(
          { firstName: String(legacy.firstName || ''), lastName: String(legacy.lastName || '') },
          byId,
        ),
        sameName ? 'external_id' : 'id_name_conflict',
      ));
    }
  }

  const dob = String(legacy.dob || '').trim();
  const candidates = dob ? (byDob.get(dob) || []) : liveStudents;
  const pool = dob ? candidates : liveStudents.slice(0, 500); // avoid O(n²) without DOB

  for (const live of pool) {
    const sameDob = Boolean(dob && live.dob && dob === live.dob);
    const sameName = fullName(legacy) === fullName(live);
    if (sameDob && sameName) {
      push(serializeLive(live, 100, 'exact_name_dob'));
      continue;
    }
    if (
      isPossibleDuplicate(
        {
          firstName: String(legacy.firstName || ''),
          lastName: String(legacy.lastName || ''),
          dob: dob || undefined,
        },
        live,
      )
    ) {
      push(serializeLive(
        live,
        matchPercent(
          { firstName: String(legacy.firstName || ''), lastName: String(legacy.lastName || '') },
          live,
        ),
        'fuzzy',
      ));
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);
  return matches.slice(0, 8);
}

export function findWithinLegacyDuplicates(
  rows: Array<{
    _id: unknown;
    firstName?: string;
    lastName?: string;
    dob?: string;
    externalId?: string;
  }>,
): Array<{ key: string; rows: Array<{ _id: string; firstName: string; lastName: string; dob: string; externalId?: string }> }> {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = [
      String(r.lastName || '').trim().toLowerCase(),
      String(r.firstName || '').trim().toLowerCase(),
      String(r.dob || '').trim(),
      String(r.externalId || '').trim().toLowerCase(),
    ].join('|');
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }

  const out: Array<{
    key: string;
    rows: Array<{ _id: string; firstName: string; lastName: string; dob: string; externalId?: string }>;
  }> = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    out.push({
      key,
      rows: group.map((r) => ({
        _id: String(r._id),
        firstName: String(r.firstName || ''),
        lastName: String(r.lastName || ''),
        dob: String(r.dob || ''),
        externalId: r.externalId ? String(r.externalId) : undefined,
      })),
    });
  }

  return out.slice(0, 100);
}

export function buildLegacyReviewIndexes(liveStudents: LiveStudent[]) {
  const byDob = new Map<string, LiveStudent[]>();
  const byStudentId = new Map<string, LiveStudent>();
  for (const s of liveStudents) {
    if (s.dob) {
      const arr = byDob.get(s.dob) || [];
      arr.push(s);
      byDob.set(s.dob, arr);
    }
    const sid = String(s.studentId || s.externalId || '').trim().toLowerCase();
    if (sid) byStudentId.set(sid, s);
  }
  return { byDob, byStudentId };
}
