# Power Automate — First Manual Test (Step by Step)

Test the live sync API before building the full nightly flow.

**Production endpoint:** `https://nycadultedlabels.nyc/api/sync/v1/students`  
**API key:** copy from `student-label-system/.sync-api-key.local` (gitignored)

Do this in **three phases** — stop after each phase and confirm the run succeeds.

---

## Phase 1 — HTTP only (≈10 minutes)

Goal: prove Power Automate can call your API and parse the response. **No Dataverse yet.**

### 1. Create a test flow

1. Open [make.powerautomate.com](https://make.powerautomate.com)
2. **Create → Instant cloud flow**
3. Name: `TEST Student Label Sync HTTP`
4. Trigger: **Manually trigger a flow**
5. Add input (optional but useful):
   - **Add an input → Text** → Display name: `Since date` → Default: `2026-05-29T00:00:00.000Z`

### 2. Add HTTP action

**+ New step → HTTP** (Premium connector)

| Field | Value |
|-------|-------|
| Method | `GET` |
| URI | See below |
| Headers | `Authorization` and `Accept` |

**URI** (paste in **Expression** tab):

```text
concat(
  'https://nycadultedlabels.nyc/api/sync/v1/students?since=',
  uriComponent(coalesce(triggerBody()?['text'], '2026-05-29T00:00:00.000Z')),
  '&limit=10'
)
```

If you skipped the trigger input, use this fixed URI instead:

```text
https://nycadultedlabels.nyc/api/sync/v1/students?since=2026-05-29T00:00:00.000Z&limit=10
```

**Headers:**

| Key | Value |
|-----|-------|
| `Authorization` | `Bearer YOUR_KEY_HERE` *(paste from `.sync-api-key.local` for v1 — swap to env var in Phase 3)* |
| `Accept` | `application/json` |

> **Tip:** For the first test, hardcoding the Bearer token is fine. Move it to an **Environment variable** (secret) before production.

### 3. Parse JSON

**+ New step → Parse JSON**

- **Content:** Body from HTTP
- **Schema:** Generate from sample:

```json
{
  "students": [
    {
      "studentId": "JARAMILLOJAVIEREUGENIOR0820260529",
      "labelId": "2026-JJ-0000001",
      "firstName": "Javier",
      "lastName": "Jaramillo",
      "dob": "1990-01-15",
      "email": null,
      "phone": null,
      "gender": null,
      "school": "District 79",
      "agencyId": "R08",
      "fiscalYear": "2025-2026",
      "status": "Active",
      "program": null,
      "startDate": "2026-01-01",
      "endDate": null,
      "archived": false,
      "intakeStudentStatus": null,
      "educationStatus": null,
      "placementClass": null,
      "notes": null,
      "siblingFlag": false,
      "intakeVisits": [],
      "sourceMongoId": "6a1a177b4368ee9a30170743",
      "sourceLastModified": "2026-05-30T00:21:20.617Z"
    }
  ],
  "hasMore": true,
  "nextCursor": "eyJ...",
  "since": "2026-05-29T00:00:00.000Z",
  "count": 10
}
```

### 4. Run and verify

1. **Save** the flow
2. Click **Test → Manually → Test**
3. Run the flow

**Success looks like:**

| Step | Status | What to check |
|------|--------|----------------|
| HTTP | Green | Status code **200** |
| Parse JSON | Green | `count` > 0, `students` array populated |
| Run history | Succeeded | Expand HTTP → Body shows JSON |

**Common failures:**

| HTTP code | Fix |
|-----------|-----|
| 401 | Wrong Bearer token — re-copy from `.sync-api-key.local` |
| 404 | Old deployment — confirm URL is exactly `nycadultedlabels.nyc` |
| 403 / blocked | Your org may block HTTP connector — ask admin to allow **HTTP with Microsoft Entra ID** or premium HTTP |

---

## Phase 2 — Upsert one student to Dataverse (≈15 minutes)

Goal: write **one row** from the API into Dataverse. Requires `crd79_student` table (see [power-platform-sync-prompts.md](./power-platform-sync-prompts.md) Prompt 1).

### Prerequisites

- Table `crd79_student` exists
- Alternate key on **`crd79_studentid`**
- Your account can **create/update** rows in that table

### 1. Add Apply to each

After **Parse JSON**, add:

**Apply to each** → select: `body('Parse_JSON')?['students']`

### 2. Upsert inside the loop

**Option A — Upsert a row** (if your Dataverse connector shows it):

- Table: `District79 Students` / `crd79_student`
- Alternate key: `crd79_studentid`
- Key value: `items('Apply_to_each')?['studentId']`

Map at minimum:

| Dataverse | Expression |
|-----------|------------|
| `crd79_studentid` | `items('Apply_to_each')?['studentId']` |
| `crd79_labelid` | `items('Apply_to_each')?['labelId']` |
| `crd79_firstname` | `items('Apply_to_each')?['firstName']` |
| `crd79_lastname` | `items('Apply_to_each')?['lastName']` |
| `crd79_dob` | `items('Apply_to_each')?['dob']` |
| `crd79_school` | `items('Apply_to_each')?['school']` |
| `crd79_sourcelastmodified` | `items('Apply_to_each')?['sourceLastModified']` |
| `crd79_lastsyncedat` | `utcNow()` |
| `crd79_sourcesystem` | `StudentLabelSystem` |

**Option B — List + Condition + Update/Add:**

1. **List rows** where `crd79_studentid eq '@{items('Apply_to_each')?['studentId']}'`
2. **Condition:** length of value > 0
3. **If yes:** Update row  
4. **If no:** Add a new row  

(Same field map as above.)

### 3. Run and verify

1. **Test** the flow again (same `since` date)
2. Open **Power Apps** or **make.powerapps.com** → Tables → `crd79_student`
3. Confirm rows appeared with matching `crd79_studentid` and `crd79_lastsyncedat` ≈ now

**Re-run safety:** Upsert by `studentId` should **update** existing rows, not duplicate them.

---

## Phase 3 — Pagination smoke test (≈5 minutes)

Goal: confirm `hasMore` / `nextCursor` work before the overnight schedule.

### 1. Change limit

In the HTTP URI, set `limit=2` (small page size).

### 2. Add a second HTTP inside Do until (optional mini-loop)

For a quick test without a full loop:

1. Run flow once — note `nextCursor` in Parse JSON output
2. Manually run again with URI:

```text
concat(
  'https://nycadultedlabels.nyc/api/sync/v1/students?since=2026-05-29T00:00:00.000Z&limit=2&cursor=',
  uriComponent('PASTE_CURSOR_FROM_RUN_1')
)
```

3. Confirm the second page returns **different** `studentId` values

When ready, build the full **Do until** loop from [power-automate-nightly-sync.md](./power-automate-nightly-sync.md).

---

## Phase 4 — Promote to production flow

1. Duplicate the test flow → rename `Student Label → Dynamics Nightly Sync`
2. Change trigger to **Recurrence** (2:00 AM Eastern)
3. Replace hardcoded Bearer token with env var **`stlabel_SyncApiKey`**
4. Replace hardcoded base URL with **`stlabel_SyncApiBaseUrl`**
5. Add watermark read/write from `crd79_syncrun` (see full doc)
6. Set `limit=500`
7. Turn off **Test** mode; leave flow **On**

---

## Recommended first-run values

| Parameter | Value | Why |
|-----------|-------|-----|
| `since` | `2026-05-29T00:00:00.000Z` | Small delta (recent changes only) |
| `limit` | `10` | Easy to inspect in Dataverse |
| Trigger | Manual | Safe first test |

Later nightly runs use the **watermark** from `crd79_syncrun.crd79_watermarkafter`.

---

## Environment variables (before production)

| Name | Value |
|------|-------|
| `stlabel_SyncApiBaseUrl` | `https://nycadultedlabels.nyc` |
| `stlabel_SyncApiKey` | *(contents of `.sync-api-key.local`)* |

Create in **Power Platform admin center → Environment → Environment variables**, add to your **solution**, then reference in the HTTP header:

```text
Bearer @{parameters('stlabel_SyncApiKey (your_solution_prefix)')}
```

---

## Checklist

- [ ] Phase 1: HTTP 200 + Parse JSON succeeds
- [ ] Phase 2: At least one row in `crd79_student`
- [ ] Phase 2: Re-run updates same row (no duplicate)
- [ ] Phase 3: Second page with `cursor` returns different students
- [ ] Phase 4: Recurrence + env vars + sync run logging

---

## Need help?

If a step fails, capture from **Run history**:

1. HTTP **Status code** and **Body**
2. Dataverse action **Error message**
3. The `since` and `limit` you used

Full nightly flow: [power-automate-nightly-sync.md](./power-automate-nightly-sync.md)
