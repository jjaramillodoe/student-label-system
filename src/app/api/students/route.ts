import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import { buildStudentSearchOrConditions, escapeRegex } from '@/lib/studentSearch';
import { logSearchEvent } from '@/lib/searchAnalytics';
import {
  STUDENTS_LIST_CSV_MAX,
  STUDENTS_LIST_DEFAULT_LIMIT,
  STUDENTS_LIST_SEARCH_LIMIT,
  clampStudentsListLimit,
} from '@/lib/studentsList';
import { ObjectId } from 'mongodb';
import { cleanIdComponent, generateLabelId, resolveAgencyId, resolveStudentId } from '@/lib/studentId';
import {
  beEslAgeErrorMessage,
  evaluateIntakeDob,
  isBeEslAgeAllowed,
  requiresBeEslAgeCheck,
} from '@/lib/beEslEligibility';
import { normalizeStudentAddress, validateStudentAddress } from '@/lib/addressValidation';
import { verifyAddressWithGeoclient } from '@/lib/addressGeoclient';
import { getSchoolIntakeSessions, validateIntakeSessionTimes } from '@/lib/intakeSession';
import { assignDrawerSection } from '@/lib/drawerSections';
import { usaNameError } from '@/lib/usaName';
import { enrichStudentsWithCabinetNames, loadCabinetDrawerLookup } from '@/lib/cabinetNames';
import { withMongoTransaction } from '@/lib/mongoTransaction';

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
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const userRole = auth.user.role;
    const userSchool = auth.user.school;

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitParam = searchParams.get('limit');
    const defaultLimit = search && !limitParam ? STUDENTS_LIST_SEARCH_LIMIT : STUDENTS_LIST_DEFAULT_LIMIT;
    const limit = clampStudentsListLimit(
      limitParam ? parseInt(limitParam, 10) : defaultLimit,
      defaultLimit,
    );
    const format = searchParams.get('format') || '';
    const since = searchParams.get('since');
    const createdByMe = searchParams.get('createdByMe');
    const fiscalYear = searchParams.get('fiscalYear')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const archived = searchParams.get('archived')?.trim() || '';
    const cabinet = searchParams.get('cabinet')?.trim() || '';
    const drawer = searchParams.get('drawer')?.trim() || '';
    const email = searchParams.get('email')?.trim() || '';
    const startDateFrom = searchParams.get('startDateFrom')?.trim() || '';
    const startDateTo = searchParams.get('startDateTo')?.trim() || '';
    const unprinted = searchParams.get('unprinted') === '1' || searchParams.get('unprinted') === 'true';

    const client = await clientPromise;
    const db = client.db('student-label');

    const query: Record<string, unknown> = userRole === 'Admin' ? {} : { school: userSchool };

    if (since) {
      query.createdAt = { $gte: since };
    }
    if (createdByMe === 'true' && auth.user.email) {
      query['createdBy.email'] = auth.user.email;
    }
    if (search) {
      const orConditions = buildStudentSearchOrConditions(search);
      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    }
    if (fiscalYear && fiscalYear !== 'all') query.fiscalYear = fiscalYear;
    if (status && status !== 'all') query.status = status;
    if (archived === '0' || archived === 'false') {
      query.archived = { $ne: true };
    } else if (archived === '1' || archived === 'true') {
      query.archived = true;
    }
    if (cabinet && cabinet !== 'all') query.cabinet = cabinet;
    if (drawer && drawer !== 'all') query.drawer = drawer;
    if (email) {
      query.email = { $regex: escapeRegex(email), $options: 'i' };
    }
    if (startDateFrom) {
      query.startDate = { ...(query.startDate as object || {}), $gte: startDateFrom };
    }
    if (startDateTo) {
      query.startDate = { ...(query.startDate as object || {}), $lte: startDateTo };
    }

    if (unprinted) {
      const printMatch: Record<string, unknown> = {};
      if (userRole !== 'Admin' && userSchool) {
        printMatch['user.school'] = userSchool;
      }
      const rows = await db.collection('print_history').aggregate([
        ...(Object.keys(printMatch).length ? [{ $match: printMatch }] : []),
        { $unwind: { path: '$students', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: null,
            studentIds: { $addToSet: '$students.studentId' },
            labelIds: { $addToSet: '$students.labelId' },
          },
        },
      ]).toArray();
      const printed = [
        ...((rows[0]?.studentIds as unknown[]) || []),
        ...((rows[0]?.labelIds as unknown[]) || []),
      ]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
      if (printed.length > 0) {
        query.$nor = [
          { labelId: { $in: printed } },
          { studentId: { $in: printed } },
        ];
      }
      query.archived = { $ne: true };
    }

    const { byCabinetId } = await loadCabinetDrawerLookup(db);

    if (format === 'csv') {
      const rows = await db.collection('students')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(STUDENTS_LIST_CSV_MAX)
        .toArray();
      const enriched = enrichStudentsWithCabinetNames(rows, byCabinetId);
      const header = [
        'labelId', 'studentId', 'firstName', 'lastName', 'dob', 'school', 'status',
        'fiscalYear', 'cabinetName', 'drawerName', 'email', 'createdAt',
      ];
      const lines = [header.join(',')];
      for (const r of enriched as Array<Record<string, unknown>>) {
        lines.push(header.map((key) => {
          const v = r[key];
          const s = v == null ? '' : String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        }).join(','));
      }
      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const total = await db.collection('students').countDocuments(query);
    const students = await db.collection('students')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    if (search && page === 1) {
      void logSearchEvent({
        query: search,
        resultCount: total,
        source: searchParams.get('source') || 'lookup',
        school: userSchool || null,
        role: userRole || null,
      });
    }

    return NextResponse.json({
      students: enrichStudentsWithCabinetNames(students, byCabinetId),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const userRole = auth.user.role;
    const userSchool = auth.user.school;
    
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

    if (firstName != null || lastName != null) {
      const firstErr = usaNameError(String(firstName || ''), 'First name');
      const lastErr = usaNameError(String(lastName || ''), 'Last name');
      if (firstErr || lastErr) {
        return NextResponse.json({ error: firstErr || lastErr }, { status: 400 });
      }
    }

    if (dob) {
      const dobEval = evaluateIntakeDob(String(dob), {
        requiresBeEsl: requiresBeEslAgeCheck({ intakeStudentStatus, educationStatus }),
      });
      if (dobEval.boundaryError) {
        return NextResponse.json({ error: dobEval.boundaryError }, { status: 400 });
      }
      if (dobEval.beEsl.applicable && !isBeEslAgeAllowed(dobEval.beEsl)) {
        return NextResponse.json({ error: beEslAgeErrorMessage(dobEval.beEsl) }, { status: 400 });
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
        name: { $regex: `^${escapeRegex(schoolName)}$`, $options: 'i' },
      });
      agencyId = resolveAgencyId(schoolName, schoolDoc?.agencyId);
    }

    // ── Generate labelId (barcode printed on the physical label) ─────────────
    // Accept an explicitly provided labelId, otherwise auto-generate one.
    let labelId: string = body.labelId || '';
    if (!labelId && firstName && lastName && dob) {
      const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
      const birthYear = String(dob).split('-')[0] || String(new Date().getFullYear());
      const pattern = new RegExp(`^${escapeRegex(birthYear)}-${escapeRegex(initials)}-\\d{7}$`);
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

    // ── Generate studentId (ASISTS-aligned demographic identifier) ────────────
    // Prefer an explicit ID (e.g. ASISTS/legacy externalId from intake).
    // Otherwise: {LASTNAME}{FIRSTNAME}{AGENCYID}{D}{M}{YYYY} (day/month unpadded).
    let studentId = '';
    if (firstName && lastName && dob && agencyId) {
      studentId = resolveStudentId({
        firstName,
        lastName,
        agencyId,
        dob,
        preferredExternalId: body.studentId ? cleanIdComponent(String(body.studentId)) : null,
      });
    } else if (body.studentId) {
      studentId = cleanIdComponent(String(body.studentId));
    }
    
    // If cabinet and drawer are provided, update the cabinet capacity
    let drawerSection: string | undefined;
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
      const drawerIndex = cabinetDoc.drawers.findIndex((d: any) => String(d._id) === String(drawer));
      if (drawerIndex === -1) {
        return NextResponse.json({ error: 'Drawer not found in cabinet' }, { status: 404 });
      }

      const drawerCapacity = cabinetDoc.drawers[drawerIndex].capacity;
      const currentCount = cabinetDoc.drawers[drawerIndex].currentCount || 0;

      if (currentCount >= drawerCapacity) {
        return NextResponse.json({ error: 'Drawer is at full capacity' }, { status: 400 });
      }

      drawerSection = assignDrawerSection(currentCount, drawerCapacity);
      // Cabinet $inc happens in the same transaction as insertOne below.
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
      ...(drawerSection ? { drawerSection } : {}),
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
        name: auth.user?.name || auth.user?.email || 'Unknown',
        email: auth.user?.email || '',
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
          name: auth.user?.name || auth.user?.email || 'Unknown',
          email: auth.user?.email || '',
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
    
    const result = await withMongoTransaction(async (session) => {
      if (cabinet && drawer) {
        const cabinetDoc = await db.collection('cabinets').findOne(
          { _id: new ObjectId(cabinet) },
          { session },
        );
        if (!cabinetDoc) {
          throw new Error('Cabinet not found');
        }
        const drawerIndex = cabinetDoc.drawers.findIndex((d: any) => String(d._id) === String(drawer));
        if (drawerIndex === -1) {
          throw new Error('Drawer not found in cabinet');
        }
        const drawerCapacity = cabinetDoc.drawers[drawerIndex].capacity;
        const currentCount = cabinetDoc.drawers[drawerIndex].currentCount || 0;
        if (currentCount >= drawerCapacity) {
          throw new Error('Drawer is at full capacity');
        }
        studentData.drawerSection = assignDrawerSection(currentCount, drawerCapacity);
        await db.collection('cabinets').updateOne(
          {
            _id: new ObjectId(cabinet),
            'drawers._id': drawer,
          },
          {
            $inc: {
              'drawers.$.currentCount': 1,
              currentCount: 1,
            },
          },
          { session },
        );
      }
      return db.collection('students').insertOne(studentData, { session });
    });
    const insertedStudent = {
      _id: result.insertedId,
      ...studentData
    };
    
    return NextResponse.json(insertedStudent, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('full capacity') || message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Error adding student:', error);
    return NextResponse.json({ 
      error: 'Failed to add student',
      details: message,
    }, { status: 500 });
  }
} 