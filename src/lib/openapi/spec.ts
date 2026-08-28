/**
 * OpenAPI 3.0 spec (Swagger UI compatible).
 * Served at GET /api/openapi.json and rendered at /docs/api
 *
 * Covers public, sync, and primary session routes. Internal seed/wipe/migrate
 * endpoints are omitted on purpose.
 */

const err = {
  description: 'Error',
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
  },
} as const;

const sessionSecurity = [{ SessionCookie: [] }] as const;
const jsonObject = { type: 'object', additionalProperties: true } as const;
const idParam = {
  name: 'id',
  in: 'path' as const,
  required: true,
  schema: { type: 'string' },
};

function sessionGet(tag: string, summary: string, description?: string) {
  return sessionGetSchema(tag, summary, jsonObject, description);
}

function sessionGetSchema(
  tag: string,
  summary: string,
  schema: object,
  description?: string,
) {
  return {
    get: {
      tags: [tag],
      summary,
      ...(description ? { description } : {}),
      security: sessionSecurity,
      responses: {
        '200': {
          description: 'OK',
          content: { 'application/json': { schema } },
        },
        '401': err,
        '403': err,
      },
    },
  };
}

function sessionMutations(
  tag: string,
  opts: { post?: string; put?: string; patch?: string; delete?: string; description?: string },
) {
  const out: Record<string, unknown> = {};
  for (const method of ['post', 'put', 'patch', 'delete'] as const) {
    const summary = opts[method];
    if (!summary) continue;
    out[method] = {
      tags: [tag],
      summary,
      ...(opts.description ? { description: opts.description } : {}),
      security: sessionSecurity,
      requestBody: {
        content: { 'application/json': { schema: jsonObject } },
      },
      responses: {
        '200': {
          description: 'OK',
          content: { 'application/json': { schema: jsonObject } },
        },
        '201': {
          description: 'Created',
          content: { 'application/json': { schema: jsonObject } },
        },
        '400': err,
        '401': err,
        '403': err,
        '404': err,
      },
    };
  }
  return out;
}

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Student Label System API',
    version: '1.2.0',
    description: [
      'REST API for the NYC Adult Education **Student Label System**.',
      '',
      '### Authentication',
      '- **Public** — liveness health, tenant, student lookup, archive box, this OpenAPI document',
      '- **Sync API key** — `Authorization: Bearer <SYNC_API_KEY>` for `/api/sync/v1/*`',
      '- **Cron secret** — `Authorization: Bearer <CRON_SECRET>` for `/api/cron/*` (Vercel Cron sends this header when `CRON_SECRET` is set)',
      '- **Health probe** — Admin session or `Authorization: Bearer <HEALTH_PROBE_SECRET>` (falls back to `CRON_SECRET`) for `/api/health/deep`',
      '- **Session** — NextAuth cookie after signing in at `/auth/signin` (same browser for Swagger “Try it out”)',
      '',
      '### Role notes',
      '- Most admin/storage routes require **Admin** or **Data Lead** (school-scoped for Data Lead)',
      '- **Email Validation** and **MotherDuck** are **Admin-only**',
      '',
      'Production: [nycadultedlabels.nyc](https://nycadultedlabels.nyc) · Docs UI: [/docs/api](https://nycadultedlabels.nyc/docs/api)',
    ].join('\n'),
    contact: {
      name: 'Javier Jaramillo',
      email: 'jjaramillo7@schools.nyc.gov',
    },
  },
  servers: [
    { url: 'https://nycadultedlabels.nyc', description: 'Production (Vercel)' },
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Public', description: 'Unauthenticated QR / portal helpers' },
    { name: 'Sync', description: 'Machine-to-machine export (Power Automate)' },
    { name: 'Cron', description: 'Scheduled jobs (secret auth)' },
    { name: 'Students', description: 'Student records (session)' },
    { name: 'Intake', description: 'Front-desk intake & duplicates' },
    { name: 'Cabinets', description: 'Cabinets, drawers, archive, moves' },
    { name: 'Print', description: 'Avery docs, ISRF PDF, print history, reports' },
    { name: 'Label Stock', description: 'Avery inventory' },
    { name: 'Admin', description: 'Admin / Data Lead tools' },
    { name: 'Users', description: 'User management & profile' },
    { name: 'Reports', description: 'Dashboard and analytics' },
  ],
  components: {
    securitySchemes: {
      SyncApiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Set `SYNC_API_KEY` in Vercel; use as Bearer token.',
      },
      CronSecret: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'CRON_SECRET',
        description: 'Vercel Cron / scheduler bearer. Query-string secrets are not accepted.',
      },
      SessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: '__Secure-next-auth.session-token',
        description:
          'Sign in via the web app in this browser. Production uses `__Secure-next-auth.session-token` (dev may use `next-auth.session-token`).',
      },
    },
    schemas: {
      HealthLiveness: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'student-label-system' },
          timestamp: { type: 'string', format: 'date-time' },
          links: {
            type: 'object',
            properties: {
              deep: { type: 'string' },
              docs: { type: 'string' },
              sync: { type: 'string' },
            },
          },
        },
      },
      HealthCheck: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          latencyMs: { type: 'number' },
          message: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
        },
      },
      EndpointStatus: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          method: { type: 'string' },
          path: { type: 'string' },
          purpose: { type: 'string' },
          auth: { type: 'string', enum: ['none', 'session', 'sync-api-key', 'admin'] },
          status: { type: 'string', enum: ['ready', 'misconfigured', 'unknown'] },
          statusNote: { type: 'string' },
        },
      },
      HealthDeep: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          service: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          environment: { type: 'string' },
          checks: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/HealthCheck' },
          },
          endpoints: {
            type: 'array',
            items: { $ref: '#/components/schemas/EndpointStatus' },
          },
        },
      },
      SyncIntakeVisit: {
        type: 'object',
        properties: {
          visitDate: { type: 'string', nullable: true },
          timeIn: { type: 'string', nullable: true },
          timeOut: { type: 'string', nullable: true },
          isLeaving: { type: 'string', nullable: true },
          intakeSession: { type: 'string', nullable: true },
          intakeActivity: { type: 'array', items: { type: 'string' } },
          durationMinutes: { type: 'number', nullable: true },
          recordedByEmail: { type: 'string', nullable: true },
          recordedByName: { type: 'string', nullable: true },
          sourceVisitIndex: { type: 'integer' },
        },
      },
      SyncStudent: {
        type: 'object',
        properties: {
          studentId: { type: 'string', nullable: true },
          labelId: { type: 'string', nullable: true },
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          dob: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          homePhone: { type: 'string', nullable: true },
          cellPhone: { type: 'string', nullable: true },
          middleInitial: { type: 'string', nullable: true },
          gender: { type: 'string', nullable: true },
          school: { type: 'string', nullable: true },
          agencyId: { type: 'string', nullable: true },
          fiscalYear: { type: 'string', nullable: true },
          status: { type: 'string', nullable: true },
          program: { type: 'string', nullable: true },
          startDate: { type: 'string', nullable: true },
          endDate: { type: 'string', nullable: true },
          archived: { type: 'boolean' },
          intakeStudentStatus: { type: 'string', nullable: true },
          educationStatus: { type: 'string', nullable: true },
          placementClass: { type: 'string', nullable: true },
          employmentStatus: { type: 'string', nullable: true },
          hispanicLatinoOrigin: { type: 'string', nullable: true },
          raceIdentities: { type: 'array', items: { type: 'string' } },
          emergencyContactNameRelationship: { type: 'string', nullable: true },
          emergencyContactPhone: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          siblingFlag: { type: 'boolean' },
          intakeVisits: {
            type: 'array',
            items: { $ref: '#/components/schemas/SyncIntakeVisit' },
          },
          sourceMongoId: { type: 'string' },
          sourceLastModified: { type: 'string', format: 'date-time' },
        },
      },
      SyncStudentsResponse: {
        type: 'object',
        properties: {
          students: {
            type: 'array',
            items: { $ref: '#/components/schemas/SyncStudent' },
          },
          hasMore: { type: 'boolean' },
          nextCursor: { type: 'string', nullable: true },
          since: { type: 'string', format: 'date-time' },
          count: { type: 'integer' },
        },
      },
      Student: {
        type: 'object',
        description: 'Session student record. Shape is broader than PublicStudentLookup; extra Mongo fields may be present.',
        additionalProperties: true,
        properties: {
          _id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dob: { type: 'string' },
          labelId: { type: 'string' },
          studentId: { type: 'string' },
          school: { type: 'string' },
          status: { type: 'string' },
          fiscalYear: { type: 'string' },
          archived: { type: 'boolean' },
          cabinet: { type: 'string' },
          drawer: { type: 'string' },
        },
      },
      Cabinet: {
        type: 'object',
        description: 'Cabinet with drawers (capacity, sections, map position).',
        additionalProperties: true,
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          identifier: { type: 'string', nullable: true },
          school: { type: 'string' },
          status: { type: 'string', enum: ['Active', 'Archived'] },
          isArchived: { type: 'boolean' },
          totalCapacity: { type: 'integer' },
          currentCount: { type: 'integer' },
        },
      },
      StudentsList: {
        type: 'object',
        additionalProperties: false,
        required: ['students', 'total', 'page', 'limit'],
        properties: {
          students: {
            type: 'array',
            items: { $ref: '#/components/schemas/Student' },
          },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
      PublicSiblingLookup: {
        type: 'object',
        additionalProperties: false,
        required: ['_id'],
        properties: {
          _id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          labelId: { type: 'string' },
          studentId: { type: 'string' },
        },
      },
      PublicStudentLookup: {
        type: 'object',
        description: 'Whitelisted QR lookup payload. Must match PUBLIC_STUDENT_LOOKUP_KEYS.',
        additionalProperties: false,
        required: ['_id', 'siblings'],
        properties: {
          _id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          labelId: { type: 'string' },
          studentId: { type: 'string' },
          dob: { type: 'string' },
          school: { type: 'string' },
          status: { type: 'string' },
          program: { type: 'string' },
          archived: { type: 'boolean' },
          cabinet: { type: 'string' },
          drawer: { type: 'string' },
          drawerSection: { type: 'string' },
          cabinetName: { type: 'string', nullable: true },
          drawerName: { type: 'string', nullable: true },
          archiveBoxLabel: { type: 'string', nullable: true },
          archiveLocation: { type: 'string', nullable: true },
          archiveSchoolYear: { type: 'string', nullable: true },
          archiveBoxId: { type: 'string', nullable: true },
          siblingFlag: { type: 'boolean' },
          siblingConfirmed: { type: 'boolean' },
          siblings: {
            type: 'array',
            items: { $ref: '#/components/schemas/PublicSiblingLookup' },
          },
        },
      },
      PublicArchiveBoxStudent: {
        type: 'object',
        additionalProperties: false,
        required: ['_id'],
        properties: {
          _id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          labelId: { type: 'string' },
          studentId: { type: 'string' },
        },
      },
      PublicArchiveBox: {
        type: 'object',
        additionalProperties: false,
        required: ['box', 'archive', 'students'],
        properties: {
          box: {
            type: 'object',
            additionalProperties: false,
            required: ['_id', 'label'],
            properties: {
              _id: { type: 'string' },
              label: { type: 'string' },
              boxNumber: { type: 'integer' },
              filesPerBox: { type: 'integer' },
              maxCapacity: { type: 'integer' },
              currentCount: { type: 'integer' },
            },
          },
          archive: {
            type: 'object',
            additionalProperties: false,
            properties: {
              cabinetName: { type: 'string' },
              cabinetIdentifier: { type: 'string', nullable: true },
              school: { type: 'string', nullable: true },
              schoolYear: { type: 'string' },
              location: { type: 'string' },
              archiveDate: { type: 'string' },
            },
          },
          students: {
            type: 'array',
            items: { $ref: '#/components/schemas/PublicArchiveBoxStudent' },
          },
        },
      },
      Tenant: {
        type: 'object',
        additionalProperties: false,
        required: ['mode'],
        properties: {
          mode: { type: 'string', enum: ['apex', 'school', 'unknown'] },
          rootDomain: { type: 'string', nullable: true },
          slug: { type: 'string', nullable: true },
          school: {
            type: 'object',
            nullable: true,
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              agencyId: { type: 'string', nullable: true },
              slug: { type: 'string' },
            },
          },
          portalUrl: { type: 'string', nullable: true },
          message: { type: 'string' },
          error: { type: 'string' },
        },
      },
      PrintFromIdsBody: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string', description: 'Mongo student ObjectId' },
          },
          students: {
            type: 'array',
            description: 'Legacy: only `_id` is read; PII in the payload is ignored.',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: { _id: { type: 'string' } },
            },
          },
          skipStock: { type: 'boolean' },
        },
      },
      ScanCapped: {
        type: 'object',
        description:
          'Admin diagnostic scans cap the student set. `truncated` means more records exist than were loaded.',
        additionalProperties: true,
        properties: {
          truncated: { type: 'boolean' },
          scanned: { type: 'integer' },
          cap: { type: 'integer' },
        },
      },
      AppSettings: {
        type: 'object',
        additionalProperties: false,
        properties: {
          showSeedTestData: { type: 'boolean' },
          showSeedCabinets: { type: 'boolean' },
          showClearAllData: { type: 'boolean' },
          showMigrateDrawers: { type: 'boolean' },
          notifyLowStockEmail: { type: 'boolean' },
          notifyIntakeIssuesEmail: { type: 'boolean' },
          notificationRecipients: { type: 'string' },
          idleTimeoutEnabled: { type: 'boolean' },
          idleTimeoutMinutes: { type: 'integer' },
          idlePromptGraceSeconds: { type: 'integer' },
        },
      },
      PasswordChangeBody: {
        type: 'object',
        additionalProperties: false,
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: {
            type: 'string',
            minLength: 10,
            description: 'At least 10 characters, including a letter and a number.',
          },
        },
      },
      OkSuccess: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // ── Health ─────────────────────────────────────────────────────────────
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Returns OK if the app is running.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthLiveness' } },
            },
          },
        },
      },
    },
    '/api/health/deep': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description:
          'Checks MongoDB, environment configuration, and monitored endpoint readiness. Requires an Admin session cookie or `Authorization: Bearer <HEALTH_PROBE_SECRET>` (falls back to `CRON_SECRET`). HTTP 503 when unhealthy.',
        operationId: 'getHealthDeep',
        security: [{ SessionCookie: [] }, { CronSecret: [] }],
        responses: {
          '200': {
            description: 'Healthy or degraded',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthDeep' } },
            },
          },
          '401': err,
          '503': {
            description: 'Unhealthy',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthDeep' } },
            },
          },
        },
      },
    },

    // ── Public ─────────────────────────────────────────────────────────────
    '/api/tenant': {
      get: {
        tags: ['Public'],
        summary: 'Resolve school portal from host',
        description: 'Used by school subdomains (e.g. school1.nycadultedlabels.nyc).',
        operationId: 'getTenant',
        responses: {
          '200': {
            description: 'Tenant mode and school info',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } },
          },
        },
      },
    },
    '/api/students/lookup': {
      get: {
        tags: ['Public'],
        summary: 'Public student lookup (QR)',
        description:
          'Lookup by `studentId` or `labelId` for the public student page. Unauthenticated. Returns a field-whitelisted filing payload (name, IDs, DOB, school, cabinet/drawer or archive box, siblings). Does not include email, phone, address, notes, or intake visits.',
        operationId: 'lookupStudentPublic',
        parameters: [
          { name: 'studentId', in: 'query', schema: { type: 'string' } },
          { name: 'labelId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Public student payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicStudentLookup' } } },
          },
          '404': err,
          '429': err,
        },
      },
    },
    '/api/archive/box': {
      get: {
        tags: ['Public'],
        summary: 'Public archive box',
        description: 'Box metadata and student names + filing IDs for QR archive labels. Does not include DOB. Rate-limited.',
        operationId: 'getArchiveBoxPublic',
        parameters: [
          { name: 'boxId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Archive box payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicArchiveBox' } } },
          },
          '404': err,
          '429': err,
        },
      },
    },

    // ── Sync ───────────────────────────────────────────────────────────────
    '/api/sync/v1/students': {
      get: {
        tags: ['Sync'],
        summary: 'Export students (delta sync)',
        description:
          'Machine-to-machine export for Power Automate → Dynamics. Paginate with `cursor` while `hasMore` is true.',
        operationId: 'syncListStudents',
        security: [{ SyncApiKey: [] }],
        parameters: [
          {
            name: 'since',
            in: 'query',
            description: 'ISO-8601 timestamp; return rows modified on or after this time',
            schema: { type: 'string', format: 'date-time' },
            example: '2026-05-29T00:00:00.000Z',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 500, maximum: 1000 },
          },
          {
            name: 'cursor',
            in: 'query',
            description: 'Opaque cursor from previous response `nextCursor`',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Page of students',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SyncStudentsResponse' } },
            },
          },
          '400': err,
          '401': err,
          '429': err,
          '503': err,
        },
      },
    },

    // ── Cron ───────────────────────────────────────────────────────────────
    '/api/cron/intake-digest': {
      get: {
        tags: ['Cron'],
        summary: 'Intake issues email digest',
        description: 'Scheduled job — requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this header automatically when `CRON_SECRET` is set.',
        operationId: 'cronIntakeDigest',
        security: [{ CronSecret: [] }],
        responses: {
          '200': {
            description: 'Digest result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '401': err,
        },
      },
    },

    // ── Students ───────────────────────────────────────────────────────────
    '/api/students': {
      get: {
        tags: ['Students'],
        summary: 'List students',
        description:
          'Paginated, school-scoped list. Admins see all schools. Pass `page` and `limit` (max 500). Search without `limit` defaults to 20 rows. Response: `{ students, total, page, limit }`.',
        operationId: 'listStudents',
        security: sessionSecurity,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 500 } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'createdByMe', in: 'query', schema: { type: 'boolean' } },
          { name: 'fiscalYear', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'archived', in: 'query', schema: { type: 'string', description: '0 = hide archived, 1 = only archived' } },
          { name: 'unprinted', in: 'query', schema: { type: 'boolean' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv'] } },
        ],
        responses: {
          '200': {
            description: 'Paginated students',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StudentsList' },
              },
            },
          },
          '401': err,
        },
      },
      post: {
        tags: ['Students'],
        summary: 'Create student',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['firstName', 'lastName', 'dob'],
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  dob: { type: 'string' },
                  fiscalYear: { type: 'string' },
                  status: { type: 'string' },
                  email: { type: 'string' },
                  cabinet: { type: 'string' },
                  drawer: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created student',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Student' } },
            },
          },
          '403': err,
        },
      },
    },
    '/api/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get student by Mongo ID',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': {
            description: 'Student document',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Student' } },
            },
          },
          '404': err,
        },
      },
      put: {
        tags: ['Students'],
        summary: 'Update student',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated student',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Student' } },
            },
          },
        },
      },
      delete: {
        tags: ['Students'],
        summary: 'Delete student',
        description: 'Admin or Data Lead.',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': { description: 'Deleted' },
          '403': err,
          '404': err,
        },
      },
    },
    '/api/students/bulk-upload': {
      post: {
        tags: ['Students'],
        summary: 'Bulk upload students into a cabinet',
        description: 'Admin, Data Lead, or Data Member. Drawer capacity may be custom (1–5000).',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['students', 'targetCabinetId', 'targetDrawerId'],
                properties: {
                  students: { type: 'array', items: jsonObject },
                  targetCabinetId: { type: 'string' },
                  targetDrawerId: { type: 'string' },
                  autoCreateCabinets: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '400': err,
          '401': err,
          '403': err,
        },
      },
    },
    '/api/students/email-list': {
      ...sessionGet('Students', 'Students for email-validation picker', 'Admin / Data Lead.'),
    },
    '/api/students/{id}/intake-visits': {
      patch: {
        tags: ['Students'],
        summary: 'Fix / preview intake visit handoff',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated visits',
            content: { 'application/json': { schema: jsonObject } },
          },
          '401': err,
          '403': err,
        },
      },
    },
    '/api/admin/students/all': {
      get: {
        tags: ['Students'],
        summary: 'All Students (search / filters / CSV)',
        security: sessionSecurity,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'] } },
        ],
        responses: {
          '200': {
            description: 'Students list or CSV',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/StudentsList' } },
              'text/csv': { schema: { type: 'string' } },
            },
          },
          '401': err,
        },
      },
    },
    '/api/admin/students/{id}/address': {
      patch: {
        tags: ['Students'],
        summary: 'Update / verify student address',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated address fields',
            content: { 'application/json': { schema: jsonObject } },
          },
          '401': err,
        },
      },
    },

    // ── Intake ─────────────────────────────────────────────────────────────
    '/api/intake/check': {
      ...sessionMutations('Intake', { post: 'Fuzzy duplicate + legacy roster check' }),
    },
    '/api/intake/sessions': {
      ...sessionGet('Intake', 'Intake sessions for current school'),
    },
    '/api/intake/data-lead': {
      ...sessionGet('Intake', 'Data Lead contact for school'),
    },
    '/api/admin/enrollment': {
      ...sessionGet('Intake', 'Enrollment dashboard data'),
    },
    '/api/admin/intake-issues': {
      ...sessionGet('Intake', 'Open intake clock-out / visit issues'),
    },
    '/api/admin/schools/legacy-roster/search': {
      get: {
        tags: ['Intake'],
        summary: 'Search ASISTS / legacy roster',
        security: sessionSecurity,
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'school', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Matches',
            content: { 'application/json': { schema: jsonObject } },
          },
          '401': err,
        },
      },
    },

    // ── Cabinets ───────────────────────────────────────────────────────────
    '/api/cabinets': {
      get: {
        tags: ['Cabinets'],
        summary: 'List cabinets',
        security: sessionSecurity,
        parameters: [
          {
            name: 'forecast',
            in: 'query',
            description: 'Set to `0` to skip fill forecast enrichment',
            schema: { type: 'string' },
          },
          {
            name: 'archived',
            in: 'query',
            description: 'Set to `1` for archived cabinets or `0` for active cabinets',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Cabinets',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Cabinet' } },
              },
            },
          },
          '401': err,
        },
      },
      post: {
        tags: ['Cabinets'],
        summary: 'Create cabinet',
        description:
          'Admin or Data Lead. Drawer capacity: presets 100/200/400 or custom 1–5000. Cabinet total = sum of drawers.',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'school', 'drawers'],
                properties: {
                  name: { type: 'string' },
                  identifier: { type: 'string' },
                  school: { type: 'string' },
                  drawers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        capacity: {
                          type: 'integer',
                          minimum: 1,
                          maximum: 5000,
                          description: 'Files per drawer (presets or custom)',
                        },
                        locked: { type: 'boolean' },
                      },
                    },
                  },
                  mapRow: { type: 'integer', nullable: true },
                  mapCol: { type: 'integer', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Created cabinet',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } },
            },
          },
          '400': err,
          '401': err,
          '403': err,
        },
      },
    },
    '/api/cabinets/{id}': {
      get: {
        tags: ['Cabinets'],
        summary: 'Get cabinet',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': {
            description: 'Cabinet',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } },
            },
          },
          '404': err,
        },
      },
      put: {
        tags: ['Cabinets'],
        summary: 'Update cabinet (including custom drawer capacity)',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated cabinet',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } },
            },
          },
          '400': err,
          '403': err,
        },
      },
      patch: {
        tags: ['Cabinets'],
        summary: 'Set cabinet archive flag (restore or mark archived)',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isArchived'],
                properties: {
                  isArchived: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated cabinet',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Cabinet' } },
            },
          },
          '400': err,
          '403': err,
          '404': err,
        },
      },
      delete: {
        tags: ['Cabinets'],
        summary: 'Delete cabinet',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': { description: 'Deleted' },
          '403': err,
          '404': err,
        },
      },
    },
    '/api/cabinets/{id}/map': {
      patch: {
        tags: ['Cabinets'],
        summary: 'Update floor-map row/column',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated position',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/cabinets/{id}/roster': {
      get: {
        tags: ['Cabinets'],
        summary: 'Cabinet / drawer roster',
        security: sessionSecurity,
        parameters: [
          idParam,
          { name: 'drawerId', in: 'query', schema: { type: 'string' } },
          { name: 'section', in: 'query', schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'] } },
        ],
        responses: {
          '200': {
            description: 'Roster',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/cabinets/{id}/reassign-section': {
      ...sessionMutations('Cabinets', { post: 'Reassign student(s) to a drawer section' }),
    },
    '/api/cabinets/{id}/archive': {
      get: {
        tags: ['Cabinets'],
        summary: 'List archive records for cabinet',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': {
            description: 'Archive records',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Cabinets', { post: 'Archive cabinet into boxes' }),
    },
    '/api/cabinets/{id}/archive/preview': {
      ...sessionMutations('Cabinets', { post: 'Dry-run archive packing preview' }),
    },
    '/api/cabinets/{id}/archive/assign-students': {
      get: {
        tags: ['Cabinets'],
        summary: 'Pending archive box assignment counts',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': {
            description: 'Counts',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Cabinets', { post: 'Assign students into archive boxes' }),
    },
    '/api/cabinets/move-history': {
      ...sessionGet('Cabinets', 'Student move history'),
    },
    '/api/cabinets/move-students': {
      post: {
        tags: ['Cabinets'],
        summary: 'Move over-capacity students to another cabinet',
        description: 'Admin-only.',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Move result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/cabinets/sync': {
      ...sessionMutations('Cabinets', {
        post: 'Recalc counts + backfill drawerSection',
      }),
    },
    '/api/cabinets/audit': {
      ...sessionGet('Cabinets', 'Audit cabinet capacity vs student counts'),
    },
    '/api/admin/cabinet-health': {
      ...sessionGetSchema(
        'Admin',
        'Cabinet health / capacity diagnostics',
        { $ref: '#/components/schemas/ScanCapped' },
      ),
    },
    '/api/admin/unassigned-students': {
      ...sessionGetSchema(
        'Admin',
        'Unassigned student queue',
        { $ref: '#/components/schemas/ScanCapped' },
        'Admin or Data Lead. Optional `summaryOnly=1`. Includes scan cap metadata.',
      ),
    },
    '/api/admin/assign-next-slot': {
      ...sessionMutations('Admin', { post: 'Assign / move students to next open slot' }),
    },
    '/api/admin/bulk-move': {
      ...sessionMutations('Admin', { post: 'Bulk move students across cabinets/drawers' }),
    },
    '/api/admin/sync-cabinet-counts': {
      ...sessionMutations('Admin', { post: 'Recount cabinet/drawer currentCount' }),
    },

    // ── Print ──────────────────────────────────────────────────────────────
    '/api/isrf': {
      post: {
        tags: ['Print'],
        summary: 'Fill FY2027 ISRF PDF from a student intake record',
        description:
          'Admin, Data Lead, or Data Member. School-scoped. Returns a populated AcroForm PDF (identity, phones, emergency contact, employment, race/ethnicity, and barriers when collected). Pass `download=1` for an attachment.',
        security: sessionSecurity,
        parameters: [
          { name: 'download', in: 'query', schema: { type: 'string', enum: ['1'] } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['id'],
                properties: { id: { type: 'string', description: 'Mongo student ObjectId' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Filled ISRF PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          '400': err,
          '401': err,
          '403': err,
          '404': err,
        },
      },
    },
    '/api/print/avery5163-docx': {
      post: {
        tags: ['Print'],
        summary: 'Generate Avery 5163 Word labels from Mongo student ids',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrintFromIdsBody' },
            },
          },
        },
        responses: {
          '200': {
            description: 'DOCX binary',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '401': err,
          '403': err,
          '404': err,
        },
      },
    },
    '/api/print/avery94205-docx': {
      post: {
        tags: ['Print'],
        summary: 'Generate Avery 94205 Word labels from Mongo student ids',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrintFromIdsBody' },
            },
          },
        },
        responses: {
          '200': {
            description: 'DOCX binary',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '401': err,
          '403': err,
          '404': err,
        },
      },
    },
    '/api/print-history': {
      get: {
        tags: ['Print'],
        summary: 'List print history',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'History rows',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Print', { post: 'Record a print job' }),
    },
    '/api/print-reports': {
      get: {
        tags: ['Print'],
        summary: 'Print activity reports',
        security: sessionSecurity,
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string' } },
          { name: 'endDate', in: 'query', schema: { type: 'string' } },
          {
            name: 'groupBy',
            in: 'query',
            schema: { type: 'string', enum: ['day', 'week', 'month', 'user', 'student'] },
          },
        ],
        responses: {
          '200': {
            description: 'Report payload',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
    },

    // ── Label stock ────────────────────────────────────────────────────────
    '/api/label-stock': {
      get: {
        tags: ['Label Stock'],
        summary: 'List label stock',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Stock items',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Label Stock', {
        post: 'Create stock item',
        put: 'Update stock item',
        delete: 'Delete stock item',
      }),
    },
    '/api/label-stock/adjust': {
      ...sessionMutations('Label Stock', { post: 'Adjust stock quantity' }),
    },
    '/api/label-stock/history': {
      ...sessionGet('Label Stock', 'Stock adjustment history'),
    },
    '/api/label-stock/export': {
      ...sessionGet('Label Stock', 'Export stock data'),
    },

    // ── Admin tools ────────────────────────────────────────────────────────
    '/api/admin/email-validation': {
      get: {
        tags: ['Admin'],
        summary: 'Email validation jobs / usage',
        description: '**Admin-only.**',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Jobs + usage',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Submit emails for validation',
        description: '**Admin-only.**',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Submit result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/admin/email-validation/apply': {
      post: {
        tags: ['Admin'],
        summary: 'Apply validation results to students',
        description: '**Admin-only.**',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Apply result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/admin/email-validation/sync': {
      post: {
        tags: ['Admin'],
        summary: 'Poll EmailAwesome pending jobs',
        description: '**Admin-only.**',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Sync result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/admin/email-validation/test': {
      get: {
        tags: ['Admin'],
        summary: 'EmailAwesome connectivity test',
        description: '**Admin-only.**',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Probe result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/admin/schools': {
      get: {
        tags: ['Admin'],
        summary: 'List school configs',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Schools',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create school',
        description: 'Admin-only.',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Created',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update school (incl. subdomain slug, intake sessions)',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete school',
        description: 'Admin-only.',
        security: sessionSecurity,
        responses: {
          '200': { description: 'Deleted' },
          '403': err,
        },
      },
    },
    '/api/admin/schools/{slug}': {
      get: {
        tags: ['Admin'],
        summary: 'Get school by slug',
        security: sessionSecurity,
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'School config',
            content: { 'application/json': { schema: jsonObject } },
          },
          '404': err,
        },
      },
    },
    '/api/admin/schools/legacy-roster': {
      get: {
        tags: ['Admin'],
        summary: 'Legacy roster status',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Status',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Admin', {
        post: 'Upload legacy roster',
        delete: 'Clear legacy roster',
      }),
    },
    '/api/admin/duplicates': {
      get: {
        tags: ['Admin'],
        summary: 'List duplicates / siblings',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Duplicate groups (capped scan)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ScanCapped' } } },
          },
        },
      },
      ...sessionMutations('Admin', { post: 'Merge or dismiss duplicates' }),
    },
    '/api/admin/data-cleanup': {
      get: {
        tags: ['Admin'],
        summary: 'Data quality findings',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Issues (capped scan)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ScanCapped' } } },
          },
        },
      },
      ...sessionMutations('Admin', { post: 'Apply data cleanup fixes' }),
    },
    '/api/admin/school-year': {
      ...sessionGet('Admin', 'School-year rollover checklist'),
    },
    '/api/admin/addresses/verify': {
      get: {
        tags: ['Admin'],
        summary: 'NYC Geoclient configured?',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Configuration status',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Admin', { post: 'Batch verify addresses via Geoclient' }),
    },
    '/api/admin/app-settings': {
      get: {
        tags: ['Admin'],
        summary: 'Read app settings / feature flags',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Settings',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AppSettings' } } },
          },
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update app settings',
        description: 'Admin-only.',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AppSettings' } } },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AppSettings' } } },
          },
          '403': err,
        },
      },
    },
    '/api/admin/notifications': {
      ...sessionMutations('Admin', { post: 'Test / run intake digest notification' }),
    },
    '/api/admin/analytics': {
      get: {
        tags: ['Admin'],
        summary: 'In-app analytics snapshot',
        description:
          'Admin and Data Lead. Enrollment, cabinets, prints, search activity, and (Admin) account health.',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Analytics payload',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/search-events': {
      post: {
        tags: ['Students'],
        summary: 'Record a client-side student search',
        description: 'Stores query type and result count only — not the raw search string.',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Recorded',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
    },
    '/api/admin/system-stats': {
      get: {
        tags: ['Admin'],
        summary: 'System / DB statistics',
        description: 'Admin-only.',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Stats',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'Query audit logs',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Log entries',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Admin', { post: 'Append audit log entry' }),
    },
    '/api/saved-searches': {
      get: {
        tags: ['Admin'],
        summary: 'List saved searches',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Saved searches',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      ...sessionMutations('Admin', {
        post: 'Create saved search',
        delete: 'Delete saved search',
      }),
    },

    // ── Users ──────────────────────────────────────────────────────────────
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (Admin) or self',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Users',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        description: 'Admin-only.',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Created',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/users/bulk-upload': {
      post: {
        tags: ['Users'],
        summary: 'Bulk create users from CSV rows',
        description:
          'Admin-only. Creates up to 200 users. Blank passwords are auto-generated; all bulk users must change password on first sign-in.',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Created / skipped / errors summary',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user',
        description: 'Admin-only.',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': {
            description: 'User',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update user',
        description: 'Admin-only.',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        description: 'Admin-only.',
        security: sessionSecurity,
        parameters: [idParam],
        responses: {
          '200': { description: 'Deleted' },
          '403': err,
        },
      },
    },
    '/api/admin/users/{id}/security': {
      post: {
        tags: ['Users'],
        summary: 'Reset password / MFA recovery',
        description: 'Admin-only. Actions: reset-password, force-password-change, clear-force-password-change, set-mfa-bypass (per-user MFA on/off for testing), disable-mfa (reset enrollment), unlock-account.',
        security: sessionSecurity,
        parameters: [idParam],
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Security action result',
            content: { 'application/json': { schema: jsonObject } },
          },
          '403': err,
        },
      },
    },
    '/api/profile/password': {
      put: {
        tags: ['Users'],
        summary: 'Change own password',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordChangeBody' } } },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OkSuccess' } } },
          },
          '400': err,
          '401': err,
        },
      },
    },
    '/api/profile/mfa': {
      post: {
        tags: ['Users'],
        summary: 'Start MFA setup',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'QR / secret payload',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Confirm MFA',
        security: sessionSecurity,
        requestBody: {
          content: { 'application/json': { schema: jsonObject } },
        },
        responses: {
          '200': {
            description: 'Enabled',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Disable MFA',
        security: sessionSecurity,
        responses: {
          '200': { description: 'Disabled' },
        },
      },
    },

    // ── Reports / integrations ─────────────────────────────────────────────
    '/api/dashboard-stats': {
      get: {
        tags: ['Reports'],
        summary: 'Dashboard statistics',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Stats object',
            content: { 'application/json': { schema: jsonObject } },
          },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
