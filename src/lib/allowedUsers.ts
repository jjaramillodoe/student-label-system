/**
 * List of allowed users who can access admin seeding/clearing features
 * These users must also be Admins to access these features
 */
export const ALLOWED_ADMIN_USERS = [
  'jjaramillo7@schools.nyc.gov',
  // Add more allowed user emails here as needed
];

/**
 * Check if a user is allowed to access admin seeding/clearing features
 * User must be an Admin AND in the allowed users list
 */
export function isAllowedAdminUser(email?: string | null, role?: string | null): boolean {
  if (!email || role !== 'Admin') {
    return false;
  }
  return ALLOWED_ADMIN_USERS.includes(email.toLowerCase());
}

