import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month, user, student

    const client = await clientPromise;
    const db = client.db("student-label");

    // Role-based filtering
    const userRole = (session.user as any)?.role;
    const userSchool = (session.user as any)?.school;
    let matchQuery: any = {
      time: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (userRole !== 'Admin' && userSchool) {
      matchQuery['user.school'] = userSchool;
    }

    let groupStage: any = {};
    let projectStage: any = {};

    switch (groupBy) {
      case 'day':
        groupStage = {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$time" } },
          count: { $sum: 1 },
          totalLabels: { $sum: "$labelCount" }
        };
        projectStage = {
          date: "$_id",
          count: 1,
          totalLabels: 1,
          _id: 0
        };
        break;
      case 'week':
        groupStage = {
          _id: { $dateToString: { format: "%Y-W%V", date: "$time" } },
          count: { $sum: 1 },
          totalLabels: { $sum: "$labelCount" }
        };
        projectStage = {
          week: "$_id",
          count: 1,
          totalLabels: 1,
          _id: 0
        };
        break;
      case 'month':
        groupStage = {
          _id: { $dateToString: { format: "%Y-%m", date: "$time" } },
          count: { $sum: 1 },
          totalLabels: { $sum: "$labelCount" }
        };
        projectStage = {
          month: "$_id",
          count: 1,
          totalLabels: 1,
          _id: 0
        };
        break;
      case 'user':
        groupStage = {
          _id: "$user.email",
          userName: { $first: "$user.name" },
          count: { $sum: 1 },
          totalLabels: { $sum: "$labelCount" }
        };
        projectStage = {
          userEmail: "$_id",
          userName: 1,
          count: 1,
          totalLabels: 1,
          _id: 0
        };
        break;
      case 'student':
        groupStage = {
          _id: "$students.studentId",
          studentName: { $first: { $concat: ["$students.firstName", " ", "$students.lastName"] } },
          count: { $sum: 1 }
        };
        projectStage = {
          studentId: "$_id",
          studentName: 1,
          count: 1,
          _id: 0
        };
        break;
    }

    let pipeline: any[] = [];
    
    if (groupBy === 'student') {
      // For student grouping, we need to unwind students first
      pipeline = [
        { $match: matchQuery },
        { $unwind: "$students" },
        { $group: groupStage },
        { $project: projectStage },
        { $sort: { count: -1 } }
      ];
    } else if (groupBy === 'user') {
      // For user grouping, no need to unwind
      pipeline = [
        { $match: matchQuery },
        { $group: groupStage },
        { $project: projectStage },
        { $sort: { count: -1 } }
      ];
    } else {
      // For date-based grouping, no need to unwind
      pipeline = [
        { $match: matchQuery },
        { $group: groupStage },
        { $project: projectStage },
        { $sort: { _id: 1 } }
      ];
    }

    const results = await db.collection('print_history').aggregate(pipeline).toArray();

    // Get summary statistics
    // Need to unwind students array to get unique student count
    const summaryPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalPrints: { $sum: 1 },
          totalLabels: { $sum: "$labelCount" },
          uniqueUsers: { $addToSet: "$user.email" },
          allStudents: { $push: "$students" }
        }
      },
      {
        $project: {
          _id: 0,
          totalPrints: 1,
          totalLabels: 1,
          uniqueUserCount: { $size: "$uniqueUsers" },
          allStudents: 1
        }
      },
      {
        $unwind: "$allStudents"
      },
      {
        $unwind: "$allStudents"
      },
      {
        $group: {
          _id: null,
          totalPrints: { $first: "$totalPrints" },
          totalLabels: { $first: "$totalLabels" },
          uniqueUserCount: { $first: "$uniqueUserCount" },
          uniqueStudents: { $addToSet: "$allStudents.studentId" }
        }
      },
      {
        $project: {
          _id: 0,
          totalPrints: 1,
          totalLabels: 1,
          uniqueUserCount: 1,
          uniqueStudentCount: { $size: "$uniqueStudents" }
        }
      }
    ];

    const summary = await db.collection('print_history').aggregate(summaryPipeline).toArray();
    
    // If no data, return default summary
    const defaultSummary = { totalPrints: 0, totalLabels: 0, uniqueStudentCount: 0, uniqueUserCount: 0 };
    const finalSummary = summary.length > 0 ? summary[0] : defaultSummary;

    return NextResponse.json({
      summary: finalSummary,
      data: results || []
    });
  } catch (error) {
    console.error('Error generating print reports:', error);
    return NextResponse.json({ error: 'Failed to generate print reports' }, { status: 500 });
  }
}

