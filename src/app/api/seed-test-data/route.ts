import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isAllowedAdminUser } from '@/lib/allowedUsers';
import { escapeRegex } from '@/lib/studentSearch';
import { destructiveHttpGuard } from '@/lib/destructiveHttp';
import { requireSession } from '@/lib/requireSession';

// Sample first and last names for generating test data
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Javier', 'Maria', 'Carlos', 'Ana', 'Juan', 'Carmen', 'Miguel', 'Isabel',
  'Luis', 'Rosa', 'Diego', 'Elena', 'Fernando', 'Lucia', 'Alejandro', 'Sofia'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez',
  'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
  'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Jaramillo', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera'
];

const STATUSES = ['Active', 'Inactive', 'Graduated', 'Withdrawn', 'Pending', 'Transferred'];
const FISCAL_YEARS = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];

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

    // Only allow specific admin users to seed test data
    const userRole = auth.user.role;
    const userEmail = auth.user.email;
    if (!isAllowedAdminUser(userEmail, userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden: Only authorized admin users can seed test data' 
      }, { status: 403 });
    }

    const body = await req.json();
    const count = body.count || 50; // Default to 50 students
    const userSchool = auth.user.school;

    if (count > 500) {
      return NextResponse.json({ error: 'Maximum 500 students allowed' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("student-label");
    const configuredSchool = await db.collection('school_config')
      .findOne({ active: true }, { projection: { name: 1 }, sort: { name: 1 } });
    const school = body.school || userSchool || configuredSchool?.name || 'School 1';

    // Get existing cabinets for assignment
    // Admins can seed for any school, others are restricted to their school
    const cabinetQuery = userRole === 'Admin' && body.school 
      ? { school } 
      : userSchool 
        ? { school: userSchool }
        : { school };
    const cabinets = await db.collection('cabinets').find(cabinetQuery).toArray();
    if (cabinets.length === 0) {
      return NextResponse.json({ 
        error: 'No cabinets found. Please create cabinets first before seeding students.' 
      }, { status: 400 });
    }

    // Get all drawers from cabinets
    const allDrawers: { cabinetId: string; drawerId: string; capacity: number; currentCount: number }[] = [];
    cabinets.forEach(cabinet => {
      if (cabinet.drawers && Array.isArray(cabinet.drawers)) {
        cabinet.drawers.forEach((drawer: any) => {
          allDrawers.push({
            cabinetId: cabinet._id.toString(),
            drawerId: drawer._id?.toString() || new ObjectId().toString(),
            capacity: drawer.capacity || 100,
            currentCount: drawer.currentCount || 0
          });
        });
      }
    });

    if (allDrawers.length === 0) {
      return NextResponse.json({ 
        error: 'No drawers found in cabinets. Please add drawers to cabinets first.' 
      }, { status: 400 });
    }

    // Generate test students
    const students = [];
    const yearCounters: Record<string, Record<string, number>> = {};

    for (let i = 0; i < count; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const birthYear = String(2000 + Math.floor(Math.random() * 20)); // Years 2000-2019
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
        existing.forEach(s => {
          const match = s.studentId?.match(/-(\d{7})$/);
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
      
      // Randomly assign cabinet and drawer
      const drawer = allDrawers[Math.floor(Math.random() * allDrawers.length)];
      
      // Generate email (optional, 70% chance)
      const email = Math.random() > 0.3 
        ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`
        : null;

      students.push({
        firstName,
        lastName,
        dob,
        fiscalYear,
        status,
        startDate,
        endDate: status === 'Graduated' || status === 'Withdrawn' ? randomDate(2023, 2024) : null,
        cabinet: drawer.cabinetId,
        drawer: drawer.drawerId,
        studentId,
        email,
        archived: status === 'Graduated' || status === 'Withdrawn' ? Math.random() > 0.5 : false,
        school,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Insert students
    const result = await db.collection('students').insertMany(students);

    // Update cabinet and drawer counts
    const drawerCounts: Record<string, number> = {};
    students.forEach(student => {
      const key = `${student.cabinet}-${student.drawer}`;
      drawerCounts[key] = (drawerCounts[key] || 0) + 1;
    });

    // Update drawer counts
    for (const [key, count] of Object.entries(drawerCounts)) {
      const [cabinetId, drawerId] = key.split('-');
      // Drawer IDs are stored as strings, not ObjectIds
      await db.collection('cabinets').updateOne(
        { 
          _id: new ObjectId(cabinetId),
          'drawers._id': drawerId
        },
        { 
          $inc: { 
            'drawers.$.currentCount': count,
            currentCount: count
          }
        }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully created ${result.insertedCount} test students`,
      count: result.insertedCount
    });

  } catch (error: any) {
    console.error('Error seeding test data:', error);
    return NextResponse.json({ 
      error: 'Failed to seed test data', 
      details: error.message 
    }, { status: 500 });
  }
}

