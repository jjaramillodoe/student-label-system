import { describe, expect, it } from 'vitest';
import { openApiSpec } from './openapi/spec';
import { PUBLIC_ARCHIVE_BOX_STUDENT_KEYS } from './publicArchiveBox';
import { PUBLIC_STUDENT_LOOKUP_KEYS } from './publicStudentLookup';

type SchemaObject = {
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
};

type JsonSchemaRef = { $ref?: string };

type Operation = {
  responses?: {
    '200'?: { content?: { 'application/json'?: { schema?: JsonSchemaRef } } };
  };
  requestBody?: {
    content?: { 'application/json'?: { schema?: JsonSchemaRef } };
  };
};

function schema(name: string): SchemaObject {
  const s = (openApiSpec.components.schemas as Record<string, SchemaObject | undefined>)[name];
  if (!s) throw new Error(`missing schema ${name}`);
  return s;
}

function schemaPropertyKeys(name: string): string[] {
  return Object.keys(schema(name).properties ?? {}).sort();
}

function operation(path: string, method: 'get' | 'post' | 'put' | 'patch'): Operation {
  const item = (openApiSpec.paths as Record<string, Record<string, Operation | undefined>>)[path];
  const op = item?.[method];
  if (!op) throw new Error(`missing ${method.toUpperCase()} ${path}`);
  return op;
}

function responseRef(path: string, method: 'get' | 'post' | 'put' | 'patch'): string {
  const ref = operation(path, method).responses?.['200']?.content?.['application/json']?.schema?.$ref;
  if (!ref) throw new Error(`missing 200 JSON $ref for ${method.toUpperCase()} ${path}`);
  return ref;
}

function requestRef(path: string, method: 'get' | 'post' | 'put' | 'patch'): string {
  const ref = operation(path, method).requestBody?.content?.['application/json']?.schema?.$ref;
  if (!ref) throw new Error(`missing request JSON $ref for ${method.toUpperCase()} ${path}`);
  return ref;
}

describe('OpenAPI DTO alignment', () => {
  it('keeps PublicStudentLookup properties in sync with PUBLIC_STUDENT_LOOKUP_KEYS', () => {
    expect(schemaPropertyKeys('PublicStudentLookup')).toEqual([...PUBLIC_STUDENT_LOOKUP_KEYS].sort());
    expect(schema('PublicStudentLookup').additionalProperties).toBe(false);
  });

  it('keeps archive-box student properties in sync with PUBLIC_ARCHIVE_BOX_STUDENT_KEYS', () => {
    expect(schemaPropertyKeys('PublicArchiveBoxStudent')).toEqual(
      [...PUBLIC_ARCHIVE_BOX_STUDENT_KEYS].sort(),
    );
    expect(schemaPropertyKeys('PublicSiblingLookup')).toEqual(
      [...PUBLIC_ARCHIVE_BOX_STUDENT_KEYS].sort(),
    );
  });

  it('wires lookup, archive box, and student list 200 responses to named schemas', () => {
    expect(responseRef('/api/students/lookup', 'get')).toBe(
      '#/components/schemas/PublicStudentLookup',
    );
    expect(responseRef('/api/archive/box', 'get')).toBe('#/components/schemas/PublicArchiveBox');
    expect(responseRef('/api/students', 'get')).toBe('#/components/schemas/StudentsList');
    expect(responseRef('/api/admin/students/all', 'get')).toBe('#/components/schemas/StudentsList');
  });

  it('wires remaining DTO endpoints (print, scans, tenant, settings, password)', () => {
    expect(requestRef('/api/print/avery5163-docx', 'post')).toBe(
      '#/components/schemas/PrintFromIdsBody',
    );
    expect(requestRef('/api/print/avery94205-docx', 'post')).toBe(
      '#/components/schemas/PrintFromIdsBody',
    );
    expect(responseRef('/api/admin/cabinet-health', 'get')).toBe('#/components/schemas/ScanCapped');
    expect(responseRef('/api/admin/unassigned-students', 'get')).toBe(
      '#/components/schemas/ScanCapped',
    );
    expect(responseRef('/api/admin/duplicates', 'get')).toBe('#/components/schemas/ScanCapped');
    expect(responseRef('/api/admin/data-cleanup', 'get')).toBe('#/components/schemas/ScanCapped');
    expect(responseRef('/api/tenant', 'get')).toBe('#/components/schemas/Tenant');
    expect(responseRef('/api/admin/app-settings', 'get')).toBe('#/components/schemas/AppSettings');
    expect(requestRef('/api/admin/app-settings', 'patch')).toBe('#/components/schemas/AppSettings');
    expect(responseRef('/api/admin/app-settings', 'patch')).toBe('#/components/schemas/AppSettings');
    expect(requestRef('/api/profile/password', 'put')).toBe(
      '#/components/schemas/PasswordChangeBody',
    );
    expect(responseRef('/api/profile/password', 'put')).toBe('#/components/schemas/OkSuccess');
  });
});
