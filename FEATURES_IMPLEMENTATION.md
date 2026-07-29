# Features — Current Status

Last updated: July 2026. This file replaces the older in-progress checklist (many items below were already shipped).

## Shipped

| Area | Status |
| --- | --- |
| Auth (credentials, MFA, force password change, roles) | Done |
| Dashboard search, filters, saved searches, barcode/QR scan | Done |
| Student CRUD, bulk CSV upload, dual Label/Student IDs | Done |
| Intake (NEW / RETURNING), duplicates, Geoclient, session hours | Done |
| Intake success = **summary** (not one-off label print) | Done |
| Avery **5163 / 94205** via **Download Word Doc** on **Letter** | Done |
| Brother QL layouts via browser print (when used) | Done |
| Print history / print queue | Done |
| Cabinets, drawers, cabinet health, unassigned, bulk move | Done |
| Archive boxes + public box/student QR pages | Done |
| School year rollover checklist | Done |
| Duplicates & siblings admin | Done |
| Enrollment dashboard, activity / audit, reports | Done |
| Label stock tracking | Done |
| Email validation (EmailAwesome) | Done |
| Power Automate / Dataverse sync API | Done |
| ThoughtSpot embed (env-gated) | Done |
| In-app `/docs` + Mintlify docs site | Done |

## Not planned unless requested

- Student photos on labels
- Drag-and-drop custom label designer
- Scheduled / queued batch printing jobs
- Email notifications (low stock, handoffs)
- DOE SSO (credentials + MFA only today)

## Print reminder (staff)

1. Intake registers / logs visits → success **summary** only.
2. Dashboard / Print Queue: select students → print preview → **Download Word Doc**.
3. Intake History: **Word Doc** downloads a single-student Avery sheet the same way.
4. Print from Word on **Letter (8.5"×11")**, scale **100%**, margins **None**.
5. Brother / Avery 5160 layouts still use browser Print (grouped under “Other” in the layout dropdown).

## Integrity notes (Phase 4)

- Phone is collected on Intake, Dashboard add/edit, and bulk CSV.
- `src/middleware.ts` requires a session for non-public routes; `/student`, `/archive`, health, and sync stay public.
- Address batch verify reports remaining unverified count (run again in batches of 50).
- School Year rollover flags partial cabinets as Review and scopes Admin fiscal-year settings to District 79 / first config.
