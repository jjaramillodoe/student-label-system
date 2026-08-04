# SSO Request Brief — NYC Public Schools (DIIT)

**Application:** Adult Education Student Label System  
**Requester:** District 79 / Adult Education program operations  
**Date:** July 2026  
**Contact:** [Your name], [title], [schools.nyc.gov email], [phone]

---

## 1. Purpose

We request **Single Sign-On (SSO)** so staff can sign in to the Student Label System with their existing **`@schools.nyc.gov`** Microsoft / Entra ID credentials instead of (or in addition to) a separate app password.

The app manages student file labels, cabinet/drawer assignments, front-desk intake, and archive boxes for Adult Education programs. Users are DOE staff only (Admin, Data Lead, Data Member, Intake Member).

## 2. Current authentication

| Today | Planned with SSO |
| --- | --- |
| App-managed credentials + optional TOTP MFA | **Microsoft Entra ID / DOE tenant SSO** (OIDC preferred; SAML if required) |
| Roles and school scope stored in the app database | Same — SSO proves identity; **authorization stays in the app** |
| Password reset handled by admins | DOE password / MFA lifecycle handled by DOE IdP |

Credentials login will remain as a **break-glass / fallback** until SSO is fully adopted.

## 3. Technical preference

1. **Preferred:** OpenID Connect (OIDC) with Microsoft Entra ID (Azure AD)  
   - App registration (or DOE-approved multi-tenant / enterprise app)  
   - Redirect URI: `https://nycadultedlabels.nyc/api/auth/callback/azure-ad`  
   - Local/dev: `http://localhost:3000/api/auth/callback/azure-ad`
2. **Acceptable alternative:** SAML 2.0 federation per **DIIT SAML Integration Guidelines**, if that is the required DOE path.

**Scopes needed (OIDC):** `openid`, `profile`, `email` (and `User.Read` if Graph is required for email claim).

**Identity mapping:** Match the Microsoft email claim to an existing user record in our MongoDB `users` collection. Users must be **pre-provisioned** by an Admin (no automatic open registration).

**Allowed domains:** `@schools.nyc.gov` (others only if DIIT approves).

## 4. What we need from DIIT / IAM

- [ ] Guidance on OIDC vs SAML for this class of application  
- [ ] Application registration / enterprise app consent in the DOE Entra tenant  
- [ ] Client ID, tenant ID, and client secret (or certificate) via secure channel  
- [ ] Confirmation of required redirect URIs and logout URL  
- [ ] Any security questionnaire / InfoSec review checklist  
- [ ] Expected timeline and support contact for go-live  

We will **not** modify DOE Identity Management Systems. New-user enrollment ownership remains with program Admins in our User Management UI (email must already exist as a DOE account).

## 5. Data & security notes

- Hosting: Vercel (HTTPS); database: MongoDB Atlas  
- PII: student demographic / address / visit data; role-based school scoping  
- Session: JWT via NextAuth; idle/session policy can be aligned to DOE standards on request  
- Audit logging exists for admin and student record actions  
- Public QR pages (`/student/*`, `/archive/box/*`) remain unauthenticated by design for physical label scanning  

## 6. Implementation status (application side)

Scaffolding is already in the codebase (NextAuth Azure AD provider). Production Microsoft button appears only when `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, and `AZURE_AD_TENANT_ID` are configured. Until DIIT provides tenant consent, staff continue using email/password + MFA.

## 7. Ask

Please advise on the correct onboarding path (OIDC vs SAML) and the next form/ticket we should submit so Adult Education staff can use **Sign in with Microsoft (DOE)** for this application.

Thank you.
