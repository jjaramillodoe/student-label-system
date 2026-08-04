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
- Age rule for intake: **21 years old** (on birthday) for BE/ESL — under-21 → Pathways to Graduation ([p2g.nyc/contact](https://p2g.nyc/contact/))
- Intake enforces **session start/end times**; Enrollment flags outside-session and handoff issues
- Archived returning students keep archive box location + QR — do **not** auto-assign a new drawer
- Intake success shows a **summary** (not single-label print); batch Avery 5163 / 94205 via **Download Word Doc** (Letter, 100%) from Dashboard
- Avery labels show **Last, First**, DOB, **5-digit print sequence**, Label ID barcode, and QR
- Drawers use capacity **100 / 200 / 400** with automatic **Section 01–08** (hidden from Intake; shown on Dashboard location and Cabinets)
- Bulk upload preview validates duplicates/dates and supports per-row **Remove**; successful clean uploads redirect to Dashboard
- Real screenshots live in `docs/images/screenshots/`; see `contributors/screenshot-checklist.mdx`
- **Platform architecture** (stack, AWS deployment, Docker) belongs under **Contributors** — see `contributors/system-architecture.mdx` and `contributors/aws-deployment.mdx`. The long-form export for AWS lives in `docs/aws-deployment-architecture.md` (repo markdown, not staff-facing).
