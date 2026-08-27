# API Health Checks

Quick way to verify [nycadultedlabels.nyc](https://nycadultedlabels.nyc) is up and dependencies are configured.

**Use the same Next.js app on Vercel** — no separate Python/FastAPI service needed. Health routes deploy with every `vercel deploy`.

---

## Endpoints

| URL | Auth | Use |
|-----|------|-----|
| [`/docs/api`](/docs/api) | None | **Interactive Swagger UI** (OpenAPI 3.0) |
| [`/api/openapi.json`](/api/openapi.json) | None | Raw OpenAPI spec (import to Postman) |
| [`/api/health`](https://nycadultedlabels.nyc/api/health) | None | Liveness — open in a browser |
| [`/api/health/deep`](https://nycadultedlabels.nyc/api/health/deep) | Admin session or Bearer `HEALTH_PROBE_SECRET` / `CRON_SECRET` | Readiness — MongoDB, env vars, endpoint status |

### Liveness (browser-friendly)

```bash
curl -s https://nycadultedlabels.nyc/api/health | jq
```

```json
{
  "status": "ok",
  "service": "student-label-system",
  "timestamp": "2026-05-31T…",
  "links": {
    "deep": "/api/health/deep",
    "docs": "/docs",
    "sync": "/api/sync/v1/students"
  }
}
```

### Deep readiness

```bash
curl -s -H "Authorization: Bearer $HEALTH_PROBE_SECRET" \
  https://nycadultedlabels.nyc/api/health/deep | jq
```

Returns:

- **`status`:** `healthy` | `degraded` | `unhealthy`
- **`checks`:** MongoDB ping, core env, sync API key, sync data sample, MotherDuck config
- **`endpoints`:** Monitored routes with `ready` / `misconfigured` and auth notes (includes MotherDuck status/sync)

HTTP **503** when status is `unhealthy` (useful for monitors).

---

## Sync API smoke test (authenticated)

Health checks do **not** call the sync route with your key. Test sync separately:

```bash
curl -s -H "Authorization: Bearer $(cat .sync-api-key.local)" \
  "https://nycadultedlabels.nyc/api/sync/v1/students?limit=1" | jq '.count, .hasMore'
```

---

## Why not FastAPI?

| Approach | Pros | Cons |
|----------|------|------|
| **Next.js API routes (this app)** | Same deploy, same env vars, TypeScript, already on Vercel | — |
| Separate FastAPI on Railway/Render | Python ecosystem | Second service, second deploy, duplicate secrets, CORS |
| Postman/Insomnia only | Manual | No automated readiness for Power Automate ops |

For Power Automate you can add a **daily health step** before sync:

1. HTTP GET `https://nycadultedlabels.nyc/api/health/deep` with `Authorization: Bearer <HEALTH_PROBE_SECRET>` (or `CRON_SECRET`)
2. Condition: `status` equals `healthy` or `degraded`
3. Only then call `/api/sync/v1/students`

---

## Implementation

- `src/lib/healthChecks.ts` — check helpers
- `src/app/api/health/route.ts` — liveness
- `src/app/api/health/deep/route.ts` — readiness + endpoint registry
