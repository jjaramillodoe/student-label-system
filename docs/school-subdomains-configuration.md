# School subdomains — configuration guide

Use one app and one database. Each school gets an easy URL:

```text
https://school1.nycadultedlabels.nyc
https://school8.nycadultedlabels.nyc
https://nycadultedlabels.nyc          ← district / Admin apex
```

Production root domain: **`nycadultedlabels.nyc`**.

Legacy Vercel host (`https://student-label-system.vercel.app`) remains available. School isolation still comes from **user school assignment** and School Settings — subdomains are the portal URL layer.

You do **not** create a separate Vercel project per school. One deploy + one wildcard DNS record covers every school.

Mintlify copy of this guide: [School subdomains](https://district79.mintlify.app/contributors/school-subdomains) (after deploy).

---

## Checklist

- [x] Own domain: `nycadultedlabels.nyc` (Vercel Registrar)
- [x] Add apex + www + wildcard to the **student-label-system** Vercel project
- [x] Set tenant env vars (including cookie domain) and redeploy
- [ ] Set each school’s **Subdomain slug** in School Settings
- [ ] Smoke-test sign-in on a school host and on the apex
- [ ] Share portal URLs with each school
- [ ] Update Microsoft Entra redirect URI (if SSO is enabled):  
      `https://nycadultedlabels.nyc/api/auth/callback/azure-ad`

---

## 1. Root domain

| Piece | Value |
| --- | --- |
| Root (apex) | `nycadultedlabels.nyc` |
| School portal | `school1.nycadultedlabels.nyc` |
| Optional www | `www.nycadultedlabels.nyc` → redirect to apex |

The **slug** is only the first label (`school1`). It must match the value stored on the school record.

Reserved slugs (cannot be used): `www`, `app`, `api`, `admin`, `docs`, `auth`, `login`, `sso`, `staging`, `preview`, and similar.

---

## 2. DNS (one-time)

Domain is registered with Vercel DNS. Expected records:

| Type | Name | Value |
| --- | --- | --- |
| ALIAS / A | `@` (apex) | Vercel (`cname.vercel-dns-*.com` or as shown in Domains) |
| CNAME / ALIAS | `*` (wildcard) | Vercel |
| CNAME | `www` | Vercel (redirect to apex recommended) |

**Wildcard `*.nycadultedlabels.nyc` is required.** Without it, each new school would need its own DNS record.

Wait for DNS / nameserver propagation if the domain was just purchased (often minutes; sometimes up to 24–48 hours).

---

## 3. Vercel domains (one-time)

In the Vercel project **student-label-system** (team District 79 Dev):

1. Open **Settings → Domains**
2. Add:
   - `nycadultedlabels.nyc`
   - `www.nycadultedlabels.nyc` (redirect to apex)
   - `*.nycadultedlabels.nyc` (wildcard)
3. Complete any DNS verification Vercel requests
4. Confirm TLS certificates show as valid

CLI (from the app directory):

```bash
vercel domains add nycadultedlabels.nyc student-label-system --scope district-79-dev
vercel domains add www.nycadultedlabels.nyc student-label-system --scope district-79-dev
vercel domains add '*.nycadultedlabels.nyc' student-label-system --scope district-79-dev
```

You do **not** add `school1.nycadultedlabels.nyc` one-by-one when using a wildcard.

---

## 4. Environment variables

Set these in **Vercel → Settings → Environment Variables** (Production; Preview if you test custom domains there). Also mirror them in local `.env` when testing.

```bash
# Required for subdomain routing
TENANT_ROOT_DOMAIN=nycadultedlabels.nyc
NEXT_PUBLIC_TENANT_ROOT_DOMAIN=nycadultedlabels.nyc

# Share login session across school1.nycadultedlabels.nyc and nycadultedlabels.nyc
# Leading dot is required
NEXTAUTH_COOKIE_DOMAIN=.nycadultedlabels.nyc

# Apex URL for NextAuth (not a school subdomain)
NEXTAUTH_URL=https://nycadultedlabels.nyc

# Canonical public URL (emails / QR)
NEXT_PUBLIC_APP_URL=https://nycadultedlabels.nyc
```

| Variable | Purpose |
| --- | --- |
| `TENANT_ROOT_DOMAIN` | Server-side host parsing (`school1.` + this value) |
| `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` | Shown in School Settings UI examples |
| `NEXTAUTH_COOKIE_DOMAIN` | Lets the session cookie work on all school subdomains |
| `NEXTAUTH_URL` | Canonical auth base URL (use the **apex**) |

After changing cookie or auth URL vars, redeploy and have users sign in again (old cookies may be host-scoped).

CLI (non-interactive overwrite):

```bash
SCOPE=(--scope district-79-dev)
for env in production preview; do
  vercel env add TENANT_ROOT_DOMAIN "$env" --value nycadultedlabels.nyc --force --yes $SCOPE
  vercel env add NEXT_PUBLIC_TENANT_ROOT_DOMAIN "$env" --value nycadultedlabels.nyc --force --yes --no-sensitive $SCOPE
  vercel env add NEXTAUTH_COOKIE_DOMAIN "$env" --value .nycadultedlabels.nyc --force --yes $SCOPE
  vercel env add NEXTAUTH_URL "$env" --value https://nycadultedlabels.nyc --force --yes $SCOPE
  vercel env add NEXT_PUBLIC_APP_URL "$env" --value https://nycadultedlabels.nyc --force --yes --no-sensitive $SCOPE
done
vercel --prod --scope district-79-dev
```

See also `.env.example` in the repo root.

---

## 5. School Settings — subdomain slug

1. Sign in as **Admin**
2. Go to **Admin → Schools** (`/admin/schools`)
3. Edit each school
4. Set **Subdomain slug**, for example:

| School name | Suggested slug | Portal URL |
| --- | --- | --- |
| School 1 | `school1` | `https://school1.nycadultedlabels.nyc` |
| School 8 | `school8` | `https://school8.nycadultedlabels.nyc` |
| District 79 | `district79` | `https://district79.nycadultedlabels.nyc` |

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
| `nycadultedlabels.nyc` / `www` / legacy `*.vercel.app` | **Apex mode** — no school forced by URL; Admin can manage all schools |
| `school8.nycadultedlabels.nyc` | **School portal** — sign-in shows school name; banner shows portal school |
| Unknown slug (e.g. `xyz.nycadultedlabels.nyc`) | Warning: subdomain not linked to an active school |
| User assigned to School 1 on `school8.…` | Wrong-school banner (Admins are not blocked) |

Security still uses the user’s assigned school in the session/API. The subdomain does **not** replace role or school checks.

Public QR pages (`/student/…`, `/archive/box/…`) keep working on any host that reaches the app. Prefer the canonical host in printed QR URLs (`NEXT_PUBLIC_APP_URL=https://nycadultedlabels.nyc`).

---

## 7. Smoke tests

After DNS + env + slugs:

1. Open `https://nycadultedlabels.nyc/auth/signin` — district sign-in
2. Open `https://school1.nycadultedlabels.nyc/auth/signin` — should show **School 1**
3. Sign in as a School 1 Data Lead on `school1.…` — portal banner should appear
4. Sign in as that same user on `school8.…` — should see **Wrong school portal**
5. Sign in as Admin on either host — should work
6. Confirm MFA still works on the school host

---

## 8. What to tell each school

```text
Your Student Label System portal:

  https://school8.nycadultedlabels.nyc

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
| School URL does not resolve | Wildcard DNS or Vercel `*.domain` missing / nameservers still propagating |
| Sign-in works on apex but not on school host | Set `NEXTAUTH_COOKIE_DOMAIN=.nycadultedlabels.nyc` and redeploy |
| “Unknown school portal” | Slug in School Settings ≠ hostname label |
| Session drops when switching school ↔ apex | Cookie domain missing or wrong (needs leading `.`) |
| Still only works on vercel.app | Domain not attached to project, env vars not set, or deploy not finished |
