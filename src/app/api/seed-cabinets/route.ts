import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isAllowedAdminUser } from '@/lib/allowedUsers';
import { escapeRegex } from '@/lib/studentSearch';
import { destructiveHttpGuard } from '@/lib/destructiveHttp';
import { requireSession } from '@/lib/requireSession';

const CABINET_NAMES = ['Main Cabinet', 'Storage Cabinet', 'Archive Cabinet', 'Records Cabinet', 'Files Cabinet'];
const DRAWER_NAMES = ['Drawer A', 'Drawer B', 'Drawer C', 'Drawer D', 'Drawer E'];

// Sample first and last names for generating test students
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez'
];

const STATUSES = ['Active', 'Inactive', 'Pending'];
const FISCAL_YEARS = ['2024-2025', '2025-2026', '2026-2027'];

// Generate a random date between two years
function randomDate(startYear: number, endYear: number): string {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

// Generate student ID
function generateStudentId(birthYear: string, firstName: string, lastName: string, counter: number): string {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  return `${birthYear}-${initials}-${String(counter).padStart(7, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const blocked = destructiveHttpGuard();
    if (blocked) return blocked;

    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    // Only allow specific admin users to seed cabinets
    const userRole = auth.user.role;
    const userEmail = auth.user.email;
    if (!isAllowedAdminUser(userEmail, userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden: Only authorized admin users can seed cabinets' 
      }, { status: 403 });
    }

    const body = await req.json();
    const userSchool = auth.user.school;
    const cabinetsPerSchool = body.cabinetsPerSchool ?? 2; // Default 2 cabinets per school
    const drawersPerCabinet = body.drawersPerCabinet ?? 5; // Default 5 drawers per cabinet
    const drawerCapacity = body.drawerCapacity ?? 100; // Default 100 per drawer
    const studentsPerCabinet = body.studentsPerCabinet ?? 10; // Default 10 students per cabinet
    const utilizationThreshold = body.utilizationThreshold ?? 80; // Only create if utilization > 80%
    const client = await clientPromise;
    const db = client.db("student-label");
    const configuredSchools = await db.collection('school_config')
      .find({ active: true }, { projection: { name: 1 } })
      .sort({ name: 1 })
      .toArray();
    const fallbackSchools = configuredSchools.map((school: any) => school.name).filter(Boolean);
    const schools = body.school
      ? [body.school]
      : Array.isArray(body.schools) && body.schools.length > 0
        ? body.schools
        : userSchool
          ? [userSchool]
          : fallbackSchools.length > 0
            ? fallbackSchools
            : ['School 1'];

    const results = {
      cabinetsCreated: 0,
      studentsCreated: 0,
      schools: [] as any[],
      errors: [] as string[]
    };

    // Process each school
    for (const school of schools) {
      try {
        // Check current utilization for this school
        const existingCabinets = await db.collection('cabinets').find({ school }).toArray();
        let totalCapacity = 0;
        let totalUsed = 0;

        existingCabinets.forEach(cabinet => {
          totalCapacity += cabinet.totalCapacity || 0;
          totalUsed += cabinet.currentCount || 0;
        });

        const currentUtilization = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;

        // Only create cabinets if utilization is above threshold or no cabinets exist
        if (existingCabinets.length > 0 && currentUtilization < utilizationThreshold) {
          results.schools.push({
            school,
            action: 'skipped',
            reason: `Utilization is ${currentUtilization.toFixed(1)}% (below ${utilizationThreshold}% threshold)`,
            utilization: currentUtilization
          });
          continue;
        }

        // Count existing cabinets for this school to generate unique identifiers
        const existingCabinetCount = existingCabinets.length;
        const schoolResults = {
          school,
          cabinetsCreated: 0,
          studentsCreated: 0,
          cabinets: [] as any[]
        };

        // Create cabinets for this school
        for (let i = 0; i < cabinetsPerSchool; i++) {
          const cabinetName = CABINET_NAMES[i % CABINET_NAMES.length];
          const cabinetNumber = existingCabinetCount + i + 1;
          const identifier = existingCabinetCount + i > 0 ? String.fromCharCode(65 + (existingCabinetCount + i) % 26) : null;

          // Create drawers
          const drawers = [];
          for (let j = 0; j < drawersPerCabinet; j++) {
            drawers.push({
              _id: new ObjectId().toString(),
              name: DRAWER_NAMES[j % DRAWER_NAMES.length],
              capacity: drawerCapacity,
              currentCount: 0
            });
          }

          const totalCapacity = drawersPerCabinet * drawerCapacity;

          // Create cabinet
          const cabinet = {
            name: cabinetName,
            identifier: identifier,
            school,
            drawers,
            totalCapacity,
            currentCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const cabinetResult = await db.collection('cabinets').insertOne(cabinet);
          const cabinetId = cabinetResult.insertedId.toString();
          schoolResults.cabinetsCreated++;
          results.cabinetsCreated++;

          // Create students and assign them to this cabinet
          const studentsToCreate = Math.min(studentsPerCabinet, totalCapacity);
          const studentsPerDrawer = Math.floor(studentsToCreate / drawersPerCabinet);
          const remainder = studentsToCreate % drawersPerCabinet;

          const students = [];
          const yearCounters: Record<string, Record<string, number>> = {};

          for (let drawerIndex = 0; drawerIndex < drawersPerCabinet; drawerIndex++) {
            const drawer = drawers[drawerIndex];
            const studentsInThisDrawer = studentsPerDrawer + (drawerIndex < remainder ? 1 : 0);

            for (let s = 0; s < studentsInThisDrawer; s++) {
              const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
              const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
              const birthYear = String(2000 + Math.floor(Math.random() * 20));
              const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();

              // Track counters per year and initials
              if (!yearCounters[birthYear]) {
                yearCounters[birthYear] = {};
              }
              if (!yearCounters[birthYear][initials]) {
                // Check existing students with same year and initials
                const existing = await db.collection('students').find({
                  studentId: { $regex: `^${escapeRegex(birthYear)}-${escapeRegex(initials)}-` }
                }).toArray();

                let maxNum = 0;
                existing.forEach(st => {
                  const match = st.studentId?.match(/-(\d{7})$/);
                  if (match) {
                    const num = parseInt(match[1], 10);
                    maxNum = Math.max(maxNum, num);
                  }
                });
                yearCounters[birthYear][initials] = maxNum;
              }

              yearCounters[birthYear][initials]++;
              const studentId = generateStudentId(birthYear, firstName, lastName, yearCounters[birthYear][initials]);

              const dob = randomDate(parseInt(birthYear), parseInt(birthYear));
              const fiscalYear = FISCAL_YEARS[Math.floor(Math.random() * FISCAL_YEARS.length)];
              const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
              const startDate = randomDate(2020, 2024);
              const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`;

              students.push({
                firstName,
                lastName,
                dob,
                fiscalYear,
                status,
                startDate,
                endDate: null,
                cabinet: cabinetId,
                drawer: drawer._id,
                studentId,
                email,
                archived: false,
                school,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }

          // Insert students
          if (students.length > 0) {
            const studentsResult = await db.collection('students').insertMany(students);
            schoolResults.studentsCreated += studentsResult.insertedCount;
            results.studentsCreated += studentsResult.insertedCount;

            // Update drawer and cabinet counts
            for (const drawer of drawers) {
              const studentsInDrawer = students.filter(s => s.drawer === drawer._id).length;
              if (studentsInDrawer > 0) {
                await db.collection('cabinets').updateOne(
                  {
                    _id: new ObjectId(cabinetId),
                    'drawers._id': drawer._id
                  },
                  {
                    $inc: {
                      'drawers.$.currentCount': studentsInDrawer,
                      currentCount: studentsInDrawer
                    }
                  }
                );
              }
            }
          }

          schoolResults.cabinets.push({
            name: cabinetName,
            identifier,
            studentsCreated: students.filter(s => s.cabinet === cabinetId).length
          });
        }

        results.schools.push(schoolResults);
      } catch (error: any) {
        results.errors.push(`Error processing ${school}: ${error.message}`);
        console.error(`Error processing school ${school}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${results.cabinetsCreated} cabinets and ${results.studentsCreated} students across ${schools.length} school${schools.length === 1 ? '' : 's'}`,
      results
    });

  } catch (error: any) {
    console.error('Error seeding cabinets:', error);
    return NextResponse.json({
      error: 'Failed to seed cabinets',
      details: error.message
    }, { status: 500 });
  }
}

