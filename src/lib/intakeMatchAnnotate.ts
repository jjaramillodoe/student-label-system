import { matchPercent, nameSim } from '@/lib/fuzzyName';
import { parseStudentSearchQuery } from '@/lib/studentSearch';
import type { IntakeMatchStudent } from '@/components/IntakeMatchCard';

/**
 * Attach match % / Same DOB badges to ASISTS gate search hits.
 * `/api/students?search=` does not compute similarity — the intake UI needs it.
 */
export function annotateAssistsSearchMatches(
  students: IntakeMatchStudent[],
  query: string,
): IntakeMatchStudent[] {
  const parsed = parseStudentSearchQuery(query);
  const qFirst = parsed.firstName;
  const qLast = parsed.lastName;

  return students.map(s => {
    if (s._similarity != null) return s;

    const sameDob = Boolean(parsed.dobIso && s.dob && s.dob === parsed.dobIso);

    if (qFirst && qLast) {
      return {
        ...s,
        _similarity: matchPercent({ firstName: qFirst, lastName: qLast }, s),
        ...(sameDob ? { _sameDob: true } : {}),
      };
    }

    if (qFirst || qLast) {
      const token = qFirst || qLast;
      const fullExisting = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
      const pct = Math.round(
        Math.max(
          nameSim(token, s.firstName ?? ''),
          nameSim(token, s.lastName ?? ''),
          nameSim(token, fullExisting),
        ) * 100,
      );
      return {
        ...s,
        _similarity: pct,
        ...(sameDob ? { _sameDob: true } : {}),
      };
    }

    // DOB-only search: every hit already matched that day
    if (sameDob) {
      return { ...s, _similarity: 100, _sameDob: true };
    }

    return s;
  });
}
