export function passwordPolicyError(password: string): string | null {
  if (typeof password !== 'string' || password.length < 10) {
    return 'Password must be at least 10 characters';
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must include a letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number';
  }
  return null;
}

export const PASSWORD_POLICY_HINT =
  'At least 10 characters, including a letter and a number.';
