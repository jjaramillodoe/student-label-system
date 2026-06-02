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
| `student-label-docs` | `https://YOUR-SUBDOMAIN.mintlify.app/mcp` | Search published docs (add after Mintlify deploy) |

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
- Link to `https://student-label-system.vercel.app` for live app routes

## Content boundaries

- Document staff-facing workflows, not internal MongoDB schema
- Do not document secrets, `.env` values, or production credentials
- Age rule for intake: 21 years and 1 month for BE/ESL
- **Platform architecture** (stack, AWS deployment, Docker) belongs under **Contributors** — see `contributors/system-architecture.mdx` and `contributors/aws-deployment.mdx`. The long-form export for AWS lives in `docs/aws-deployment-architecture.md` (repo markdown, not staff-facing).
