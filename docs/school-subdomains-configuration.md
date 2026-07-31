# School subdomains — configuration guide

Use one app and one database. Each school gets an easy URL:

```text
https://school1.yourdomain.org
https://school8.yourdomain.org
https://yourdomain.org          ← district / Admin apex (optional)
```

Until you set `TENANT_ROOT_DOMAIN`, the app keeps working on the current host only (for example `https://student-label-system.vercel.app`). School isolation still comes from **user school assignment** and School Settings — subdomains are the portal URL layer.

You do **not** create a separate Vercel project per school. One deploy + one wildcard DNS record covers every school.

Mintlify copy of this guide: [School subdomains](https://district79.mintlify.app/contributors/school-subdomains) (after deploy).

---

## Checklist

- [ ] Own a domain (example: `yourdomain.org`)
- [ ] Add apex + wildcard DNS to Vercel
- [ ] Add domains in the Vercel project
- [ ] Set tenant env vars (including cookie domain)
- [ ] Set each school’s **Subdomain slug** in School Settings
- [ ] Smoke-test sign-in on a school host and on the apex
- [ ] Share portal URLs with each school

---

## 1. Choose the root domain

| Piece | Example |
| --- | --- |
| Root (apex) | `yourdomain.org` |
| School portal | `school1.yourdomain.org` |
| Optional www | `www.yourdomain.org` → redirect to apex |

The **slug** is only the first label (`school1`). It must match the value stored on the school record.

Reserved slugs (cannot be used): `www`, `app`, `api`, `admin`, `docs`, `auth`, `login`, `sso`, `staging`, `preview`, and similar.

---

## 2. DNS (one-time)

At your DNS provider (or Vercel DNS):

| Type | Name | Value |
| --- | --- | --- |
| A / CNAME | `@` (apex) | As shown in Vercel → Domains |
| CNAME | `www` | `cname.vercel-dns.com` (or Vercel’s value) |
| CNAME | `*` (wildcard) | `cname.vercel-dns.com` (or Vercel’s value) |

**Wildcard `*.yourdomain.org` is required.** Without it, each new school would need its own DNS record.

Wait for DNS to propagate (often minutes; sometimes up to 24–48 hours).

---

## 3. Vercel domains (one-time)

In the Vercel project for Student Label System:

1. Open **Settings → Domains**
2. Add:
   - `yourdomain.org`
   - `www.yourdomain.org` (optional redirect to apex)
   - `*.yourdomain.org` (wildcard)
3. Complete any DNS verification Vercel requests
4. Confirm TLS certificates show as valid

You do **not** add `school1.yourdomain.org` one-by-one when using a wildcard.

---

## 4. Environment variables

Set these in **Vercel → Settings → Environment Variables** (Production; Preview if you test custom domains there). Also mirror them in local `.env` when testing.

```bash
# Required for subdomain routing
TENANT_ROOT_DOMAIN=yourdomain.org
NEXT_PUBLIC_TENANT_ROOT_DOMAIN=yourdomain.org

# Share login session across school1.yourdomain.org and yourdomain.org
# Leading dot is required
NEXTAUTH_COOKIE_DOMAIN=.yourdomain.org

# Apex URL for NextAuth (not a school subdomain)
NEXTAUTH_URL=https://yourdomain.org

# Canonical public URL (emails / QR if needed)
NEXT_PUBLIC_APP_URL=https://yourdomain.org
```

| Variable | Purpose |
| --- | --- |
| `TENANT_ROOT_DOMAIN` | Server-side host parsing (`school1.` + this value) |
| `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` | Shown in School Settings UI examples |
| `NEXTAUTH_COOKIE_DOMAIN` | Lets the session cookie work on all school subdomains |
| `NEXTAUTH_URL` | Canonical auth base URL (use the **apex**) |

After changing cookie or auth URL vars, redeploy and have users sign in again (old cookies may be host-scoped).

Leave these unset (or blank) to stay on single-host mode (Vercel default URL only).

See also `.env.example` in the repo root.

---

## 5. School Settings — subdomain slug

1. Sign in as **Admin**
2. Go to **Admin → Schools** (`/admin/schools`)
3. Edit each school
4. Set **Subdomain slug**, for example:

| School name | Suggested slug | Portal URL |
| --- | --- | --- |
| School 1 | `school1` | `https://school1.yourdomain.org` |
| School 8 | `school8` | `https://school8.yourdomain.org` |
| District 79 | `district79` | `https://district79.yourdomain.org` |

Rules:

- Lowercase letters, numbers, hyphens only
- Unique across schools
- 2–48 characters
- Built-in schools default to `school1`…`school8` and `district79` when no custom slug is saved yet

Save the school. The slug is what the hostname must use.

---

## 6. How the app behaves

| Host | Behavior |
| --- | --- |
| `yourdomain.org` / `www` / current `*.vercel.app` | **Apex mode** — no school forced by URL; Admin can manage all schools |
| `school8.yourdomain.org` | **School portal** — sign-in shows school name; banner shows portal school |
| Unknown slug (e.g. `xyz.yourdomain.org`) | Warning: subdomain not linked to an active school |
| User assigned to School 1 on `school8.…` | Wrong-school banner (Admins are not blocked) |

Security still uses the user’s assigned school in the session/API. The subdomain does **not** replace role or school checks.

Public QR pages (`/student/…`, `/archive/box/…`) keep working on any host that reaches the app. Prefer one canonical host in printed QR URLs if you want stable links forever (`NEXT_PUBLIC_APP_URL`).

---

## 7. Smoke tests

After DNS + env + slugs:

1. Open `https://yourdomain.org/auth/signin` — district sign-in
2. Open `https://school1.yourdomain.org/auth/signin` — should show **School 1**
3. Sign in as a School 1 Data Lead on `school1.…` — portal banner should appear
4. Sign in as that same user on `school8.…` — should see **Wrong school portal**
5. Sign in as Admin on either host — should work
6. Confirm MFA still works on the school host

---

## 8. What to tell each school

```text
Your Student Label System portal:

  https://school8.yourdomain.org

Sign in with your DOE email, password, and MFA authenticator code.
Bookmark this URL. Do not use another school's subdomain.
```

---

## 9. Local development

Subdomains are usually **off** locally (`localhost` does not match `TENANT_ROOT_DOMAIN`).

Optional local test:

1. Add to `/etc/hosts`:

   ```text
   127.0.0.1 school1.localhost
   ```

2. Set:

   ```bash
   TENANT_ROOT_DOMAIN=localhost
   NEXT_PUBLIC_TENANT_ROOT_DOMAIN=localhost
   NEXTAUTH_URL=http://localhost:3000
   ```

   (Often skip `NEXTAUTH_COOKIE_DOMAIN` on localhost.)

3. Visit `http://school1.localhost:3000` (Chrome usually supports `*.localhost`)

For most day-to-day work, keep local env without tenant vars and use `http://localhost:3000`.

---

## 10. Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| School URL does not resolve | Wildcard DNS or Vercel `*.domain` missing |
| Sign-in works on apex but not on school host | Set `NEXTAUTH_COOKIE_DOMAIN=.yourdomain.org` and redeploy |
| “Unknown school portal” | Slug in School Settings ≠ hostname label |
| Session drops when switching school ↔ apex | Cookie domain missing or wrong (needs leading `.`) |
| Still only works on vercel.app | Env vars not set in Vercel Production, or deploy not finished |
