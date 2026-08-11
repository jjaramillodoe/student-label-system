# Documentation project instructions

## About this project

- Mintlify docs for **Student Label System** (NYC Adult Education)
- MDX pages in `docs/` with YAML frontmatter
- Configuration: `docs/docs.json`
- Next.js in-app guide remains at `/docs` in the web app — this Mintlify site is the long-form external docs

## MCP servers (Cursor)

| Name | URL | Use |
| --- | --- | --- |
| `mintlify` | `https://mcp.mintlify.com` | Write access — edit pages, docs.json, open PRs (OAuth) |
| `mintlify-platform` | `https://mintlify.com/docs/mcp` | Read Mintlify component and config reference |
| `student-label-docs` | `https://docs.nycadultedlabels.nyc/mcp` | Search published docs |


Project MCP config: `.cursor/mcp.json`

Install Mintlify skill: `npm run docs:skill`

## Terminology

- Use **Label ID** and **Student ID** (not "barcode ID" alone)
- Student ID is ASISTS-aligned: `{LAST}{FIRST}{AGENCY}{D}{M}{YYYY}` (day/month unpadded). NEW from legacy match keeps the full ASISTS `externalId`
- Production geo wall: New York State only (`GEO_RESTRICT_NY`; default on when `VERCEL_ENV=production`). Bypasses `/api/cron/*`, `/api/sync*`, `/api/health`
- Auth security: credentials login forces MFA enrollment (`forceMfaSetup` → Profile); JWT `maxAge` 12h; `auth_events` + Admin → Security; lockout after 8 failures (~30m); email alerts on repeated failures / lockout / MFA disable / new user
- **Intake Member**, **Data Lead**, **Data Member**, **Admin** — capitalize roles
- **BE** / **ESL** — spell out on first use in a page when audience may be new

## Style

- Active voice, second person
- Sentence case headings
- Bold UI elements; code formatting for paths, IDs, and commands
- Link to `https://nycadultedlabels.nyc` for live app routes

## Content boundaries

- Document staff-facing workflows, not internal MongoDB schema
- Do not document secrets, `.env` values, or production credentials
- Age rules for intake: **16+** overall; BE/ESL **21** on birthday, or **near-eligible within 6 weeks** (submit allowed + eligibility notice). Birth year before **1920** needs admin confirmation. Farther under 21 → Pathways to Graduation ([p2g.nyc/contact](https://p2g.nyc/contact/))
- Intake duplicate UI: ASISTS gate first, then DOB panel with **% match** + **Same DOB**; DOB-only search must not match label-ID year fragments; sibling ack survives name edits
- Duplicate notify: **Copy alert message** / **Email with alert** use a structured Data Lead note (subject, school, reporter, NEW student, matches, `/admin/duplicates` link) — blank fields show as —
- Intake enforces **session start/end times**; Enrollment flags outside-session and handoff issues
- Archived returning students keep archive box location + QR — do **not** auto-assign a new drawer
- Intake success shows a **summary** (not single-label print); batch Avery 5163 / 94205 via **Download Word Doc** (Letter, 100%) from Dashboard, then **Yes — mark as printed**
- Dashboard **Needs label** = never printed (full print history for the school), not “created in last 7 days”
- Print history / stock consume only after staff confirm **Yes — mark as printed** (Word download alone does not clear Needs label)
- Duplicate **Merge** offers field-level choices, ~60s snackbar Undo + ~15m undo from Recent merges (`merge_history`); same-building bulk confirm/dismiss
- Duplicates **Legacy MDB import** tab (`?tab=legacy&school=`) reviews `school_legacy_roster` vs live students (garbage, ID conflicts, fuzzy/exact); CSV export per bucket; upload + quality summary on School Settings
- Idle session prompt is configurable in Admin System Settings (default 15 min idle + grace); client-side only
- Avery labels show **Last, First**, DOB, **5-digit print sequence**, Label ID barcode, and QR
- Drawers use capacity **100 / 200 / 400** or **Custom** (1–5000) with automatic **Section 01–08** (hidden from Intake; shown on Dashboard location and Cabinets)
- **Email Validation** and **MotherDuck Analytics** are Admin-only; in-app **Analytics** is Admin + Data Lead
- Do not document Cursor/MCP contributor setup in Mintlify (staff-facing docs only)
- Bulk upload preview validates duplicates/dates and supports per-row **Remove**; successful clean uploads redirect to Dashboard
- Real screenshots live in `docs/images/screenshots/`; see `contributors/screenshot-checklist.mdx`
- **Platform architecture** (stack, AWS deployment, Docker) belongs under **Contributors** — see `contributors/system-architecture.mdx` and `contributors/aws-deployment.mdx`. The long-form export for AWS lives in `docs/aws-deployment-architecture.md` (repo markdown, not staff-facing).
