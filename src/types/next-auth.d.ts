import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role?: string;
    school?: string;
    forcePasswordChange?: boolean;
    /** Credentials login without MFA enrolled — must set up TOTP on Profile */
    forceMfaSetup?: boolean;
  }

  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      school?: string;
      forcePasswordChange?: boolean;
      forceMfaSetup?: boolean;
      /** Set while a Data Member is acting as Data Lead (YYYY-MM-DD, last day). */
      actingDataLeadUntil?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    /** The role stored on the user; `role` may be raised by a delegation. */
    baseRole?: string;
    actingDataLeadUntil?: string | null;
    school?: string;
    forcePasswordChange?: boolean;
    forceMfaSetup?: boolean;
  }
}
