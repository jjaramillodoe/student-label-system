import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { isAllowedAdminUser } from '@/lib/allowedUsers';
import { destructiveHttpGuard } from '@/lib/destructiveHttp';
import { requireSession } from '@/lib/requireSession';

export async function POST(req: NextRequest) {
  try {
    const blocked = destructiveHttpGuard();
    if (blocked) return blocked;

    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const userRole = auth.user.role;
    const userEmail = auth.user.email;

    // Only allow specific admin users to clear all data
    if (!isAllowedAdminUser(userEmail, userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden: Only authorized admin users can clear all data' 
      }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");

    // Delete all data from collections
    const results = {
      students: 0,
      cabinets: 0,
      printHistory: 0,
      auditLogs: 0,
    };

    // Delete all students
    const studentsResult = await db.collection('students').deleteMany({});
    results.students = studentsResult.deletedCount;

    // Delete all cabinets (this will also remove drawers as they're nested)
    const cabinetsResult = await db.collection('cabinets').deleteMany({});
    results.cabinets = cabinetsResult.deletedCount;

    // Delete all print history
    const printHistoryResult = await db.collection('print-history').deleteMany({});
    results.printHistory = printHistoryResult.deletedCount;

    // Delete all audit logs
    const auditLogsResult = await db.collection('audit-logs').deleteMany({});
    results.auditLogs = auditLogsResult.deletedCount;

    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared all data. Deleted ${results.students} students, ${results.cabinets} cabinets, ${results.printHistory} print history records, and ${results.auditLogs} audit log entries.`,
      results
    });

  } catch (error: any) {
    console.error('Error clearing all data:', error);
    return NextResponse.json({ 
      error: 'Failed to clear all data', 
      details: error.message 
    }, { status: 500 });
  }
}

