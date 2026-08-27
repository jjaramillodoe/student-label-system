import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const client = await clientPromise;
    const db = client.db("student-label");

    // Role-based filtering
    const userRole = auth.user?.role;
    const userSchool = auth.user?.school;
    
    let studentQuery: any = {};
    let cabinetQuery: any = {};
    
    if (userRole !== 'Admin' && userSchool) {
      studentQuery.school = userSchool;
      cabinetQuery.school = userSchool;
    }

    // Get student statistics
    const totalStudents = await db.collection('students').countDocuments(studentQuery);
    // Active = not archived (regardless of status)
    const activeStudents = await db.collection('students').countDocuments({ ...studentQuery, archived: { $ne: true } });
    const archivedStudents = await db.collection('students').countDocuments({ ...studentQuery, archived: true });
    
    // Also get count of students with "Active" status specifically
    const activeStatusStudents = await db.collection('students').countDocuments({ ...studentQuery, status: 'Active', archived: { $ne: true } });
    
    // Get status breakdown
    const statusBreakdown = await db.collection('students').aggregate([
      { $match: studentQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]).toArray();

    // Get fiscal year breakdown
    const fiscalYearBreakdown = await db.collection('students').aggregate([
      { $match: studentQuery },
      { $group: { _id: "$fiscalYear", count: { $sum: 1 } } }
    ]).toArray();

    // Get cabinet statistics
    const totalCabinets = await db.collection('cabinets').countDocuments(cabinetQuery);
    const cabinets = await db.collection('cabinets').find(cabinetQuery).toArray();
    const totalCapacity = cabinets.reduce((sum, c) => sum + (c.totalCapacity || 0), 0);
    const totalUsed = cabinets.reduce((sum, c) => sum + (c.currentCount || 0), 0);
    const utilizationPercent = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

    // Get recent print statistics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let printQuery: any = { time: { $gte: thirtyDaysAgo.toISOString() } };
    if (userRole !== 'Admin' && userSchool) {
      printQuery['user.school'] = userSchool;
    }
    
    const recentPrints = await db.collection('print_history').countDocuments(printQuery);
    const recentPrintLabels = await db.collection('print_history').aggregate([
      { $match: printQuery },
      { $group: { _id: null, total: { $sum: "$labelCount" } } }
    ]).toArray();
    const totalRecentLabels = recentPrintLabels[0]?.total || 0;

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let activityQuery: any = { time: { $gte: sevenDaysAgo.toISOString() } };
    if (userRole !== 'Admin' && userSchool) {
      activityQuery['user.school'] = userSchool;
    }
    
    const recentActivity = await db.collection('audit_logs').countDocuments(activityQuery);

    // Get students added this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const newStudentsThisMonth = await db.collection('students').countDocuments({
      ...studentQuery,
      createdAt: { $gte: thisMonth.toISOString() }
    });

    return NextResponse.json({
      students: {
        total: totalStudents,
        active: activeStudents, // Not archived
        archived: archivedStudents,
        activeStatus: activeStatusStudents, // Status = 'Active' and not archived
        newThisMonth: newStudentsThisMonth,
        statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count })),
        fiscalYearBreakdown: fiscalYearBreakdown.map(f => ({ fiscalYear: f._id, count: f.count }))
      },
      cabinets: {
        total: totalCabinets,
        totalCapacity,
        totalUsed,
        utilizationPercent,
        available: totalCapacity - totalUsed
      },
      printing: {
        recentPrints: recentPrints,
        recentLabels: totalRecentLabels,
        last30Days: recentPrints
      },
      activity: {
        recentActivity,
        last7Days: recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}

