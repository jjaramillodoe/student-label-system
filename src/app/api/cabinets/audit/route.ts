import { NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const auth = await requireAdminOrDataLead('Forbidden: Admin or Data Lead access required');
    if (!auth.ok) return auth.response;
    const userRole = auth.user.role;
    const userSchool = auth.user.school;
    
    const client = await clientPromise;
    const db = client.db('student-label');
    
    // Filter cabinets based on user role and school
    let cabinetQuery = {};
    
    // Admins can audit all cabinets, others are restricted to their school
    if (userRole !== 'Admin' && userSchool) {
      cabinetQuery = { school: userSchool };
    }
    
    const students = await db.collection('students').find({}).toArray();
    const cabinets = await db.collection('cabinets').find(cabinetQuery).toArray();
    const cabinetIds = new Set(cabinets.map(c => c._id.toString()));
    const drawerIds = new Set(cabinets.flatMap(c => (c.drawers as any[]).map((d: any) => d._id)));

    const invalid = students.filter(s => {
      if (!s.cabinet || !s.drawer) return true;
      if (!cabinetIds.has(s.cabinet)) return true;
      if (!drawerIds.has(s.drawer)) return true;
      return false;
    });
    return NextResponse.json({ invalid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to audit students' }, { status: 500 });
  }
} 