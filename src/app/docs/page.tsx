import Link from 'next/link';
import {
  Activity, Archive, Barcode, BookOpen, Boxes, Building2, CalendarRange,
  CheckCircle2, CopyCheck, ExternalLink, FileSpreadsheet, HeartPulse,
  KeyRound, Layers, Link2, Lock, Mail, MapPin, MoveRight, PackageOpen, Printer,
  QrCode, Search, Settings, Shield, ShieldCheck, Sparkles,
  Upload, UserPlus, Users, ClipboardList, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MINTLIFY_DOCS_URL } from '@/lib/docsUrl';
import { roleBadgeClass } from '@/lib/roleBadge';

// ── Role guides ────────────────────────────────────────────────────────────────
const roleGuides = [
  {
    role: 'Admin',
    scope: 'All schools',
    notes: 'Full access: user management, security recovery, school & agency ID configuration, all cabinets, all students, enrollment dashboard, email validation, school year rollover, archive boxes, reports, cleanup, and system migration tools.',
  },
  {
    role: 'Data Lead',
    scope: 'Assigned school',
    notes: 'Manage school data, cabinets, bulk imports, duplicate review, sibling confirmation, unassigned queue, bulk move, enrollment dashboard, school settings, school year rollover, archive boxes, and cleanup tools.',
  },
  {
    role: 'Data Member',
    scope: 'Assigned school',
    notes: 'Add, edit, search, print, and export student records for their assigned school. Use Needs label on Find & print for never-printed students. Print Avery 5163 / 94205 via Download Word Doc on Letter.',
  },
  {
    role: 'Intake Member',
    scope: 'Assigned school',
    notes: 'Access only the Intake Form. Register new and returning students, run ASISTS + live duplicate checks, notify Data Leads with Copy alert / Email with alert, flag potential siblings, and review a success summary after save. Labels are printed later in batches from the Dashboard (Word Doc). Cannot access the main dashboard or admin tools.',
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
      'Needs label chip on Find & print: show only students who have never appeared in print history.',
      'Save common searches for quick reuse.',
      'Archive inactive records and restore when needed.',
      'Returning archived students keep their archive box location in Intake — a new drawer is not auto-assigned.',
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
      'NEW students: required Check ASISTS first (name, DOB, or both), then contact & address (street + Apt/Unit), NYC Geoclient verify, Google Maps link.',
      'Age rules: 16+ overall; BE/ESL requires age 21, or near-eligible within 6 weeks (eligibility notice). Farther under 21 → P2G referral.',
      'After unlock, duplicate panel shows % match and Same DOB; same DOB always surfaces for sibling review; address strengthens or weakens the match.',
      'RETURNING students: search on the same screen, visit history accordion, personal info and address locked; record today\'s visit only.',
      'NEW active students: automatically assigns the next available cabinet/drawer slot.',
      'After save, shows a registration/visit summary (location, session, times) — not a label print dialog.',
      'Under-21 / ineligible BE/ESL applicants get a copyable P2G referral message on the success screen when applicable.',
      'Labels are printed later in batches from the Dashboard via Download Word Doc (Letter, 100%).',
      '"This is a different person" / "Not the same person sitting here" flags potential siblings for Data Lead review.',
      '"Copy alert message" and "Email with alert" send a structured Data Lead note (school, reporter, NEW student, matches, Duplicates link).',
      'Autosaves a browser draft so you can Resume after an idle sign-out; success screen links to Dashboard Needs label for printing.',
      'Intake History tab shows registrations for today or this week, filtered to your own or all staff.',
    ],
  },
  {
    title: 'Duplicate & Sibling Review',
    description: 'Data Lead tool to review and resolve flagged or auto-detected duplicate student records.',
    icon: CopyCheck,
    isNew: true,
    items: [
      'Flagged section: students marked by Intake Members as potential duplicates / different person.',
      'Auto-detected section: same DOB + similar name, or same DOB + same home address (even when names differ).',
      'Intake alert email includes subject, school, reporter, NEW student fields, match details, and /admin/duplicates link.',
      'Each pair shows formatted addresses and comparison badges: Same verified / Same address / Same building / Different address.',
      '"Matched by address" badge when the pair was found primarily by home address.',
      '"Confirm Siblings" links both records bidirectionally; sibling info appears on student detail page.',
      '"Merge Records" copies missing fields (including address and apt) from secondary to primary and removes the duplicate — Undo available for ~10 seconds.',
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
      'Default layout: Avery 5163 on Letter (8.5"×11") — 10 labels per sheet (also Avery 94205).',
      'Needs label on Find & print: only students never logged in print history — confirm Yes after a successful print so they drop off.',
      'Download Word Doc from the print preview, print from Word at 100% with margins None, then confirm Yes — mark as printed (or No to keep on Needs label).',
      'Label shows Last, First, DOB, 5-digit batch sequence, barcode (Label ID), and a large QR code.',
      'Student QR codes link to a public detail page — no login required to scan.',
      'Archive box QR codes link to a public box page with storage location and student file list.',
      'Detail page shows: Label ID, Student ID, name, DOB, cabinet, drawer, school, and sibling links.',
      'Avery tip: print in multiples of 10 to avoid wasting partial sheets.',
    ],
  },
  {
    title: 'Dual ID System',
    description: 'Two IDs per student — one for physical labels, one for demographic tracking.',
    icon: Barcode,
    isNew: true,
    items: [
      'Label ID: printed on the barcode (e.g. 1979-JJ-0000001). Used on physical labels and QR codes.',
      'Student ID: ASISTS-aligned — LastNameFirstNameAgencyID + day/month/year unpadded (e.g. CUEVAELSAR012251979). Legacy matches keep the full ASISTS export ID.',
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
      'Bulk Move: move selected students with capacity validation; open from Cabinet Health via Move from here (cabinet/drawer pre-filtered).',
      'Archived student details (Admin / Data Lead): Re-file to next active drawer when a file must leave the archive box.',
      'School Year Rollover: checklist for fiscal year, archive status, and open drawers.',
      'Data Cleanup: invalid emails, missing dates, old inactive records.',
      'Activity Report: student record event log.',
      'Schools / School Settings: configure school names, Agency IDs, and current fiscal year.',
      'System Settings (/admin/settings): idle session prompt (default 15 minutes idle, then “Still using the app?” before sign-out).',
    ],
  },
  {
    title: 'Security',
    description: 'Account access, MFA, idle prompt, and admin recovery features.',
    icon: Lock,
    items: [
      'MFA is required for every account until DOE SSO is available.',
      'Idle session prompt (Admin → System Settings) asks if you are still using the app after inactivity on shared desks.',
      'Users can change their own passwords from Profile.',
      'Authenticator-app MFA with QR setup and 6-digit codes.',
      'Admins can reset passwords, force password changes, and temporarily disable MFA only to recover locked-out users (re-enable after).',
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
  { href: '/admin/settings', label: 'System Settings', icon: Settings },
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
                For searchable long-form docs with screenshots and workflows, open the{' '}
                <a
                  href={MINTLIFY_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Mintlify documentation site
                </a>
                .
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="gap-2">
                <a href={MINTLIFY_DOCS_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Full docs (Mintlify)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/docs/api">API Reference (Swagger)</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Back to app</Link>
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
              <Card key={r.role}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className={roleBadgeClass(r.role)}>{r.role}</span>
                    <div className="flex items-center gap-1">
                      {r.isNew && <span className="ui-badge-success text-[10px]">New</span>}
                      <span className="ui-badge-muted text-xs">{r.scope}</span>
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
                      {group.isNew && <span className="ui-badge-success text-[10px] ml-1">New</span>}
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

Student ID (ASISTS-aligned):
  JARAMILLOJAVIERR012251979
  Format: {lastName}{firstName}{agencyId}{D}{M}{YYYY}
  (day/month not zero-padded; legacy matches keep full ASISTS ID)

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
                  { n: '8', label: 'When a returning archived student is logged in Intake, their archive box location and QR are shown — a new drawer is not auto-assigned for the school year.' },
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
                  { n: '2', label: 'NEW: Check ASISTS first (name, DOB, or both). Confirm same person, not the same person, or acknowledge no match before personal info unlocks.' },
                  { n: '3', label: 'Enter name and DOB (16+; BE/ESL age 21 or within 6 weeks). Add phone, email, and address (street + Apt/Unit). Verify with NYC Geoclient when available.' },
                  { n: '4', label: 'Review matches under DOB (% match, Same DOB). If different person: check the sibling flag and use Copy alert message or Email with alert for the Data Lead.' },
                  { n: '5', label: 'RETURNING: search, review visit history accordion, record today\'s visit only — personal info and address stay locked.' },
                  { n: '6', label: 'Click Register Student (or Log Visit & Save). Review the success summary — location, session, and times. Near-eligible / under-21 cases show eligibility notice or P2G referral when applicable.' },
                  { n: '7', label: 'Labels are printed later from the Dashboard: optionally click Needs label → select students → Print → Download Word Doc → print from Word on Letter at 100%.' },
                  { n: '8', label: 'Data Lead reviews /admin/duplicates with address comparison: Confirm Siblings, Merge, or Dismiss.' },
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
                    {link.isNew && <span className="ui-badge-success text-[10px]">New</span>}
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
