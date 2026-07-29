import MDBReader from 'mdb-reader';
import { normalizeDobToIso } from '@/lib/studentSearch';
import { parseCsv } from '@/lib/csv';
import { isPossibleDuplicate, matchPercent } from '@/lib/fuzzyName';

export const LEGACY_ROSTER_COLLECTION = 'school_legacy_roster';

export type LegacyRosterRow = {
  school: string;
  firstName: string;
  lastName: string;
  dob: string;
  externalId?: string;
  sourceTable?: string;
  sourceFilename: string;
  sourceType: 'mdb' | 'csv';
  importedAt: string;
};

export type LegacyRosterMeta = {
  uploadedAt: string;
  filename: string;
  rowCount: number;
  tableName?: string;
  sourceType: 'mdb' | 'csv';
  uploadedBy?: { name?: string; email?: string };
};

const FIRST_KEYS = [
  'firstname', 'first_name', 'first name', 'fname', 'studentfirstname',
  'student first name', 'givenname', 'given_name', 'studentfname',
];
const LAST_KEYS = [
  'lastname', 'last_name', 'last name', 'lname', 'studentlastname',
  'student last name', 'surname', 'familyname', 'family_name', 'studentlname',
];
const DOB_KEYS = [
  'dob', 'dateofbirth', 'date of birth', 'birthdate', 'birth_date', 'birth date',
  'studentdob', 'date_of_birth', 'bdate',
];
const ID_KEYS = [
  'studentid', 'student_id', 'student id', 'osis', 'sid', 'id', 'assistsid',
  'assists_id', 'externalid', 'external_id',
];

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function findColumn(columns: string[], candidates: string[]): string | null {
  const normalized = columns.map(c => ({ raw: c, n: normKey(c) }));
  for (const cand of candidates) {
    const hit = normalized.find(c => c.n === cand || c.n.replace(/ /g, '') === cand.replace(/ /g, ''));
    if (hit) return hit.raw;
  }
  // partial contains
  for (const cand of candidates) {
    const hit = normalized.find(c => c.n.includes(cand) || cand.includes(c.n));
    if (hit) return hit.raw;
  }
  return null;
}

export function normalizeLegacyDob(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (!str) return '';
  const iso = normalizeDobToIso(str);
  if (iso) return iso;
  // Access sometimes exports as MM/DD/YY or with time
  const withTime = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (withTime) {
    const [, m, d, yRaw] = withTime;
    let y = yRaw;
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str.slice(0, 10);
}

function cell(row: Record<string, unknown>, key: string | null): string {
  if (!key) return '';
  const v = row[key];
  if (v == null) return '';
  if (v instanceof Date) return normalizeLegacyDob(v);
  return String(v).trim();
}

export type MappedColumns = {
  firstName: string;
  lastName: string;
  dob: string;
  externalId: string | null;
};

export function mapStudentColumns(columns: string[]): MappedColumns | null {
  const firstName = findColumn(columns, FIRST_KEYS);
  const lastName = findColumn(columns, LAST_KEYS);
  const dob = findColumn(columns, DOB_KEYS);
  if (!firstName || !lastName || !dob) return null;
  return {
    firstName,
    lastName,
    dob,
    externalId: findColumn(columns, ID_KEYS),
  };
}

function rowsFromObjects(
  objects: Record<string, unknown>[],
  mapping: MappedColumns,
  meta: { school: string; sourceFilename: string; sourceType: 'mdb' | 'csv'; tableName?: string; importedAt: string },
): LegacyRosterRow[] {
  const out: LegacyRosterRow[] = [];
  const seen = new Set<string>();

  for (const row of objects) {
    const firstName = cell(row, mapping.firstName);
    const lastName = cell(row, mapping.lastName);
    const dob = normalizeLegacyDob(cell(row, mapping.dob) || row[mapping.dob]);
    if (!firstName || !lastName) continue;
    const externalId = cell(row, mapping.externalId) || undefined;
    const key = `${lastName}|${firstName}|${dob}|${externalId || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      school: meta.school,
      firstName,
      lastName,
      dob,
      externalId,
      sourceTable: meta.tableName,
      sourceFilename: meta.sourceFilename,
      sourceType: meta.sourceType,
      importedAt: meta.importedAt,
    });
  }
  return out;
}

export type ParseLegacyResult = {
  rows: LegacyRosterRow[];
  tableName?: string;
  tableNames: string[];
  columns: string[];
  mapping: MappedColumns;
};

/** Pick best Access table that maps to student name + DOB columns. */
export function parseMdbBuffer(
  buffer: Buffer,
  school: string,
  filename: string,
  preferredTable?: string,
): ParseLegacyResult {
  const reader = new MDBReader(buffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });
  if (!tableNames.length) {
    throw new Error('No tables found in this Access database.');
  }

  const candidates = preferredTable
    ? [preferredTable, ...tableNames.filter(t => t !== preferredTable)]
    : [...tableNames].sort((a, b) => {
        try {
          return reader.getTable(b).getData().length - reader.getTable(a).getData().length;
        } catch {
          return 0;
        }
      });

  let lastError = 'Could not find a table with First Name, Last Name, and DOB columns.';
  for (const tableName of candidates) {
    try {
      const table = reader.getTable(tableName);
      const columns = table.getColumnNames();
      const mapping = mapStudentColumns(columns);
      if (!mapping) {
        lastError = `Table "${tableName}" columns not mapped (${columns.slice(0, 8).join(', ')}…).`;
        continue;
      }
      const data = table.getData() as Record<string, unknown>[];
      const importedAt = new Date().toISOString();
      const rows = rowsFromObjects(data, mapping, {
        school,
        sourceFilename: filename,
        sourceType: 'mdb',
        tableName,
        importedAt,
      });
      if (rows.length === 0) {
        lastError = `Table "${tableName}" mapped but produced 0 student rows.`;
        continue;
      }
      return { rows, tableName, tableNames, columns, mapping };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

export function parseLegacyCsv(
  text: string,
  school: string,
  filename: string,
): ParseLegacyResult {
  const matrix = parseCsv(text);
  if (matrix.length < 2) throw new Error('CSV needs a header row and at least one data row.');
  const headers = matrix[0];
  const mapping = mapStudentColumns(headers);
  if (!mapping) {
    throw new Error(
      `CSV headers must include First Name, Last Name, and DOB. Found: ${headers.join(', ')}`,
    );
  }
  const objects = matrix.slice(1).map(cells => {
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
  const importedAt = new Date().toISOString();
  const rows = rowsFromObjects(objects, mapping, {
    school,
    sourceFilename: filename,
    sourceType: 'csv',
    importedAt,
  });
  if (!rows.length) throw new Error('CSV parsed but no valid student rows were found.');
  return { rows, tableNames: ['csv'], columns: headers, mapping };
}

export function matchLegacyRoster(
  roster: Array<{ firstName?: string; lastName?: string; dob?: string; externalId?: string; _id?: unknown }>,
  incoming: { firstName: string; lastName: string; dob: string },
) {
  const exact: Array<Record<string, unknown>> = [];
  const fuzzy: Array<Record<string, unknown>> = [];

  for (const s of roster) {
    const fullIncoming = `${incoming.firstName} ${incoming.lastName}`.trim().toLowerCase();
    const fullExisting = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
    const sameDob = Boolean(incoming.dob && s.dob && incoming.dob === s.dob);

    const base = {
      ...s,
      _id: s._id ? String(s._id) : `legacy-${s.lastName}-${s.firstName}-${s.dob}`,
      _legacy: true as const,
      status: 'ASISTS / Legacy',
    };

    if (sameDob && fullIncoming === fullExisting) {
      exact.push(base);
    } else if (sameDob && isPossibleDuplicate(incoming, s)) {
      fuzzy.push({ ...base, _similarity: matchPercent(incoming, s) });
    } else if (
      fullIncoming === fullExisting
      && incoming.dob
      && s.dob
      && incoming.dob !== s.dob
    ) {
      fuzzy.push({ ...base, _dobMismatch: true, _similarity: 100 });
    }
  }

  return { exact, fuzzy };
}
