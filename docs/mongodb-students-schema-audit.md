# MongoDB MCP Setup & Students Schema Audit

Step 1 of the [Power Platform sync rollout](./power-platform-sync-prompts.md): connect MongoDB MCP and confirm the `students` collection schema, including `updatedAt` coverage.

**Audit date:** 2026-05-31  
**Database:** `student-label`  
**Collection:** `students`

---

## MongoDB MCP connection (do this in Cursor)

The MongoDB MCP server reads **`MDB_MCP_CONNECTION_STRING`** from the environment when Cursor starts the MCP process.

### Quick setup (automated)

From the project root:

```bash
./scripts/setup-mongodb-mcp-env.sh
```

This copies `MONGODB_URI` from `.env` / `.env.local` into `~/.mcp-env`, sets read-only mode, and adds `source ~/.mcp-env` to `~/.zshrc` if missing.

Verify in a **new terminal**:

```bash
env | grep "^MDB_MCP" | sed '/^MDB_MCP_READ_ONLY=/!s/=.*/=[set]/'
```

Expected:

```text
MDB_MCP_CONNECTION_STRING=[set]
MDB_MCP_READ_ONLY=true
```

### Manual setup (same result)

1. Create `~/.mcp-env`:

```bash
export MDB_MCP_CONNECTION_STRING="<same value as MONGODB_URI>"
export MDB_MCP_READ_ONLY="true"
chmod 600 ~/.mcp-env
```

2. Add to `~/.zshrc`:

```bash
source ~/.mcp-env
```

### Restart Cursor so MCP picks up the variables

**Important on macOS:** If you open Cursor from the Dock, it may **not** inherit `~/.zshrc`. Use one of these:

| Method | What to do |
|--------|------------|
| **A — Launch from terminal (recommended)** | Quit Cursor fully (`Cmd+Q`). In Terminal: `source ~/.zshrc` then `cursor /Users/javierjaramillo/projects/adulted-printing` |
| **B — Cursor MCP settings** | **Cursor Settings → MCP → mongodb** → add env vars `MDB_MCP_CONNECTION_STRING` and `MDB_MCP_READ_ONLY=true` in the server config UI |

After restart, ask the agent: *“Use MongoDB MCP collection-schema on student-label.students”* to confirm it works.

### Option B — Atlas service account (optional)

Use only if you need Atlas Admin API. See [MongoDB MCP prerequisites](https://www.mongodb.com/docs/mcp-server/prerequisites/).

### After MCP is connected

In Cursor, ask the agent to run:

- `collection-schema` on `student-label.students`
- `collection-indexes` on `student-label.students`
- `find` with `{ updatedAt: { $exists: false } }` limit 5 (spot-check legacy rows)

---

## Local schema audit (completed)

Run anytime without MCP:

```bash
cd student-label-system
npx tsx scripts/inspect-students-schema.ts
```

Script: [`scripts/inspect-students-schema.ts`](../scripts/inspect-students-schema.ts)

---

## Findings summary

### Document counts

| Metric | Value |
|--------|------:|
| Total students | 4,364 |
| With `updatedAt` | 1,601 (36.7%) |
| Without `updatedAt` | 2,763 (63.3%) |
| With `createdAt` | 4,364 (100%) |

### `updatedAt` — partial coverage

| Code path | Sets `updatedAt`? |
|-----------|---------------------|
| `POST /api/students` (new intake) | **No** — only `createdAt` |
| `PUT /api/students/[id]` | Yes |
| Bulk upload | Yes |
| Archive / bulk-move | Yes |

**Implication for overnight sync:** Delta queries must use:

```javascript
{ $or: [
  { updatedAt: { $gte: since } },
  { updatedAt: { $exists: false }, createdAt: { $gte: since } }
]}
```

Or run a one-time backfill to set `updatedAt = createdAt` on legacy rows, then add `updatedAt` on insert going forward.

### Top-level fields (from 100-doc sample + full collection counts)

**Always present (core identity & placement):**

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Internal; map to `crd79_sourcemongoid` in Dataverse |
| `firstName` | string | |
| `lastName` | string | |
| `dob` | string | ISO date string |
| `studentId` | string | **Alternate key** for Dynamics upsert |
| `labelId` | string | Barcode on physical label |
| `agencyId` | string | e.g. R01 |
| `school` | string | e.g. School 8 |
| `fiscalYear` | string | e.g. 2025-2026 |
| `status` | string | |
| `startDate` | string | |
| `endDate` | null \| string | Often null |
| `email` | null \| string | |
| `archived` | boolean | |
| `createdAt` | string | ISO timestamp |

**Common on archived records (~59% in sample):**

| Field | Type |
|-------|------|
| `archiveBoxId` | string |
| `archiveBoxLabel` | string |
| `archiveId` | string |
| `archiveLocation` | string |
| `archiveSchoolYear` | string |
| `archivedAt` | string |
| `updatedAt` | string |

**Physical file location (when assigned):**

| Field | Type |
|-------|------|
| `cabinet` | string (ObjectId as string) |
| `drawer` | string |

**Intake fields (present on intake-created records — sparse in production DB):**

| Field | Docs with field | Notes |
|-------|----------------:|-------|
| `createdBy` | 1 | New intake path only so far |
| `intakeStudentStatus` | 1 | |
| `educationStatus` | 1 | |
| `intakeActivity` | 1 | string[] |
| `placementClass` | 1 | |
| `timeIn` | 1 | |
| `timeOut` | 1 | |
| `isLeaving` | 1 | |
| `intakeVisits` | 1 | Child table for Dynamics |
| `gender` | 1 | |
| `phone` | — | Collected on Intake, Dashboard add/edit, and bulk CSV upload |

| `program` | 0 | |
| `notes` | 0 | |
| `intakeSession` | 0 | |
| `originalStartDate` | 0 | |
| `otherNote` | 0 | |
| `siblingFlag` | 0 | |

### `intakeVisits[]` sub-document shape

```typescript
{
  date?: string;           // ISO
  timeIn?: string;
  timeOut?: string | null;
  isLeaving?: string | null;
  intakeSession?: string | null;
  intakeActivity?: string[];
  recordedBy?: { name: string; email: string };
}
```

Maps to Dataverse `crd79_intakevisit` child table (see [power-platform-sync-prompts.md](./power-platform-sync-prompts.md)).

### Latest record (sanity check)

- **Latest `updatedAt`:** 2026-05-30T00:21:20.617Z  
- **Same record `createdAt`:** 2026-05-29T22:47:23.864Z  
- Confirms edits after create populate `updatedAt` correctly.

---

## Recommended indexes for sync API

Not yet verified on cluster — create after MCP connect:

```javascript
// Delta sync by modified time
db.students.createIndex({ updatedAt: 1, _id: 1 })

// Fallback for legacy rows without updatedAt
db.students.createIndex({ createdAt: 1, _id: 1 })

// Upsert lookup (already likely used by app)
db.students.createIndex({ studentId: 1 }, { unique: true, sparse: true })
db.students.createIndex({ labelId: 1 }, { sparse: true })
```

---

## Next steps

1. ~~**You:** Add `MDB_MCP_CONNECTION_STRING` to `~/.mcp-env` and restart Cursor.~~ Done
2. ~~**Agent:** Re-run `collection-schema` + `collection-indexes` via MongoDB MCP to confirm indexes.~~ Done — 5 indexes including sync indexes
3. ~~**Code:** Backfill `updatedAt` on legacy docs + set on `POST /api/students` insert.~~ Done — see `scripts/setup-students-sync.ts`
4. ~~**Code:** Implement `/api/sync/v1/students` ([Prompt 8](./power-platform-sync-prompts.md#prompt-8--build-secure-sync-api-cursor--this-repo)).~~ Done

### Sync API usage

**Production is live** at [student-label-system.vercel.app](https://student-label-system.vercel.app/api/sync/v1/students).

- `SYNC_API_KEY` is set in **Vercel → student-label-system → Settings → Environment Variables**
- Local copy (gitignored): **`.sync-api-key.local`** — use this value in Power Automate `stlabel_SyncApiKey`

For local dev, also add to `.env.local`:

```bash
SYNC_API_KEY=<same value as .sync-api-key.local>
```

```bash
curl -s -H "Authorization: Bearer $SYNC_API_KEY" \
  "http://localhost:3000/api/sync/v1/students?since=2026-01-01T00:00:00.000Z&limit=10"

# Production (Vercel)
curl -s -H "Authorization: Bearer $SYNC_API_KEY" \
  "https://student-label-system.vercel.app/api/sync/v1/students?since=2026-01-01T00:00:00.000Z&limit=10"
```

Response shape: `{ students, hasMore, nextCursor, since, count }`
