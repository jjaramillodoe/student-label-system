import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { generateStudentId, resolveAgencyId } from '@/lib/studentId';
import { destructiveHttpGuard } from '@/lib/destructiveHttp';
import { requireAdmin } from '@/lib/requireSession';

/**
 * POST /api/admin/migrate-student-ids
 *
 * Backfills labelId, studentId, and agencyId for all existing student records
 * that pre-date the two-ID schema.
 *
 * Migration rules per student:
 *   - If labelId is missing → copy current studentId value into labelId
 *   - Resolve agencyId from school_config (or DEFAULT_AGENCY_IDS fallback)
 *   - Generate new studentId = {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS}
 *
 * Safe to run multiple times — only touches records where labelId is absent.
 * Admin-only.
 */
export async function POST() {
  try {
    const blocked = destructiveHttpGuard();
    if (blocked) return blocked;

    const auth = await requireAdmin('Admin access required');
    if (!auth.ok) return auth.response;

    const client = await clientPromise;
    const db = client.db('student-label');

    // Load all school configs once so we don't hit DB per-student
    const schoolDocs = await db.collection('school_config').find({}).toArray();
    const schoolAgencyMap: Record<string, string> = {};
    for (const s of schoolDocs) {
      if (s.name) schoolAgencyMap[s.name.toLowerCase()] = s.agencyId || '';
    }

    // Only fetch students that still need migration (labelId absent)
    const students = await db
      .collection('students')
      .find({ labelId: { $exists: false } })
      .toArray();

    if (students.length === 0) {
      return NextResponse.json({ updated: 0, message: 'All records already migrated.' });
    }

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        const {
          _id,
          studentId: oldStudentId,
          firstName,
          lastName,
          dob,
          school,
        } = student;

        if (!firstName || !lastName || !dob) {
          skipped++;
          continue;
        }

        // Resolve agency ID for this student's school
        const storedAgency = school ? (schoolAgencyMap[school.toLowerCase()] || '') : '';
        const agencyId = resolveAgencyId(school || '', storedAgency);

        // labelId = old studentId value (the barcode format 1979-EC-xxxxxxx)
        const labelId = oldStudentId || '';

        // New demographic studentId
        const newStudentId = generateStudentId(firstName, lastName, agencyId, dob);

        await db.collection('students').updateOne(
          { _id },
          {
            $set: {
              labelId,
              studentId: newStudentId,
              agencyId,
            },
          },
        );
        updated++;
      } catch (err) {
        errors.push(`${student._id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      updated,
      skipped,
      errors: errors.length ? errors : undefined,
      message: `Migration complete. ${updated} records updated${skipped ? `, ${skipped} skipped (missing name/dob)` : ''}.`,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
