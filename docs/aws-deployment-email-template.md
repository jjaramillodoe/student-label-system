# Cover Email — AWS EC2 Deployment Support Request

Copy the subject and body below when sending `aws-deployment-architecture.md` to AWS Solutions Architects, AWS Support, or your DOE cloud team.

---

## Subject line options

Pick one:

```
Request: Architecture review & EC2 deployment guidance — Next.js app + MongoDB (District 79 Student Label System)
```

```
AWS EC2 + Docker Compose deployment — Student Label System (monolith, MongoDB, HTTPS)
```

---

## Email body

```
Hello,

I'm reaching out for help planning a production deployment of our internal web application on Amazon EC2. We are moving off Vercel and need guidance on the right AWS setup — ideally using Docker and Docker Compose on a single EC2 instance to start, with room to scale later if needed.

Application summary
• Name: Student Label System (District 79 Adult Education)
• Type: Monolithic Next.js 16 application (Node.js 20) — UI and REST API in one process
• Database: MongoDB (database name: student-label) — currently on MongoDB Atlas; open to Atlas + VPC peering or self-managed MongoDB on AWS
• Current production URL: https://nycadultedlabels.nyc
• Repository: jjaramillodoe/student-label-system (private; architecture doc attached)

What the app does
The system manages student records, physical file placement (cabinets/drawers/archive boxes), label printing, intake workflows, and admin reporting for adult education programs. It is used by Admins, Data Leads, and Data Members across multiple schools.

Key integration
Microsoft Power Automate calls our sync API nightly to export student changes for Dynamics/Dataverse:
  GET /api/sync/v1/students
  Authorization: Bearer <SYNC_API_KEY>

What we need help with
1. Recommended EC2 instance size and architecture for a low-to-moderate traffic internal app (~4,400 student records, ~10 users)
2. Best approach for HTTPS — ALB + ACM vs Nginx on EC2
3. Whether to keep MongoDB Atlas (with VPC peering) or move to self-managed MongoDB on EC2/EBS
4. Security group design and secrets management (Secrets Manager / SSM)
5. ALB health check configuration (we expose GET /api/health and GET /api/health/deep)
6. Any DOE/compliance considerations we should plan for (WAF, private subnets, etc.)

What we've prepared
• Architecture document (attached): aws-deployment-architecture.md
• Dockerfile and docker-compose.yml in the repository
• Health endpoints for liveness/readiness monitoring
• Environment variable inventory and network requirements documented

Proposed starting topology
Internet → ALB (HTTPS) → EC2 (Docker Compose) → Next.js container :3000
                                              → MongoDB Atlas (or EC2 MongoDB)

We are not looking for a full managed rebuild — we want to containerize the existing app and run it reliably on AWS with minimal changes to the codebase.

Happy to schedule a call to walk through the architecture diagram or answer questions about integrations.

Thank you,

[Your name]
[Title / Team — District 79 Adult Education / DOE]
[Email]
[Phone — optional]
```

---

## Attachments checklist

When sending, attach or link:

- [ ] `docs/aws-deployment-architecture.md` (primary)
- [ ] Optional: `Dockerfile`, `docker-compose.yml` (if they want implementation detail)

---

## Short version (Slack / quick intro)

```
We're migrating a Next.js + MongoDB monolith (Student Label System) from Vercel to EC2 with Docker Compose. ~4.4k student records, NextAuth, Power Automate sync to Dynamics. Attached architecture doc — looking for EC2 sizing, ALB/ACM vs Nginx, and MongoDB (Atlas vs self-hosted) recommendations.
```

---

## Follow-up questions to expect from AWS

Be ready to answer:

| Question | Your answer (fill in) |
|----------|------------------------|
| Expected concurrent users? | ~___ |
| Peak usage times? | e.g. intake periods, start of school year |
| RTO / RPO requirements? | e.g. 24h acceptable / backups daily |
| Must data stay in a specific region? | e.g. us-east-1 |
| IP allowlisting required? | DOE network only? VPN? |
| Budget range? | $___ / month |
| Timeline for cutover? | e.g. Q3 2026 |

---

*Companion to [aws-deployment-architecture.md](./aws-deployment-architecture.md)*
