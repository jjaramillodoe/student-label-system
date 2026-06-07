import Link from 'next/link';
import {
  Activity, Archive, Barcode, BookOpen, Boxes, Building2, CalendarRange,
  CheckCircle2, CopyCheck, FileSpreadsheet, HeartPulse,
  KeyRound, Layers, Link2, Lock, Mail, MapPin, MoveRight, PackageOpen, Printer,
  QrCode, Search, Settings, Shield, ShieldCheck, Sparkles,
  Upload, UserPlus, Users, ClipboardList, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ── Role guides ────────────────────────────────────────────────────────────────
const roleGuides = [
  {
    role: 'Admin',
    scope: 'All schools',
    color: 'bg-red-50 border-red-200 dark:bg-red-950/20',
    badge: 'destructive' as const,
    notes: 'Full access: user management, security recovery, school & agency ID configuration, all cabinets, all students, enrollment dashboard, email validation, school year rollover, archive boxes, reports, cleanup, and system migration tools.',
  },
  {
    role: 'Data Lead',
    scope: 'Assigned school',
    color: 'bg-violet-50 border-violet-200 dark:bg-violet-950/20',
    badge: 'secondary' as const,
    notes: 'Manage school data, cabinets, bulk imports, duplicate review, sibling confirmation, unassigned queue, bulk move, enrollment dashboard, email validation, school settings, school year rollover, archive boxes, and cleanup tools.',
  },
  {
    role: 'Data Member',
    scope: 'Assigned school',
    color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20',
    badge: 'secondary' as const,
    notes: 'Add, edit, search, print, and export student records for their assigned school.',
  },
  {
    role: 'Intake Member',
    scope: 'Assigned school',
    color: 'bg-green-50 border-green-200 dark:bg-green-950/20',
    badge: 'secondary' as const,
    notes: 'Access only the Intake Form. Register new students, run live duplicate checks, flag potential siblings, and print labels on the spot. Cannot access the main dashboard or admin tools.',
    isNew: true,
  },
];

// ── Feature groups ─────────────────────────────────────────────────────────────
const featureGroups = [
  {
    title: 'Student Records',
    description: 'Daily tools for finding, adding, editing, printing, and organizing student files.',
    icon: Users,
    items: [
      'Create student records with auto-generated Label ID (e.g. 1979-JJ-0000001) and demographic Student ID.',
      'Search by name, email, Label ID, or Student ID.',
      'Advanced filters for status, fiscal year, dates, cabinet, and drawer.',
      'Save common searches for quick reuse.',
      'Archive inactive records and restore when needed.',
      'Returning archived students are auto-assigned to the next open drawer when re-enrolled through Intake.',
      'Sibling badge shown on confirmed sibling pairs.',
    ],
  },
  {
    title: 'Intake Form',
    description: 'Specialized enrollment screen for Intake Members — includes live duplicate detection.',
    icon: ClipboardList,
    isNew: true,
    items: [
      'Available only to Intake Members (and Admins/Data Leads for testing).',
      'NEW students: contact & address (street + separate Apt/Unit), paste/parse, NYC Geoclient verify, Google Maps link.',
      'Live duplicate check uses name + home address — same address strengthens match; different address flags possible sibling or move.',
      'RETURNING students: search on the same screen, visit history accordion, personal info and address locked; record today\'s visit only.',
      'Automatically assigns the next available cabinet/drawer slot.',
      'Prints a label (barcode + QR code) immediately after saving.',
      '"This is a different person" checkbox flags potential siblings for Data Lead review.',
      '"Copy alert message" button generates a ready-to-paste message for Teams, email, or Slack.',
      'Intake History tab shows registrations for today or this week, filtered to your own or all staff.',
    ],
  },
  {
    title: 'Duplicate & Sibling Review',
    description: 'Data Lead tool to review and resolve flagged or auto-detected duplicate student records.',
    icon: CopyCheck,
    isNew: true,
    items: [
      'Flagged section: students marked by Intake Members as potential duplicates.',
      'Auto-detected section: same DOB + similar name, or same DOB + same home address (even when names differ).',
      'Each pair shows formatted addresses and comparison badges: Same verified / Same address / Same building / Different address.',
      '"Matched by address" badge when the pair was found primarily by home address.',
      '"Confirm Siblings" links both records bidirectionally; sibling info appears on student detail page.',
      '"Merge Records" copies missing fields (including address and apt) from secondary to primary and removes the duplicate.',
      '"Dismiss / Not a duplicate" hides the pair permanently (won\'t resurface on next load).',
    ],
  },
  {
    title: 'Bulk Upload',
    description: 'Import students from CSV with validation before saving.',
    icon: Upload,
    items: [
      'Download a CSV template or sample CSV file.',
      'Optional address columns: address, apt, city, state, zip (apt also accepts unit, address2).',
      'Preview upload rows before creating records; NYC Geoclient verify on preview with Apply standardized.',
      'Catches missing names, invalid dates, placeholder emails (n/a, na), and duplicate records.',
      'Amber address warnings for likely NYC ZIP/borough mismatches — upload is not blocked.',
      'Edit preview rows inline before upload.',
      'Auto-generates Label ID and Student ID for every uploaded row.',
    ],
  },
  {
    title: 'Address Verification',
    description: 'Street + apt fields, NYC Geoclient standardization, and address-aware duplicate matching.',
    icon: MapPin,
    isNew: true,
    items: [
      'Addresses stored as separate fields: street (address), apt, city, state, zip.',
      'NYC Geoclient verifies the building; apartment/unit is preserved in the apt column.',
      'Intake (NEW), bulk upload, All Students edit dialog, and batch verify on /admin/students/all.',
      'Status badges: Verified, Warning, Not found, Unverified — filter and export by address status.',
      'CSV export includes a separate Apt column for mail merge.',
      'Legacy records with apt embedded in the street line are split automatically on read.',
    ],
  },
  {
    title: 'Cabinets & Drawers',
    description: 'Track where files live and keep drawer counts accurate.',
    icon: Boxes,
    items: [
      'Create cabinets with multiple drawers and capacities.',
      'Filter and sort by school, capacity status, usage, and name.',
      'Smart Fill to quickly create standard cabinet structures.',
      'Archive cabinets at year-end: choose box size (50 / 100 / 200 files), storage location, and school year.',
      'End-of-year closeout switch allows archiving even when drawers are not completely full.',
      'Students move into physical archive boxes; cabinet drawers are cleared for the new school year.',
      'Sync cabinet counts when data needs recalculation.',
    ],
  },
  {
    title: 'Archive & School Year Rollover',
    description: 'End-of-year closeout, physical archive boxes, printable labels, and public box lookup.',
    icon: PackageOpen,
    isNew: true,
    items: [
      'School Year Rollover checklist (/admin/school-year) tracks archive progress, open drawers, and pending box assignments.',
      'Set the active fiscal year in School Settings — Intake and new records use that year automatically.',
      'Each archived cabinet is split into numbered physical boxes with unique IDs and labels.',
      'Box labels include a QR code, public URL, and full student file list — attach to the physical box.',
      'Download PDF: page 1 = label + QR; page 2 = two-column student list (fits ~200 files on 2 pages).',
      'Scanning the box QR opens a public page — no login required — with box location and every student in that box.',
      'Physical records must be kept for the 7-year retention period before disposal.',
    ],
  },
  {
    title: 'Labels & Scanning',
    description: 'Print labels with barcodes and QR codes for fast lookup.',
    icon: QrCode,
    items: [
      'Default layout: Avery 5163 on legal paper (10 labels per sheet).',
      'Label shows student name, DOB, barcode (Label ID), and a large QR code.',
      'Student QR codes link to a public detail page — no login required to scan.',
      'Archive box QR codes link to a public box page with storage location and student file list.',
      'Detail page shows: Label ID, Student ID, name, DOB, cabinet, drawer, school, and sibling links.',
      'Avery 5163 tip: print in multiples of 10 to avoid wasted labels.',
    ],
  },
  {
    title: 'Dual ID System',
    description: 'Two IDs per student — one for physical labels, one for demographic tracking.',
    icon: Barcode,
    isNew: true,
    items: [
      'Label ID: printed on the barcode (e.g. 1979-JJ-0000001). Used on physical labels and QR codes.',
      'Student ID: demographic format — LastNameFirstNameAgencyIDDOB (e.g. CUEVAELSAR0119790522).',
      'Agency ID (e.g. R01, R02) configured per school under Admin → Schools.',
      '"Backfill Student IDs" button in Schools migrates existing records to the new format.',
      'Both IDs shown in the student table, bulk upload preview, and student detail page.',
    ],
  },
  {
    title: 'Enrollment Dashboard',
    description: 'Track registrations by staff member and time period.',
    icon: TrendingUp,
    isNew: true,
    items: [
      'Metric cards: Today, This Week, This Month, All Time.',
      'Staff leaderboard with gold/silver/bronze ranking and relative progress bars.',
      'Daily trend bar chart — hover a bar to see the exact count.',
      'Filterable enrollment table: by period, staff member, or student/staff name search.',
      'Shows who registered each student (name + email) on every row.',
    ],
  },
  {
    title: 'Email Validation',
    description: 'Verify student email addresses via EmailAwesome API.',
    icon: Mail,
    isNew: true,
    items: [
      '1,000 validations/month limit with a visual usage meter (green → amber → red).',
      '"Submit New" tab: pick students by name, filter by "has email", "not yet validated", or "previously invalid".',
      'Already-queued or processing emails are hidden from the picker automatically.',
      'Auto-polls every 8 seconds when jobs are pending — no manual refresh needed.',
      'Results: Valid (green), Invalid (red), Catch-all (yellow), Unknown (gray).',
      '"Apply Results" writes emailValidationStatus and date back to each student record.',
    ],
  },
  {
    title: 'Admin & Data Lead Tools',
    description: 'Pages for keeping data clean and storage organized.',
    icon: Shield,
    items: [
      'Cabinet Health: full, near-full, empty, and over-capacity drawers at a glance.',
      'Archived students with a valid archive box are excluded from “missing cabinet” warnings.',
      'Unassigned Queue: students with missing or invalid storage assignments.',
      'Bulk Move: move selected students with capacity validation.',
      'School Year Rollover: checklist for fiscal year, archive status, and open drawers.',
      'Data Cleanup: invalid emails, missing dates, old inactive records.',
      'Activity Report: student record event log.',
      'Schools / School Settings: configure school names, Agency IDs, and current fiscal year.',
    ],
  },
  {
    title: 'Security',
    description: 'Account access, MFA, and admin recovery features.',
    icon: Lock,
    items: [
      'Users can change their own passwords from Profile.',
      'Authenticator-app MFA with QR setup and 6-digit codes.',
      'Admins can reset passwords, force password changes, and disable MFA for locked-out users.',
      'Role permission preview explains each role before assignment.',
      'All role and school assignments stored in MongoDB.',
    ],
  },
];

// ── Quick links ────────────────────────────────────────────────────────────────
const quickLinks = [
  { href: '/', label: 'Dashboard', icon: Layers },
  { href: '/intake', label: 'Intake Form', icon: ClipboardList, isNew: true },
  { href: '/admin/students/bulk-upload', label: 'Bulk Upload', icon: FileSpreadsheet },
  { href: '/admin/cabinets', label: 'Cabinets', icon: Building2 },
  { href: '/admin/school-year', label: 'School Year Rollover', icon: CalendarRange, isNew: true },
  { href: '/admin/cabinet-health', label: 'Cabinet Health', icon: HeartPulse },
  { href: '/admin/duplicates', label: 'Duplicates', icon: CopyCheck, isNew: true },
  { href: '/admin/students/all', label: 'All Students', icon: Users, isNew: true },
  { href: '/admin/enrollment', label: 'Enrollment', icon: UserPlus, isNew: true },
  { href: '/admin/validation', label: 'Email Validation', icon: ShieldCheck, isNew: true },
  { href: '/admin/unassigned', label: 'Unassigned Queue', icon: Archive },
  { href: '/admin/bulk-move', label: 'Bulk Move', icon: MoveRight },
  { href: '/admin/activity-report', label: 'Activity Report', icon: Activity },
  { href: '/admin/print-queue', label: 'Print Queue', icon: Printer },
  { href: '/admin/data-cleanup', label: 'Data Cleanup', icon: Sparkles },
  { href: '/admin/schools', label: 'Schools & Agency IDs', icon: Settings },
  { href: '/profile', label: 'Profile Security', icon: KeyRound },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="w-full p-6 space-y-10">

        {/* Header */}
        <section className="rounded-xl border bg-card p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <Badge variant="outline" className="mb-3">Documentation</Badge>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <BookOpen className="h-9 w-9" />
                Student Label System Guide
              </h1>
              <p className="text-muted-foreground mt-3 max-w-3xl">
                A complete guide to all features, roles, intake, address verification, scanning workflow, archive boxes, school year rollover, ID system, and admin tools.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Long-form searchable docs (Mintlify) live in the <code className="text-xs bg-muted px-1 py-0.5 rounded">docs/</code> folder — preview locally with <code className="text-xs bg-muted px-1 py-0.5 rounded">mint dev</code> from that directory.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" asChild>
                <Link href="/docs/api">API Reference (Swagger)</Link>
              </Button>
              <Button asChild>
                <Link href="/">Back to Dashboard</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Role guides */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> User Roles
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roleGuides.map(r => (
              <Card key={r.role} className={`border ${r.color}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {r.role}
                    <div className="flex items-center gap-1">
                      {r.isNew && <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border-green-300">New</Badge>}
                      <Badge variant="outline" className="text-xs">{r.scope}</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{r.notes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Feature overview */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" /> Feature Overview
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {featureGroups.map((group) => {
              const Icon = group.icon;
              return (
                <Card key={group.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-5 w-5 text-primary" />
                      {group.title}
                      {group.isNew && <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border-green-300 ml-1">New</Badge>}
                    </CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {group.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Reference cards */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Barcode className="h-6 w-6 text-primary" /> Reference
          </h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">

            {/* QR code payload */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" /> Student QR Code
                </CardTitle>
                <CardDescription>
                  Scanning a student QR code opens a public detail page — no login required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`https://your-app.com/student/1979-JJ-0000001

Detail page shows:
  Label ID  · Student ID
  Name      · Date of Birth
  Cabinet   · Drawer
  School    · Sibling links`}
                </pre>
              </CardContent>
            </Card>

            {/* Archive box QR */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageOpen className="h-5 w-5 text-primary" /> Archive Box QR Code
                </CardTitle>
                <CardDescription>
                  Printed on physical archive box labels. Opens the public box page and file list.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`https://your-app.com/archive/box/{boxId}

Public page shows:
  Box label · Cabinet · School year
  Storage location · Archive date
  Full student list in the box

Print / PDF:
  Page 1 — QR + box metadata
  Page 2 — two-column student list`}
                </pre>
              </CardContent>
            </Card>

            {/* Dual ID system */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-5 w-5 text-primary" /> Dual ID System
                </CardTitle>
                <CardDescription>
                  Two IDs are auto-generated for every student.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`Label ID (barcode/QR):
  1979-JJ-0000001
  Format: {year}-{initials}-{sequence}

Student ID (demographic):
  JARAMILLOJAVIER R01 19790522
  Format: {lastName}{firstName}
          {agencyId}{dob no dashes}

Agency IDs (set in Schools):
  R00 = District 79
  R01 = School 1
  R02 = School 2  …`}
                </pre>
              </CardContent>
            </Card>

            {/* Bulk upload columns */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-5 w-5 text-primary" /> Bulk Upload Columns
                </CardTitle>
                <CardDescription>
                  Cabinet and drawer are selected on the upload screen for the entire file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`firstName, lastName, dob
fiscalYear, status, startDate
email, phone, gender, program
address, apt, city, state, zip`}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/student_bulk_upload_template.csv" download>CSV Template</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/student_bulk_upload_sample.csv" download>Sample CSV</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* End-of-year archive workflow */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <PackageOpen className="h-6 w-6 text-primary" /> End-of-Year Archive Workflow
          </h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-3 text-sm">
                {[
                  { n: '1', label: 'Open Admin → School Year Rollover. Confirm the fiscal year is set correctly under Schools / School Settings.' },
                  { n: '2', label: 'Review Cabinet Health and the Unassigned Queue — resolve any students missing a valid drawer before archiving.' },
                  { n: '3', label: 'On Cabinets, open the cabinet to archive. Choose box size (50 / 100 / 200), storage location, and school year.' },
                  { n: '4', label: 'If drawers are not completely full, turn on End-of-year closeout to allow a partial-year archive.' },
                  { n: '5', label: 'After archiving, sync students to physical boxes if prompted. Each box gets a unique ID and printable label.' },
                  { n: '6', label: 'Print or Download PDF from the box label dialog. Attach the label to the physical box — QR links to the public box page.' },
                  { n: '7', label: 'Store boxes at the recorded location. Keep physical files for the 7-year retention period.' },
                  { n: '8', label: 'When a returning student re-enrolls through Intake, the system reactivates their record and assigns the next open drawer automatically.' },
                ].map(step => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{step.n}</span>
                    <span className="text-muted-foreground pt-0.5">{step.label}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Intake workflow */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Intake Workflow
          </h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-3 text-sm">
                {[
                  { n: '1', label: 'Intake Member opens /intake. Choose NEW (first visit) or RETURNING (search existing record).' },
                  { n: '2', label: 'NEW: enter name, DOB, phone, email, and address (street + Apt/Unit). Verify with NYC Geoclient when available.' },
                  { n: '3', label: 'Live duplicate check compares name and home address. Same address strengthens the match; different address may indicate siblings or a move.' },
                  { n: '4', label: 'If a match is found: stop if same person; otherwise check "This is a different person" and use "Copy alert message" for the Data Lead.' },
                  { n: '5', label: 'RETURNING: search, review visit history accordion, record today\'s visit only — personal info and address stay locked.' },
                  { n: '6', label: 'Submit. The system auto-assigns the next open cabinet/drawer slot and prints a label (barcode + QR).' },
                  { n: '7', label: 'Data Lead reviews /admin/duplicates with address comparison: Confirm Siblings, Merge, or Dismiss.' },
                ].map(step => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{step.n}</span>
                    <span className="text-muted-foreground pt-0.5">{step.label}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Address verification workflow */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Address Verification Workflow
          </h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-3 text-sm">
                {[
                  { n: '1', label: 'Capture street and apt separately on Intake (NEW), bulk CSV (address + apt columns), or All Students edit dialog.' },
                  { n: '2', label: 'NYC Geoclient verifies the building only — standardized street is saved; apt stays in its own field.' },
                  { n: '3', label: 'On Admin → All Students, filter by address status and run Verify & save this page or Verify unverified batch.' },
                  { n: '4', label: 'Use the pencil icon to fix typos, then re-verify. Export CSV includes Apt as a separate column for mail merge.' },
                  { n: '5', label: 'Intake duplicate checks and Admin → Duplicates use the same address comparison (same building, different apt = likely siblings).' },
                ].map(step => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{step.n}</span>
                    <span className="text-muted-foreground pt-0.5">{step.label}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Email validation workflow */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Email Validation Workflow
          </h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-3 text-sm">
                {[
                  { n: '1', label: 'Go to Admin → Email Validation. The usage meter shows how many of your 1,000 monthly validations remain.' },
                  { n: '2', label: 'Switch to "Submit New". Filter students by "Has email" or "Not yet validated". Select students and click "Validate Emails".' },
                  { n: '3', label: 'Jobs appear in the Validation Jobs tab as Pending. The page auto-polls every 8 seconds.' },
                  { n: '4', label: 'Results update automatically: Valid (green), Invalid (red), Catch-all (yellow), Unknown (gray).' },
                  { n: '5', label: 'Once complete, click "Apply N Results to Students" to write emailValidationStatus back to each student record.' },
                  { n: '6', label: 'Applied emails are freed from the exclusion list and can be re-validated in future months.' },
                ].map(step => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{step.n}</span>
                    <span className="text-muted-foreground pt-0.5">{step.label}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Quick links */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button key={link.href} variant="outline" asChild className="justify-start gap-2 h-auto py-2">
                  <Link href={link.href}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{link.label}</span>
                    {link.isNew && <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-700 border-green-300">New</Badge>}
                  </Link>
                </Button>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
