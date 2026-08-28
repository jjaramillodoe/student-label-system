import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { requireRole } from '@/lib/requireSession';
import { authorizeStudentAccess } from '@/lib/studentAccess';
import { fillIsrfPdf } from '@/lib/isrfPdf';
import { ISRF_ROLES, isrfDownloadFilename, studentDocToIsrfInput, todayIsrfDate } from '@/lib/isrfForm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireRole(ISRF_ROLES, 'Forbidden — Admin, Data Lead, or Data Member only');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'A valid student id is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const student = await db.collection('students').findOne({ _id: new ObjectId(id) });
    const access = authorizeStudentAccess({
      role: auth.user.role,
      userSchool: auth.user.school,
      action: 'read',
      studentExists: Boolean(student),
      studentSchool: typeof student?.school === 'string' ? student.school : null,
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const bytes = await fillIsrfPdf(studentDocToIsrfInput(student as Record<string, unknown>), {
      completedBy: auth.user.name || auth.user.email,
      signedOn: todayIsrfDate(),
    });

    const filename = isrfDownloadFilename({
      lastName: typeof student?.lastName === 'string' ? student.lastName : '',
      firstName: typeof student?.firstName === 'string' ? student.firstName : '',
      studentId: typeof student?.studentId === 'string' ? student.studentId : '',
      labelId: typeof student?.labelId === 'string' ? student.labelId : '',
    });
    const download = req.nextUrl.searchParams.get('download') === '1';

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[isrf]', error);
    return NextResponse.json({ error: 'Failed to generate ISRF PDF' }, { status: 500 });
  }
}
