import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { buildStudentSearchOrConditions } from '@/lib/studentSearch';
import { ObjectId } from 'mongodb';
import { generateLabelId, generateStudentId, resolveAgencyId } from '@/lib/studentId';
import {
  beEslAgeErrorMessage,
  checkBeEslAgeEligibility,
  requiresBeEslAgeCheck,
} from '@/lib/beEslEligibility';
import { normalizeStudentAddress, validateStudentAddress } from '@/lib/addressValidation';
import { verifyAddressWithGeoclient } from '@/lib/addressGeoclient';
import { getSchoolIntakeSessions, validateIntakeSessionTimes } from '@/lib/intakeSession';

// Helper function to validate ObjectId
function isValidObjectId(id: string): boolean {
  try {
    new ObjectId(id);
    return true;
  } catch (error) {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;
    
    const client = await clientPromise;
    const db = client.db("student-label");
    
    // Admins can see all students, others are restricted to their school
    const query: Record<string, any> = userRole === 'Admin' ? {} : { school: userSchool };

    // Optional date filter: ?since=ISO-string
    const since = req.nextUrl.searchParams.get('since');
    if (since) {
      query.createdAt = { $gte: since };
    }

    // Optional: only return records created by the current user
    const createdByMe = req.nextUrl.searchParams.get('createdByMe');
    if (createdByMe === 'true' && session?.user?.email) {
      query['createdBy.email'] = session.user.email;
    }

    // Optional text search across name, IDs, and DOB: ?search=...
    const search = req.nextUrl.searchParams.get('search');
    if (search && search.trim()) {
      const orConditions = buildStudentSearchOrConditions(search);
      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    }

    const cursor = db.collection('students').find(query).sort({ createdAt: -1 });
    if (search && search.trim()) cursor.limit(20);
    const students = await cursor.toArray();
    return NextResponse.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    const userSchool = session?.user?.school;
    
    // Only allow Data Members and Data Leads to add students to their school
    if (userRole !== 'Admin' && !userSchool) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can add students without a school' },
        { status: 403 }
      );
    }
    
    const body = await req.json();
    const { 
      firstName, 
      lastName, 
      dob, 
      fiscalYear, 
      status, 
      startDate, 
      cabinet, 
      drawer,
      email, 
      endDate, 
      archived,
      // Intake fields
      phone,
      gender,
      program,
      notes,
      intakeStudentStatus,
      originalStartDate,
      educationStatus,
      intakeActivity,
      placementClass,
      intakeSession,
      timeIn,
      isLeaving,
      timeOut,
      otherNote,
      address,
      apt,
      city,
      state,
      zip,
      verifyAddress,
    } = body;

    if (requiresBeEslAgeCheck({ intakeStudentStatus, educationStatus }) && dob) {
      const ageCheck = checkBeEslAgeEligibility(String(dob));
      if (!ageCheck.eligible) {
        return NextResponse.json({ error: beEslAgeErrorMessage(ageCheck) }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db("student-label");

    const schoolName = body.school || userSchool || '';
    if (intakeSession && timeIn) {
      const sessions = await getSchoolIntakeSessions(db, schoolName);
      const sessionTimeError = validateIntakeSessionTimes({
        intakeSession,
        timeIn,
        timeOut,
        sessions,
      });
      if (sessionTimeError) {
        return NextResponse.json({ error: sessionTimeError }, { status: 400 });
      }
    }

    // ── Resolve agency ID for this school ────────────────────────────────────
    let agencyId = body.agencyId || '';
    if (!agencyId && schoolName) {
      const schoolDoc = await db.collection('school_config').findOne({
        name: { $regex: `^${schoolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      });
      agencyId = resolveAgencyId(schoolName, schoolDoc?.agencyId);
    }

    // ── Generate labelId (barcode printed on the physical label) ─────────────
    // Accept an explicitly provided labelId, otherwise auto-generate one.
    let labelId: string = body.labelId || '';
    if (!labelId && firstName && lastName && dob) {
      const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
      const birthYear = String(dob).split('-')[0] || String(new Date().getFullYear());
      const pattern = new RegExp(`^${birthYear}-${initials}-\\d{7}$`);
      const existing = await db
        .collection('students')
        .find({ $or: [{ labelId: { $regex: pattern } }, { studentId: { $regex: pattern } }] })
        .project({ labelId: 1, studentId: 1 })
        .toArray();
      let nextNum = 1;
      if (existing.length > 0) {
        const max = existing.reduce((acc: number, s: any) => {
          const idStr = s.labelId || s.studentId || '';
          const match = idStr.match(/-(\d{7})$/);
          return Math.max(acc, match ? parseInt(match[1], 10) : 0);
        }, 0);
        nextNum = max + 1;
      }
      labelId = generateLabelId(firstName, lastName, dob, nextNum);
    }

    // ── Generate studentId (demographic identifier) ───────────────────────────
    // Format: {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS}
    let studentId: string = body.studentId || '';
    if (!studentId && firstName && lastName && dob && agencyId) {
      studentId = generateStudentId(firstName, lastName, agencyId, dob);
    }
    
    // If cabinet and drawer are provided, update the cabinet capacity
    if (cabinet && drawer) {
      // Validate cabinet ID format
      if (!isValidObjectId(cabinet)) {
        return NextResponse.json({ 
          error: 'Invalid cabinet ID format',
          details: 'Cabinet ID must be a valid MongoDB ObjectId'
        }, { status: 400 });
      }

      const cabinetDoc = await db.collection('cabinets').findOne({ _id: new ObjectId(cabinet) });
      if (!cabinetDoc) {
        return NextResponse.json({ error: 'Cabinet not found' }, { status: 404 });
      }

      // Find the drawer in the cabinet
      const drawerIndex = cabinetDoc.drawers.findIndex((d: any) => d._id === drawer);
      if (drawerIndex === -1) {
        return NextResponse.json({ error: 'Drawer not found in cabinet' }, { status: 404 });
      }

      const drawerCapacity = cabinetDoc.drawers[drawerIndex].capacity;
      const currentCount = cabinetDoc.drawers[drawerIndex].currentCount || 0;

      if (currentCount >= drawerCapacity) {
        return NextResponse.json({ error: 'Drawer is at full capacity' }, { status: 400 });
      }

      // Update the drawer's current count
      await db.collection('cabinets').updateOne(
        { 
          _id: new ObjectId(cabinet),
          'drawers._id': drawer
        },
        { 
          $inc: { 
            'drawers.$.currentCount': 1,
            'currentCount': 1
          }
        }
      );
    }
    
    const studentData: Record<string, any> = {
      firstName,
      lastName,
      dob,
      fiscalYear,
      status,
      startDate,
      cabinet,
      drawer,
      email: email || null,
      labelId,     // barcode printed on the physical label
      studentId,   // demographic ID: {LASTNAME}{FIRSTNAME}{AGENCYID}{DOBDIGITS}
      agencyId,    // e.g. R01
      endDate: endDate || null,
      archived: archived || false,
      school: userSchool,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: {
        name: session?.user?.name || session?.user?.email || 'Unknown',
        email: session?.user?.email || '',
      },
    };

    // Persist extra intake fields when provided
    if (phone)                studentData.phone                = phone;
    if (gender)               studentData.gender               = gender;
    if (program)              studentData.program              = program;
    if (notes)                studentData.notes                = notes;
    if (intakeStudentStatus)  studentData.intakeStudentStatus  = intakeStudentStatus;
    if (originalStartDate)    studentData.originalStartDate    = originalStartDate;
    if (educationStatus)      studentData.educationStatus      = educationStatus;
    if (Array.isArray(intakeActivity) && intakeActivity.length) studentData.intakeActivity = intakeActivity;
    if (placementClass)       studentData.placementClass       = placementClass;
    if (intakeSession)        studentData.intakeSession        = intakeSession;
    if (timeIn)               studentData.timeIn               = timeIn;
    if (isLeaving)            studentData.isLeaving            = isLeaving;
    if (timeOut)              studentData.timeOut              = timeOut;
    if (otherNote)            studentData.otherNote            = otherNote;

    const hasAddressInput = [address, apt, city, state, zip].some(v => String(v ?? '').trim());
    if (hasAddressInput) {
      const normalized = normalizeStudentAddress({ address, apt, city, state, zip });
      const local = validateStudentAddress(normalized);
      studentData.address = normalized.address || null;
      studentData.apt = normalized.apt || null;
      studentData.city = normalized.city || null;
      studentData.state = normalized.state || null;
      studentData.zip = normalized.zip || null;
      studentData.addressFlags = local.flags;
      studentData.addressWarnings = local.warnings;

      if (verifyAddress !== false && normalized.address) {
        const verification = await verifyAddressWithGeoclient(normalized);
        studentData.addressValidationStatus = verification.status;
        studentData.addressFlags = verification.flags;
        studentData.addressWarnings = verification.warnings;
        studentData.addressGeoclient = verification.geoclient;
        studentData.addressVerifiedAt = new Date().toISOString();

        if (verification.standardized && ['verified', 'warning'].includes(verification.status)) {
          studentData.address = verification.standardized.address || null;
          studentData.apt = verification.standardized.apt || null;
          studentData.city = verification.standardized.city || null;
          studentData.state = verification.standardized.state || null;
          studentData.zip = verification.standardized.zip || null;
          studentData.addressStandardized = verification.standardized;
        }
      } else {
        studentData.addressValidationStatus = local.status === 'empty' ? 'empty' : 'unverified';
      }
    }

    // ── Seed the first intake visit (time log) ────────────────────────────────
    // Each student record keeps a history of visits so we can total time across
    // multiple days (Continuing Intake / Returning students re-visit).
    if (timeIn) {
      studentData.intakeVisits = [{
        date: new Date().toISOString(),
        timeIn,
        timeOut: timeOut || null,
        isLeaving: isLeaving || null,
        intakeSession: intakeSession || null,
        intakeActivity: Array.isArray(intakeActivity) ? intakeActivity : [],
        educationStatus: educationStatus || null,
        placementClass: placementClass || null,
        notes: notes || null,
        recordedBy: {
          name: session?.user?.name || session?.user?.email || 'Unknown',
          email: session?.user?.email || '',
        },
      }];
    }

    // Flag records added via sibling acknowledgement
    if (body.siblingFlag) {
      studentData.siblingFlag = true;
      studentData.siblingFlagNote = body.siblingFlagNote;
    }
    if (body.registeredWithNewAddress) {
      studentData.registeredWithNewAddress = true;
      studentData.newAddressReviewNote = body.newAddressReviewNote;
    }
    
    const result = await db.collection('students').insertOne(studentData);
    const insertedStudent = {
      _id: result.insertedId,
      ...studentData
    };
    
    return NextResponse.json(insertedStudent, { status: 201 });
  } catch (error) {
    console.error('Error adding student:', error);
    return NextResponse.json({ 
      error: 'Failed to add student',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 