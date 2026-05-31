# Power Platform Integration Prompts

Reference prompts for building the **Student Label System → Power Automate (overnight) → Dynamics / Dataverse** integration.

Use these in **Power Apps Copilot**, **Power Automate Copilot**, or with Cursor (MongoDB + Vercel MCPs for the API side).

---

## Architecture

```text
MongoDB (student-label)
  → /api/sync/v1/*  (API key auth, not NextAuth)
  → Power Automate nightly flow (2:00 AM)
  → Dataverse tables (upsert by alternate key)
```

**Stable external IDs for upsert:** `studentId`, `labelId` — not MongoDB `_id`.

**Security basics:**

- Dedicated machine-to-machine sync routes (never expose raw MongoDB)
- `Authorization: Bearer <SYNC_API_KEY>` or Azure AD client credentials
- Delta sync via `since` + pagination (`limit`, `cursor`)
- Optional: store watermark in Dataverse `crd79_syncrun` table

**Recommended MCPs in Cursor:**

| MCP | Use |
|-----|-----|
| MongoDB | Schema discovery, export query design, indexes |
| Vercel | Deploy sync routes, env vars (`SYNC_API_KEY`) |
| Supabase (optional) | Sync ledger / failure log outside MongoDB |
| Exa / Firecrawl | Dataverse & Power Automate Microsoft docs |
| Resend | Alert emails on failed sync runs |

There is no Dynamics/Dataverse MCP in the workspace today — use Copilot in Power Platform or Exa for Microsoft docs.

---

## Prompt 1 — Core Student table

Use in **Power Apps → Copilot** (“Create table from description”). Adjust prefix `crd79_` to your publisher prefix.

```text
Create a Dataverse table named "District79 Student" (schema name: crd79_student) for Adult Education student records synced from an external label/intake system.

Columns:
- crd79_studentid (Text, 50, Required, Alternate Key) — demographic ID, format LASTNAMEFIRSTNAMEAGENCYDOB
- crd79_labelid (Text, 30, Required) — barcode on physical label
- crd79_firstname (Text, 100, Required)
- crd79_lastname (Text, 100, Required)
- crd79_dob (Date Only, Required)
- crd79_email (Email)
- crd79_phone (Text, 20)
- crd79_gender (Choice: Male, Female, Non-binary, Prefer not to say, Other)
- crd79_school (Text, 100, Required) — e.g. "School 8"
- crd79_agencyid (Text, 10) — e.g. R01
- crd79_fiscalyear (Text, 10) — e.g. 2025-2026
- crd79_status (Choice: Active, Inactive, Withdrawn, Completed)
- crd79_program (Text, 100)
- crd79_startdate (Date Only)
- crd79_enddate (Date Only)
- crd79_archived (Yes/No, default No)
- crd79_intakestudentstatus (Text, 100)
- crd79_educationstatus (Text, 100)
- crd79_placementclass (Text, 100)
- crd79_notes (Multiline Text)
- crd79_siblingflag (Yes/No)
- crd79_sourcemongoid (Text, 30) — original MongoDB _id for traceability
- crd79_sourcesystem (Text, 50, default "StudentLabelSystem")
- crd79_sourcelastmodified (Date and Time) — from source updatedAt
- crd79_lastsyncedat (Date and Time)

Relationships: none required on first pass.

Enable alternate key on crd79_studentid for upsert from Power Automate.
Add a business rule: crd79_firstname and crd79_lastname must not be blank.
```

---

## Prompt 2 — Intake Visit (child table)

```text
Create a Dataverse table "District79 Intake Visit" (crd79_intakevisit) as a child of crd79_student.

Columns:
- crd79_intakevisitid (Auto Number primary key)
- crd79_student (Lookup → crd79_student, Required)
- crd79_visitdate (Date Only, Required)
- crd79_timein (Text, 10) — e.g. "9:15 AM"
- crd79_timeout (Text, 10)
- crd79_isleaving (Choice: Yes, No, Unknown)
- crd79_intakesession (Text, 50)
- crd79_intakeactivity (Multiline Text) — comma-separated activities from source array
- crd79_durationminutes (Whole Number)
- crd79_recordedbyemail (Email)
- crd79_recordedbyname (Text, 100)
- crd79_sourcevisitindex (Whole Number) — index in source intakeVisits array
- crd79_sourcelastmodified (Date and Time)

Relationship: Many intake visits to one student (N:1).
Create composite alternate key: crd79_student + crd79_visitdate + crd79_sourcevisitindex for idempotent sync.
```

---

## Prompt 3 — School reference table

```text
Create a Dataverse table "District79 School" (crd79_school) for reference data.

Columns:
- crd79_schoolname (Text, 100, Required, Alternate Key)
- crd79_agencyid (Text, 10, Required)
- crd79_active (Yes/No, default Yes)

Populate from source school_config: School 3, School 4, School 5, School 8, District 79, etc.

Add lookup from crd79_student.crd79_school to crd79_school.crd79_schoolname (or replace text field with lookup after initial sync).
```

---

## Prompt 4 — Physical file location (cabinet)

```text
Create a Dataverse table "District79 File Location" (crd79_filelocation) for cabinet/drawer placement.

Columns:
- crd79_locationcode (Text, 50, Alternate Key) — cabinet name + drawer, e.g. "Cabinet A / Drawer 3"
- crd79_cabinetname (Text, 100)
- crd79_drawername (Text, 50)
- crd79_school (Text, 100)
- crd79_status (Choice: Active, Archived)
- crd79_currentcount (Whole Number)
- crd79_capacity (Whole Number)

Optional lookup from crd79_student to crd79_filelocation for current placement.
```

---

## Prompt 5 — Sync run log (integration control)

```text
Create a Dataverse table "District79 Sync Run" (crd79_syncrun) to track overnight Power Automate jobs.

Columns:
- crd79_syncrunid (Auto Number)
- crd79_flowname (Text, 100) — e.g. "StudentLabel → Dynamics Nightly"
- crd79_startedat (Date and Time, Required)
- crd79_completedat (Date and Time)
- crd79_status (Choice: Running, Success, Partial, Failed)
- crd79_recordsprocessed (Whole Number)
- crd79_recordsfailed (Whole Number)
- crd79_watermarkbefore (Date and Time)
- crd79_watermarkafter (Date and Time)
- crd79_errormessage (Multiline Text)
- crd79_runurl (Text, 500) — link to Power Automate run history

This table stores the "since" cursor so the next night's flow knows where to resume.
```

---

## Prompt 6 — Audit event (optional)

```text
Create a Dataverse table "District79 Audit Event" (crd79_auditevent) mirroring label system audit logs.

Columns:
- crd79_eventid (Text, 50, Alternate Key) — source _id
- crd79_action (Text, 100) — Added, Edited, Printed, Archived, Deleted
- crd79_studentid (Text, 50) — crd79_studentid reference
- crd79_eventtime (Date and Time, Required)
- crd79_useremail (Email)
- crd79_username (Text, 100)
- crd79_userschool (Text, 100)
- crd79_payload (Multiline Text) — JSON snapshot, truncated if needed
```

---

## Prompt 7 — Overnight Power Automate flow

Use in **Power Automate Copilot** or as a build spec in make.powerautomate.com.

```text
Create a scheduled cloud flow that runs daily at 2:00 AM Eastern.

Steps:
1. Read the latest successful watermark from Dataverse table crd79_syncrun (column crd79_watermarkafter), ordered by crd79_completedat descending. If none, use yesterday at midnight UTC.
2. Insert a new crd79_syncrun row with status Running and crd79_watermarkbefore = watermark.
3. HTTP GET to https://student-label-system.vercel.app/api/sync/v1/students?since=<watermark>&limit=500
   Headers: Authorization: Bearer <stored in Azure Key Vault or environment variable>
4. Parse JSON body { students: [...], nextCursor, hasMore }.
5. Apply to each student:
   - List rows from crd79_student where crd79_studentid equals item studentId
   - If exists: Update row; else: Create row
   - Map fields: firstName→crd79_firstname, lastName→crd79_lastname, dob→crd79_dob, labelId→crd79_labelid, school→crd79_school, etc.
6. Loop while hasMore = true, passing nextCursor as query param.
7. Update crd79_syncrun: status Success/Partial/Failed, counts, watermarkafter = max sourcelastmodified from batch.
8. On failure: send email to district admins and set status Failed with errormessage.

Use alternate key upsert on crd79_studentid. Do not duplicate rows on re-run.
```

---

## Prompt 8 — Build secure sync API (Cursor / this repo)

Use when implementing the Next.js side with MongoDB + Vercel MCPs.

```text
In student-label-system, add machine-to-machine sync APIs for Power Automate:

1. Create src/lib/syncAuth.ts — validate Authorization: Bearer against process.env.SYNC_API_KEY; reject with 401 if missing/wrong.

2. Create src/app/api/sync/v1/students/route.ts:
   - GET only, sync auth required (not NextAuth session)
   - Query params: since (ISO), limit (default 500, max 1000), cursor (optional)
   - Return flattened DTO: studentId, labelId, firstName, lastName, dob, email, phone, gender, school, agencyId, fiscalYear, status, program, startDate, endDate, archived, intake fields, intakeVisits[], sourceMongoId, sourceLastModified
   - Filter records where updatedAt >= since OR createdAt >= since if updatedAt missing
   - Paginate with stable sort on _id
   - Never return password hashes or internal user secrets

3. Add updatedAt to student insert/update paths if missing.

4. Document required env vars: SYNC_API_KEY.

Use MongoDB MCP to verify collection schema before finalizing the DTO.
Match existing Next.js API route patterns in this repo.
```

---

## Field mapping reference (MongoDB → Dataverse)

| MongoDB (`students`) | Dataverse (`crd79_student`) |
|----------------------|----------------------------|
| `studentId` | `crd79_studentid` (alternate key) |
| `labelId` | `crd79_labelid` |
| `firstName` | `crd79_firstname` |
| `lastName` | `crd79_lastname` |
| `dob` | `crd79_dob` |
| `email` | `crd79_email` |
| `phone` | `crd79_phone` |
| `gender` | `crd79_gender` |
| `school` | `crd79_school` |
| `agencyId` | `crd79_agencyid` |
| `fiscalYear` | `crd79_fiscalyear` |
| `status` | `crd79_status` |
| `program` | `crd79_program` |
| `startDate` | `crd79_startdate` |
| `endDate` | `crd79_enddate` |
| `archived` | `crd79_archived` |
| `intakeStudentStatus` | `crd79_intakestudentstatus` |
| `educationStatus` | `crd79_educationstatus` |
| `placementClass` | `crd79_placementclass` |
| `notes` | `crd79_notes` |
| `siblingFlag` | `crd79_siblingflag` |
| `_id` | `crd79_sourcemongoid` |
| `updatedAt` / `createdAt` | `crd79_sourcelastmodified` |

### Intake visits (`intakeVisits[]` → `crd79_intakevisit`)

| MongoDB | Dataverse |
|---------|-----------|
| array index | `crd79_sourcevisitindex` |
| `date` | `crd79_visitdate` |
| `timeIn` | `crd79_timein` |
| `timeOut` | `crd79_timeout` |
| `isLeaving` | `crd79_isleaving` |
| `intakeSession` | `crd79_intakesession` |
| `intakeActivity[]` | `crd79_intakeactivity` (joined string) |
| `recordedBy.email` | `crd79_recordedbyemail` |
| `recordedBy.name` | `crd79_recordedbyname` |

---

## Environment variables (sync API)

```bash
# Vercel / .env.local — server-side only
SYNC_API_KEY=<long-random-secret>

# Power Automate — store in environment variable or Azure Key Vault
# Same value as SYNC_API_KEY, sent as: Authorization: Bearer <value>
```

---

## Suggested rollout order

1. ~~Connect **MongoDB MCP** and confirm `students` schema + whether `updatedAt` exists on all writes.~~  
   → See [mongodb-students-schema-audit.md](./mongodb-students-schema-audit.md).
2. ~~Add sync indexes + backfill `updatedAt`~~ — `npx tsx scripts/setup-students-sync.ts`
3. ~~Implement `/api/sync/v1/students`~~ — requires `SYNC_API_KEY` in env
4. Create Dataverse tables using **Prompts 1, 2, and 5**.
5. Build the Power Automate flow — see **[power-automate-nightly-sync.md](./power-automate-nightly-sync.md)** (HTTP action, upsert, pagination, error handling).  
   **Start here:** [power-automate-first-manual-test.md](./power-automate-first-manual-test.md) (manual HTTP test → one Dataverse row → pagination).
6. Run a manual test with 10 records before enabling the 2:00 AM schedule.
7. Add **Prompts 3, 4, 6** as needed for reference data and audit mirroring.
