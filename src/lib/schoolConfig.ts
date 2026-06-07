import clientPromise from '@/lib/mongodb';
import { slugMatchesSchoolName } from '@/lib/schoolSlug';
import type { SchoolLeader } from '@/lib/schoolLeadership';

export const DEFAULT_SCHOOLS = [
  { name: 'District 79', type: 'District', active: true, agencyId: 'R00' },
  ...Array.from({ length: 8 }, (_, index) => ({
    name: `School ${index + 1}`,
    type: 'School',
    active: true,
    agencyId: `R${String(index + 1).padStart(2, '0')}`,
  })),
];

export type SchoolConfigRecord = {
  _id: string;
  name: string;
  type: string;
  active: boolean;
  agencyId?: string;
  intakeSessions?: string[];
  intakeActivities?: string[];
  currentFiscalYear?: string;
  principal?: SchoolLeader | null;
  assistantPrincipals?: SchoolLeader[];
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
    isDefault: true,
  }));

  return [...configured, ...fallbackDefaults].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function findSchoolBySlug(slug: string): Promise<SchoolConfigRecord | null> {
  const client = await clientPromise;
  const db = client.db('student-label');
  const schools = await getSchoolOptions(db);
  return schools.find((school) => slugMatchesSchoolName(slug, school.name)) ?? null;
}
