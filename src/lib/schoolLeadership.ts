export type SchoolLeader = {
  name: string;
  email?: string;
  phone?: string;
};

function trimOptional(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

/** Normalize a single leader record; returns null when name is empty. */
export function normalizeSchoolLeader(input: unknown): SchoolLeader | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) return null;
  return {
    name,
    email: trimOptional(record.email),
    phone: trimOptional(record.phone),
  };
}

/** Normalize principal — at most one; null when unset. */
export function normalizePrincipal(input: unknown): SchoolLeader | null {
  return normalizeSchoolLeader(input);
}

/** Normalize assistant principals — zero or more with non-empty names. */
export function normalizeAssistantPrincipals(input: unknown): SchoolLeader[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(normalizeSchoolLeader)
    .filter((leader): leader is SchoolLeader => leader != null);
}

export const EMPTY_SCHOOL_LEADER: SchoolLeader = { name: '', email: '', phone: '' };

function leaderToFormField(leader: SchoolLeader | null | undefined): SchoolLeader {
  if (!leader?.name) return { ...EMPTY_SCHOOL_LEADER };
  return {
    name: leader.name,
    email: leader.email ?? '',
    phone: leader.phone ?? '',
  };
}

export function leadershipToFormFields(school: {
  principal?: SchoolLeader | null;
  assistantPrincipals?: SchoolLeader[];
}): { principal: SchoolLeader; assistantPrincipals: SchoolLeader[] } {
  return {
    principal: leaderToFormField(school.principal),
    assistantPrincipals: (school.assistantPrincipals ?? []).map(leaderToFormField),
  };
}
