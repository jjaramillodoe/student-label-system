/**
 * Intake Member access — pages and APIs they may use after sign-in.
 * Keep this list tight: the role has no dashboard/admin chrome, but the intake
 * form still needs student search/create, cabinet slot lookup, and address verify.
 */

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isIntakeMemberPageAllowed(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    path.startsWith('/intake')
    || path.startsWith('/profile')
    || path.startsWith('/docs')
    || path.startsWith('/student')
    || path.startsWith('/archive')
    || path.startsWith('/auth')
    || path.startsWith('/geo-blocked')
  );
}

const STUDENT_COLLECTION = /^\/api\/students$/;
const STUDENT_BY_ID = /^\/api\/students\/(?!lookup$|bulk-upload$|email-list$)[^/]+$/;

type ApiRule = {
  match: (path: string) => boolean;
  methods: readonly string[];
};

const INTAKE_MEMBER_API_RULES: ApiRule[] = [
  { match: (p) => p.startsWith('/api/auth'), methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  { match: (p) => p.startsWith('/api/intake'), methods: ['GET', 'POST', 'PUT', 'PATCH'] },
  { match: (p) => p.startsWith('/api/profile'), methods: ['GET', 'POST', 'PUT', 'PATCH'] },
  { match: (p) => p === '/api/tenant', methods: ['GET'] },
  { match: (p) => p === '/api/users', methods: ['GET'] },
  { match: (p) => p === '/api/search-events', methods: ['POST'] },
  { match: (p) => STUDENT_COLLECTION.test(p), methods: ['GET', 'POST'] },
  { match: (p) => STUDENT_BY_ID.test(p), methods: ['GET', 'PUT'] },
  { match: (p) => p === '/api/students/lookup', methods: ['GET'] },
  { match: (p) => p === '/api/cabinets', methods: ['GET'] },
  { match: (p) => p === '/api/admin/app-settings', methods: ['GET'] },
  { match: (p) => p === '/api/admin/addresses/verify', methods: ['GET', 'POST'] },
  { match: (p) => p.startsWith('/api/admin/schools/legacy-roster/search'), methods: ['GET'] },
];

function pathHasAnyRule(path: string): boolean {
  return INTAKE_MEMBER_API_RULES.some((rule) => rule.match(path));
}

export function isIntakeMemberApiAllowed(pathname: string, method: string): boolean {
  const path = normalizePath(pathname);
  const verb = method.toUpperCase();

  if (verb === 'OPTIONS' || verb === 'HEAD') {
    return pathHasAnyRule(path);
  }

  return INTAKE_MEMBER_API_RULES.some(
    (rule) => rule.match(path) && rule.methods.includes(verb),
  );
}
