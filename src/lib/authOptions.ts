import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import clientPromise from './mongodb';
import * as bcrypt from 'bcrypt';
import { credentialsMfaMode, verifyMfaToken } from './mfa';
import {
  clearCredentialFailures,
  isAccountLocked,
  logAuthEvent,
  recordCredentialFailure,
} from './authSecurity';

type DbUser = {
  _id: unknown;
  email: string;
  password?: string;
  name: string;
  role: string;
  school: string;
  lastLogin?: string;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  mfaBypass?: boolean;
  forcePasswordChange?: boolean;
  failedLoginCount?: number;
  lockedUntil?: string | null;
};

/** Password sessions last 12 hours (idle timeout still signs out earlier on shared desks). */
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function isAzureAdConfigured(): boolean {
  return Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID,
  );
}

function isAllowedSsoEmail(email: string): boolean {
  if (process.env.AZURE_AD_ALLOW_ANY_DOMAIN === 'true') return true;
  const allowed = (process.env.AZURE_AD_ALLOWED_DOMAINS || 'schools.nyc.gov')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return allowed.includes(domain);
}

async function loadDbUserByEmail(email: string): Promise<DbUser | null> {
  const client = await clientPromise;
  const db = client.db('student-label');
  return db.collection('users').findOne<DbUser>({ email: email.toLowerCase() });
}

async function touchLastLogin(userId: unknown) {
  const client = await clientPromise;
  const db = client.db('student-label');
  await db.collection('users').updateOne(
    { _id: userId as never },
    { $set: { lastLogin: new Date().toISOString() } },
  );
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'user@schools.nyc.gov' },
      password: { label: 'Password', type: 'password' },
      mfaCode: { label: 'MFA Code', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }
      const email = credentials.email.toLowerCase();
      const user = await loadDbUserByEmail(email);
      if (!user || !user.password) {
        await logAuthEvent({
          type: 'user_unknown',
          email,
          reason: 'Unknown email or account has no password login',
        });
        return null;
      }

      if (isAccountLocked(user)) {
        await logAuthEvent({
          type: 'login_failure',
          email,
          reason: 'Account temporarily locked',
          meta: { lockedUntil: user.lockedUntil || null },
        });
        throw new Error('ACCOUNT_LOCKED');
      }

      const isValid = await bcrypt.compare(credentials.password, user.password);
      if (!isValid) {
        const result = await recordCredentialFailure(user._id, email);
        await logAuthEvent({
          type: 'login_failure',
          email,
          reason: result.locked
            ? 'Invalid password — account locked'
            : 'Invalid password',
          meta: { failedLoginCount: result.failedLoginCount },
        });
        if (result.locked) throw new Error('ACCOUNT_LOCKED');
        return null;
      }

      let forceMfaSetup = false;
      const mfaMode = credentialsMfaMode(user);

      if (mfaMode === 'challenge') {
        const rawMfaCode = credentials.mfaCode?.trim();
        const mfaCode = rawMfaCode && rawMfaCode !== 'undefined' ? rawMfaCode : '';

        if (!mfaCode) {
          throw new Error('MFA_REQUIRED');
        }

        if (!(await verifyMfaToken(mfaCode, user.mfaSecret!))) {
          const result = await recordCredentialFailure(user._id, email);
          await logAuthEvent({
            type: 'mfa_failure',
            email,
            reason: result.locked
              ? 'Invalid MFA code — account locked'
              : 'Invalid MFA code',
            meta: { failedLoginCount: result.failedLoginCount },
          });
          if (result.locked) throw new Error('ACCOUNT_LOCKED');
          throw new Error('MFA_INVALID');
        }
      } else if (mfaMode === 'enroll') {
        if (user.mfaEnabled && !user.mfaSecret) {
          const client = await clientPromise;
          const db = client.db('student-label');
          await db.collection('users').updateOne(
            { _id: user._id as never },
            {
              $set: {
                mfaEnabled: false,
                updatedAt: new Date().toISOString(),
              },
              $unset: {
                mfaPendingSecret: '',
              },
            },
          );
        }
        // Credentials login requires MFA enrollment (DOE password accounts)
        forceMfaSetup = true;
      }

      await clearCredentialFailures(user._id);
      await touchLastLogin(user._id);
      await logAuthEvent({
        type: 'login_success',
        email,
        reason:
          mfaMode === 'bypass'
            ? 'Signed in — MFA bypassed (admin exemption)'
            : forceMfaSetup
              ? 'Signed in — MFA enrollment required'
              : 'Signed in',
        meta: { forceMfaSetup, mfaBypass: mfaMode === 'bypass' },
      });

      return {
        id: String(user._id),
        name: user.name || email,
        email,
        role: user.role || 'Data Member',
        school: user.school || '',
        forcePasswordChange: Boolean(user.forcePasswordChange),
        forceMfaSetup,
      };
    },
  }),
];

if (isAzureAdConfigured()) {
  providers.push(
    AzureADProvider({
      id: 'azure-ad',
      name: 'Microsoft (DOE)',
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: { scope: 'openid profile email User.Read' },
      },
    }),
  );
}

/** Share session across school1.domain.org and domain.org when set (e.g. .nycadultedlabels.nyc). */
function authCookieOptions() {
  const domain = (process.env.NEXTAUTH_COOKIE_DOMAIN || '').trim();
  if (!domain) return undefined;
  const useSecure = process.env.NODE_ENV === 'production' || domain.startsWith('.');
  return {
    sessionToken: {
      name: useSecure
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecure,
        domain,
      },
    },
    callbackUrl: {
      name: useSecure
        ? '__Secure-next-auth.callback-url'
        : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecure,
        domain,
      },
    },
    csrfToken: {
      name: useSecure
        ? '__Host-next-auth.csrf-token'
        : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: useSecure,
        // __Host- cookies cannot set Domain — fall back to non-host prefix when sharing
        ...(useSecure
          ? {}
          : { domain }),
      },
    },
  };
}

const cookieOpts = authCookieOptions();

export const authOptions: NextAuthOptions = {
  providers,
  ...(cookieOpts
    ? {
        cookies: {
          sessionToken: cookieOpts.sessionToken,
          callbackUrl: cookieOpts.callbackUrl,
          // Prefer non-__Host csrf so Domain can be shared across subdomains
          csrfToken: {
            name: 'next-auth.csrf-token',
            options: {
              httpOnly: true,
              sameSite: 'lax' as const,
              path: '/',
              secure: process.env.NODE_ENV === 'production',
              domain: (process.env.NEXTAUTH_COOKIE_DOMAIN || '').trim() || undefined,
            },
          },
        },
      }
    : {}),
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'azure-ad') return true;

      const email = (user.email || '').toLowerCase();
      if (!email) return '/auth/error?error=EmailRequired';
      if (!isAllowedSsoEmail(email)) return '/auth/error?error=DomainNotAllowed';

      const dbUser = await loadDbUserByEmail(email);
      if (!dbUser) return '/auth/error?error=UserNotProvisioned';

      await touchLastLogin(dbUser._id);
      await logAuthEvent({
        type: 'login_success',
        email,
        reason: 'Microsoft SSO sign-in',
        meta: { provider: 'azure-ad' },
      });
      user.id = String(dbUser._id);
      user.name = dbUser.name || user.name || email;
      user.role = dbUser.role || 'Data Member';
      user.school = dbUser.school || '';
      user.forcePasswordChange = false;
      // DOE Azure Conditional Access covers SSO — do not force app TOTP
      user.forceMfaSetup = false;
      return true;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.role = token.role as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.school = token.school as string;
        session.user.forcePasswordChange = Boolean(token.forcePasswordChange);
        session.user.forceMfaSetup = Boolean(token.forceMfaSetup);
      }
      return session;
    },
    async jwt({ token, user, account, trigger, session }) {
      const updatePayload = session as {
        forcePasswordChange?: boolean;
        forceMfaSetup?: boolean;
      } | undefined;

      if (trigger === 'update' && updatePayload?.forcePasswordChange !== undefined) {
        token.forcePasswordChange = Boolean(updatePayload.forcePasswordChange);
      }
      if (trigger === 'update' && updatePayload?.forceMfaSetup !== undefined) {
        token.forceMfaSetup = Boolean(updatePayload.forceMfaSetup);
      }

      if (user) {
        token.role = user.role || 'Data Member';
        token.name = user.name;
        token.email = user.email;
        token.school = user.school || '';
        token.forcePasswordChange = Boolean(user.forcePasswordChange);
        token.forceMfaSetup = Boolean(user.forceMfaSetup);
      }

      // Only hit Mongo on Azure AD sign-in (not every credentials JWT refresh)
      if (account?.provider === 'azure-ad') {
        const email = String(token.email || user?.email || '').toLowerCase();
        if (email) {
          try {
            const dbUser = await loadDbUserByEmail(email);
            if (dbUser) {
              token.role = dbUser.role || 'Data Member';
              token.school = dbUser.school || '';
              token.name = dbUser.name || token.name;
              token.forcePasswordChange = Boolean(dbUser.forcePasswordChange);
              token.forceMfaSetup = false;
            }
          } catch (err) {
            console.error('[auth] azure-ad jwt user lookup failed', err);
          }
        }
      }

      // Keep forceMfaSetup in sync after enrollment
      if (trigger === 'update' && token.forceMfaSetup && token.email) {
        try {
          const dbUser = await loadDbUserByEmail(String(token.email).toLowerCase());
          if (dbUser?.mfaBypass || (dbUser?.mfaEnabled && dbUser.mfaSecret)) {
            token.forceMfaSetup = false;
          }
        } catch {
          /* ignore */
        }
      }

      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
