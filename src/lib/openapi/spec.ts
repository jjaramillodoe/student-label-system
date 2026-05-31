/**
 * OpenAPI 3.0 spec (Swagger UI compatible).
 * Served at GET /api/openapi.json and rendered at /docs/api
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Student Label System API',
    version: '1.0.0',
    description: [
      'REST API for the District 79 Adult Education **Student Label System**.',
      '',
      '### Authentication',
      '- **Public** — `/api/health`, `/api/health/deep`, this spec',
      '- **Sync API key** — `Authorization: Bearer <SYNC_API_KEY>` for `/api/sync/v1/*` (Power Automate / integrations)',
      '- **Session** — NextAuth cookie when signed in at `/auth/signin` (browser); most `/api/students` and admin routes',
      '',
      'Production: [student-label-system.vercel.app](https://student-label-system.vercel.app)',
    ].join('\n'),
    contact: {
      name: 'Javier Jaramillo',
      email: 'jjaramillo7@schools.nyc.gov',
    },
  },
  servers: [
    {
      url: 'https://student-label-system.vercel.app',
      description: 'Production (Vercel)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Sync', description: 'Machine-to-machine export for Dynamics / Power Automate' },
    { name: 'Students', description: 'Student records (session auth)' },
    { name: 'Reports', description: 'Analytics and print reports (session auth)' },
    { name: 'Integrations', description: 'ThoughtSpot and other embeds' },
  ],
  components: {
    securitySchemes: {
      SyncApiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Set `SYNC_API_KEY` in Vercel; use as Bearer token.',
      },
      SessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
        description: 'Sign in via the web app; Swagger "Try it out" may not send cookies unless configured.',
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
          checks: { type: 'object', additionalProperties: { $ref: '#/components/schemas/HealthCheck' } },
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
        description: 'Full MongoDB student document (session routes return more fields than SyncStudent).',
        additionalProperties: true,
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
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Returns OK if the app is running. Safe to call from a browser or uptime monitor.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthLiveness' },
              },
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
          'Checks MongoDB, environment configuration, and reports monitored endpoint readiness. Returns HTTP 503 when unhealthy.',
        operationId: 'getHealthDeep',
        responses: {
          '200': {
            description: 'Healthy or degraded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthDeep' },
              },
            },
          },
          '503': {
            description: 'Unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthDeep' },
              },
            },
          },
        },
      },
    },
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
              'application/json': {
                schema: { $ref: '#/components/schemas/SyncStudentsResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid since or cursor',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid Bearer token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '503': {
            description: 'SYNC_API_KEY not configured on server',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/students': {
      get: {
        tags: ['Students'],
        summary: 'List students',
        description: 'Requires signed-in session. Admins see all schools; others scoped to their school.',
        operationId: 'listStudents',
        security: [{ SessionCookie: [] }],
        parameters: [
          {
            name: 'since',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'createdByMe',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': {
            description: 'Array of student documents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Student' },
                },
              },
            },
          },
          '401': {
            description: 'Not signed in',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Students'],
        summary: 'Create student',
        security: [{ SessionCookie: [] }],
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
              'application/json': {
                schema: { $ref: '#/components/schemas/Student' },
              },
            },
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get student by ID',
        security: [{ SessionCookie: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Student document',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Student' },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Students'],
        summary: 'Update student',
        security: [{ SessionCookie: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated student',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Student' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Students'],
        summary: 'Delete student',
        security: [{ SessionCookie: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Deleted' },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/dashboard-stats': {
      get: {
        tags: ['Reports'],
        summary: 'Dashboard statistics',
        security: [{ SessionCookie: [] }],
        responses: {
          '200': {
            description: 'Stats object',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    '/api/print-reports': {
      get: {
        tags: ['Reports'],
        summary: 'Print activity reports',
        security: [{ SessionCookie: [] }],
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
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    '/api/thoughtspot/token': {
      get: {
        tags: ['Integrations'],
        summary: 'ThoughtSpot embed token',
        description: 'Returns a short-lived token for Visual Embed SDK (session required).',
        security: [{ SessionCookie: [] }],
        responses: {
          '200': {
            description: 'Plain-text bearer token',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
          '503': {
            description: 'ThoughtSpot not configured',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
