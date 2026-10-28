/**
 * Who can manage which user accounts.
 *
 * Admins manage everyone. Data Leads manage the Data Members and Intake Members at
 * their own school: create, edit, reset passwords, and unlock. They cannot create or
 * change Admins or Data Leads (including themselves), move users to another school,
 * delete users, or change MFA.
 */

export const USER_MANAGER_ROLES = ['Admin', 'Data Lead'] as const;

/** Roles a Data Lead may assign or manage. */
export const DATA_LEAD_MANAGEABLE_ROLES = ['Data Member', 'Intake Member'] as const;

/** Security actions on /api/admin/users/[id]/security that Data Leads may run. */
export const DATA_LEAD_SECURITY_ACTIONS = [
  'reset-password',
  'force-password-change',
  'clear-force-password-change',
  'unlock-account',
] as const;

export type UserManager = {
  role?: string | null;
  school?: string | null;
  email?: string | null;
};

/** A stored user document; fields are read loosely because Mongo documents are untyped. */
export type ManagedUser = {
  role?: unknown;
  school?: unknown;
  email?: unknown;
  [key: string]: unknown;
};

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isDataLeadWithSchool(actor: UserManager): actor is UserManager & { school: string } {
  return actor.role === 'Data Lead' && typeof actor.school === 'string' && actor.school.trim() !== '';
}

function isManageableRole(role?: string | null): boolean {
  return (DATA_LEAD_MANAGEABLE_ROLES as readonly string[]).includes(role || '');
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

/** Mongo filter for the users an actor can see in User Management, or null for none. */
export function userListFilter(actor: UserManager): Record<string, unknown> | null {
  if (actor.role === 'Admin') return {};
  if (isDataLeadWithSchool(actor)) return { school: actor.school };
  return null;
}

/** Can the actor edit, reset, or unlock this existing user? */
export function canManageUser(actor: UserManager, target: ManagedUser): boolean {
  if (actor.role === 'Admin') return true;
  if (!isDataLeadWithSchool(actor)) return false;
  if (sameEmail(actor.email, str(target.email))) return false;
  return str(target.school) === actor.school && isManageableRole(str(target.role));
}

/** Can the actor give a user this role and school (on create, or as the result of an edit)? */
export function canAssignUser(actor: UserManager, next: { role?: string | null; school?: string | null }): boolean {
  if (actor.role === 'Admin') return true;
  if (!isDataLeadWithSchool(actor)) return false;
  return next.school === actor.school && isManageableRole(next.role);
}

export function canRunSecurityAction(actor: UserManager, action: string): boolean {
  if (actor.role === 'Admin') return true;
  if (!isDataLeadWithSchool(actor)) return false;
  return (DATA_LEAD_SECURITY_ACTIONS as readonly string[]).includes(action);
}
