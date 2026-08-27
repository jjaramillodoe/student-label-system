import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireSession';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import clientPromise from '@/lib/mongodb';
import { DEFAULT_INTAKE_SESSIONS } from '@/lib/intakeDefaults';
import { intakeSessionNames, normalizeIntakeSessions } from '@/lib/intakeSession';
import { logAuthEvent } from '@/lib/authSecurity';

const VALID_ROLES = new Set(['Admin', 'Data Lead', 'Data Member', 'Intake Member']);

export type BulkUserRow = {
  name?: string;
  email?: string;
  role?: string;
  school?: string;
  password?: string;
  /** Semicolon / pipe / comma separated session names for Intake Members */
  intakeSessions?: string | string[];
  allowedIntakeSessions?: string | string[];
};

function normalizeRole(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower === 'admin') return 'Admin';
  if (lower === 'data lead' || lower === 'datalead') return 'Data Lead';
  if (lower === 'data member' || lower === 'datamember') return 'Data Member';
  if (lower === 'intake member' || lower === 'intakemember') return 'Intake Member';
  return t;
}

function parseSessionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .split(/[;|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function generateTempPassword(): string {
  // Easy to read aloud / type once: 12 chars, no ambiguous symbols
  return randomBytes(9).toString('base64url').slice(0, 12);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let rows: BulkUserRow[] = [];
  try {
    const body = await req.json();
    rows = Array.isArray(body.users) ? body.users : Array.isArray(body) ? body : [];
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!rows.length) {
    return NextResponse.json({ error: 'No users provided' }, { status: 400 });
  }
  if (rows.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 users per upload' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('student-label');

    const schoolDocs = await db
      .collection('school_config')
      .find({ active: { $ne: false } })
      .project({ name: 1, intakeSessions: 1 })
      .toArray();
    const schoolByName = new Map(
      schoolDocs.map((s) => [String(s.name).trim().toLowerCase(), s]),
    );

    const existingEmails = new Set(
      (
        await db
          .collection('users')
          .find({}, { projection: { email: 1 } })
          .toArray()
      ).map((u) => String(u.email || '').toLowerCase()),
    );

    const created: Array<{
      name: string;
      email: string;
      role: string;
      school: string;
      temporaryPassword: string;
      passwordGenerated: boolean;
    }> = [];
    const skipped: Array<{ row: number; email: string; reason: string }> = [];
    const errors: Array<{ row: number; email: string; reason: string }> = [];
    const seenInFile = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const raw = rows[i] || {};
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      const email = typeof raw.email === 'string' ? raw.email.toLowerCase().trim() : '';
      const role = normalizeRole(typeof raw.role === 'string' ? raw.role : '');
      const schoolRaw = typeof raw.school === 'string' ? raw.school.trim() : '';
      const passwordProvided =
        typeof raw.password === 'string' && raw.password.trim().length > 0
          ? raw.password.trim()
          : '';

      if (!name || !email || !role || !schoolRaw) {
        errors.push({
          row: rowNum,
          email: email || '(missing)',
          reason: 'name, email, role, and school are required',
        });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNum, email, reason: 'Invalid email' });
        continue;
      }
      if (!VALID_ROLES.has(role)) {
        errors.push({
          row: rowNum,
          email,
          reason: `Invalid role "${role}". Use Admin, Data Lead, Data Member, or Intake Member`,
        });
        continue;
      }
      if (seenInFile.has(email)) {
        skipped.push({ row: rowNum, email, reason: 'Duplicate email in this file' });
        continue;
      }
      seenInFile.add(email);
      if (existingEmails.has(email)) {
        skipped.push({ row: rowNum, email, reason: 'User already exists' });
        continue;
      }

      const schoolDoc = schoolByName.get(schoolRaw.toLowerCase());
      const school = schoolDoc?.name ? String(schoolDoc.name) : schoolRaw;

      let allowedIntakeSessions: string[] = [];
      if (role === 'Intake Member') {
        const fromRow = parseSessionList(raw.intakeSessions ?? raw.allowedIntakeSessions);
        if (fromRow.length) {
          allowedIntakeSessions = fromRow;
        } else {
          const schoolSessions = normalizeIntakeSessions(schoolDoc?.intakeSessions);
          allowedIntakeSessions = schoolSessions.length
            ? intakeSessionNames(schoolSessions)
            : [...DEFAULT_INTAKE_SESSIONS];
        }
        if (!allowedIntakeSessions.length) {
          errors.push({
            row: rowNum,
            email,
            reason: 'Intake Member needs at least one intake session',
          });
          continue;
        }
      }

      const passwordGenerated = !passwordProvided;
      const plainPassword = passwordProvided || generateTempPassword();
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const now = new Date().toISOString();

      await db.collection('users').insertOne({
        name,
        email,
        role,
        school,
        allowedIntakeSessions,
        password: hashedPassword,
        forcePasswordChange: true,
        createdAt: now,
        lastLogin: null,
      });

      await logAuthEvent({
        type: 'user_created',
        email,
        reason: 'Bulk upload created user',
        meta: {
          role,
          school,
          byEmail: auth.user?.email || '',
          byName: auth.user?.name || '',
        },
        suppressAlert: true,
      });

      existingEmails.add(email);
      created.push({
        name,
        email,
        role,
        school,
        temporaryPassword: plainPassword,
        passwordGenerated,
      });
    }

    if (created.length > 0) {
      await logAuthEvent({
        type: 'user_created',
        email: auth.user?.email || 'bulk-upload',
        reason: `Bulk upload created ${created.length} user(s)`,
        meta: {
          bulkCount: created.length,
          byEmail: auth.user?.email || '',
          byName: auth.user?.name || '',
          emails: created.map((c) => c.email).slice(0, 40),
        },
      });
    }

    return NextResponse.json({
      created,
      skipped,
      errors,
      summary: {
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
      },
    });
  } catch (err) {
    console.error('[users/bulk-upload]', err);
    return NextResponse.json({ error: 'Failed to bulk upload users' }, { status: 500 });
  }
}
