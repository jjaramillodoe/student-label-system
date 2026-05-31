import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import clientPromise from './mongodb';
import * as bcrypt from 'bcrypt';
import { verifyMfaToken } from './mfa';

type User = {
  _id: any;
  email: string;
  password: string;
  name: string;
  role: string;
  school: string;
  lastLogin?: string;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  forcePasswordChange?: boolean;
};

const userRoles: Record<string, { name: string; role: 'Data Lead' | 'Data Member' | 'Admin'; school: string }> = {
  'jjaramillo7@schools.nyc.gov': { name: 'Javier Jaramillo', role: 'Admin', school: 'District 79' },
  'namachki@schools.nyc.gov': { name: 'Najat Amachki', role: 'Admin', school: 'District 79' },
  'mpowers3@schools.nyc.gov': { name: 'Michael Powers', role: 'Admin', school: 'District 79' },
  'helalaoui@schools.nyc.gov': { name: 'Hicham Elalaoui', role: 'Data Lead', school: 'School 8' },
  'dmaxell@schools.nyc.gov': { name: 'Dion Maxwell', role: 'Data Member', school: 'School 8' },
  'kboothe@schools.nyc.gov': { name: 'Kayla Boothe', role: 'Data Member', school: 'School 3' },
  'pnicholson@schools.nyc.gov': { name: 'Philicia Nicholson', role: 'Data Member', school: 'School 4' },
  'tfosterbrady@schools.nyc.gov': { name: 'Taneque Foster-Brady', role: 'Data Member', school: 'School 5' },
};

export const authOptions: NextAuthOptions = {
  providers: [
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
        const client = await clientPromise;
        const db = client.db("student-label");
        const user = await db.collection('users').findOne<User>({ email });
        if (!user || !user.password) {
          return null;
        }
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        if (user.mfaEnabled && user.mfaSecret) {
          const rawMfaCode = credentials.mfaCode?.trim();
          const mfaCode = rawMfaCode && rawMfaCode !== 'undefined' ? rawMfaCode : '';

          if (!mfaCode) {
            throw new Error('MFA_REQUIRED');
          }

          if (!(await verifyMfaToken(mfaCode, user.mfaSecret))) {
            throw new Error('MFA_INVALID');
          }
        } else if (user.mfaEnabled && !user.mfaSecret) {
          await db.collection('users').updateOne(
            { _id: user._id },
            {
              $set: {
                mfaEnabled: false,
                updatedAt: new Date().toISOString(),
              },
              $unset: {
                mfaPendingSecret: '',
              },
            }
          );
        }

        // Update lastLogin timestamp
        const now = new Date().toISOString();
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lastLogin: now } }
        );

        return {
          id: (user._id as any)?.toString?.() ?? String(user._id),
          name: user.name || userRoles[email]?.name || email,
          email,
          role: user.role || userRoles[email]?.role || 'Data Member',
          school: user.school || userRoles[email]?.school || '',
          forcePasswordChange: Boolean(user.forcePasswordChange),
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token) {
        session.user.role = token.role as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.school = token.school as string;
        session.user.forcePasswordChange = Boolean(token.forcePasswordChange);
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && (session as any)?.forcePasswordChange !== undefined) {
        token.forcePasswordChange = Boolean((session as any).forcePasswordChange);
      }
      if (user) {
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
        token.school = user.school;
        token.forcePasswordChange = user.forcePasswordChange;
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}; 