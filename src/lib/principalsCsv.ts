import type { SchoolLeader } from '@/lib/schoolLeadership';

export type PrincipalsCsvSchoolRow = {
  school: string;
  principal: SchoolLeader | null;
  assistantPrincipals: SchoolLeader[];
};

function cleanCell(value: string | undefined): string {
  return (value ?? '').trim();
}

function isPlaceholderName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return !n || n === 'tbd' || n === 'n/a' || n === 'na' || n === '-';
}

function leader(name: string, email: string): SchoolLeader | null {
  if (isPlaceholderName(name)) return null;
  return {
    name: name.trim(),
    email: email.trim() || undefined,
  };
}

/** Minimal CSV parser for quoted fields. */
export function parseCsvText(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  const rows: string[][] = [];

  for (const line of lines) {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }

  return rows;
}

/**
 * Parse district principals export:
 * School, Principal Name, Email Address, AP Name 1, AP Email1, AP Name2, AP Email2
 *
 * Handles common export quirks where an AP email lands in the wrong column
 * (name in AP1, email in AP2 with empty AP2 name).
 */
export function parsePrincipalsCsv(text: string): PrincipalsCsvSchoolRow[] {
  const rows = parseCsvText(text);
  if (rows.length < 2) return [];

  const out: PrincipalsCsvSchoolRow[] = [];

  for (const cells of rows.slice(1)) {
    const school = cleanCell(cells[0]);
    if (!school || !/^school\s*\d+/i.test(school)) continue;

    const principalName = cleanCell(cells[1]);
    const principalEmail = cleanCell(cells[2]);
    let ap1Name = cleanCell(cells[3]);
    let ap1Email = cleanCell(cells[4]);
    let ap2Name = cleanCell(cells[5]);
    let ap2Email = cleanCell(cells[6]);

    // Fix: AP name in col 4, email accidentally in AP Email2, AP Name2 blank
    if (ap1Name && !ap1Email && !ap2Name && ap2Email) {
      ap1Email = ap2Email;
      ap2Email = '';
    }
    // Fix: AP2 name blank but email present with AP1 already complete — orphan email
    if (!ap2Name && ap2Email && ap1Name && ap1Email) {
      ap2Email = '';
    }

    const assistantPrincipals = [
      leader(ap1Name, ap1Email),
      leader(ap2Name, ap2Email),
    ].filter((l): l is SchoolLeader => l != null);

    out.push({
      school,
      principal: leader(principalName, principalEmail),
      assistantPrincipals,
    });
  }

  return out;
}
