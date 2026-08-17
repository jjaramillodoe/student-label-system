import { generateSecret, generateURI, verify } from 'otplib';

const MFA_ISSUER = 'Student Label System';

export function generateMfaSecret() {
  return generateSecret();
}

export function getMfaKeyUri(email: string, secret: string) {
  return generateURI({
    issuer: MFA_ISSUER,
    label: email,
    secret,
  });
}

export async function verifyMfaToken(token: string, secret: string) {
  const result = await verify({
    token,
    secret,
    epochTolerance: 30,
  });

  return result.valid;
}

/** Password-login MFA policy. Admin `mfaBypass` skips the challenge for testing/QA. */
export function credentialsMfaMode(user: {
  mfaBypass?: boolean;
  mfaEnabled?: boolean;
  mfaSecret?: string;
}): 'bypass' | 'challenge' | 'enroll' {
  if (user.mfaBypass) return 'bypass';
  if (user.mfaEnabled && user.mfaSecret) return 'challenge';
  return 'enroll';
}
