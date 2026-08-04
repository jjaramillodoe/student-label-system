import clientPromise from '@/lib/mongodb';
import {
  effectiveSchoolSlug,
  schoolMatchesSlug,
  schoolNameToSlug,
} from '@/lib/schoolSlug';
import type { SchoolLeader } from '@/lib/schoolLeadership';
import type { IntakeSession } from '@/lib/intakeSession';

export const DEFAULT_SCHOOLS = [
  { name: 'District 79', type: 'District', active: true, agencyId: 'R00', slug: 'district79' },
  ...Array.from({ length: 8 }, (_, index) => ({
    name: `School ${index + 1}`,
    type: 'School',
    active: true,
    agencyId: `R${String(index + 1).padStart(2, '0')}`,
    slug: `school${index + 1}`,
  })),
];

export type SchoolConfigRecord = {
  _id: string;
  name: string;
  type: string;
  active: boolean;
  /** Vanity subdomain slug, e.g. school1 → school1.nycadultedlabels.nyc */
  slug?: string;
  agencyId?: string;
  intakeSessions?: IntakeSession[];
  intakeActivities?: string[];
  currentFiscalYear?: string;
  principal?: SchoolLeader | null;
  assistantPrincipals?: SchoolLeader[];
  legacyRoster?: {
    uploadedAt: string;
    filename: string;
    rowCount: number;
    tableName?: string;
    sourceType: 'mdb' | 'csv';
    uploadedBy?: { name?: string; email?: string };
  };
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSchoolOptions(db: any): Promise<SchoolConfigRecord[]> {
  const configured = (await db
    .collection('school_config')
    .find({})
    .sort({ name: 1 })
    .toArray()) as SchoolConfigRecord[];

  const configuredNames = new Set(
    configured.map((school) => school.name?.toLowerCase()).filter(Boolean),
  );

  const fallbackDefaults = DEFAULT_SCHOOLS.filter(
    (school) => !configuredNames.has(school.name.toLowerCase()),
  ).map((school, index) => ({
    _id: `default-${index}`,
    ...school,
    slug: school.slug || schoolNameToSlug(school.name),
    isDefault: true,
  }));

  return [...configured, ...fallbackDefaults]
    .map((school) => ({
      ...school,
      slug: effectiveSchoolSlug(school),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findSchoolBySlug(slug: string): Promise<SchoolConfigRecord | null> {
  const client = await clientPromise;
  const db = client.db('student-label');
  const schools = await getSchoolOptions(db);
  return schools.find((school) => schoolMatchesSlug(school, slug)) ?? null;
}

/** True if another school (different _id) already uses this subdomain slug. */
export async function isSchoolSlugTaken(
  slug: string,
  excludeId?: string | null,
): Promise<boolean> {
  const client = await clientPromise;
  const db = client.db('student-label');
  const schools = await getSchoolOptions(db);
  return schools.some((school) => {
    if (!schoolMatchesSlug(school, slug)) return false;
    if (!excludeId) return true;
    return String(school._id) !== String(excludeId);
  });
}
