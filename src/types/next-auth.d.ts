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
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    school?: string;
    forcePasswordChange?: boolean;
    forceMfaSetup?: boolean;
  }
}
