import { describe, expect, it } from 'vitest';
import {
  cabinetArchiveSetFields,
  isActiveCabinet,
  isCabinetArchived,
  serializeCabinetRecord,
  withCabinetArchiveFlags,
} from './cabinets';

describe('cabinet archive flags', () => {
  it('treats missing fields as active', () => {
    expect(isCabinetArchived({})).toBe(false);
    expect(isActiveCabinet({})).toBe(true);
  });

  it('prefers isArchived over status', () => {
    expect(isCabinetArchived({ isArchived: true, status: 'Active' })).toBe(true);
    expect(isCabinetArchived({ isArchived: false, status: 'Archived' })).toBe(false);
  });

  it('falls back to status when isArchived is omitted', () => {
    expect(isCabinetArchived({ status: 'Archived' })).toBe(true);
    expect(isActiveCabinet({ status: 'Active' })).toBe(true);
  });

  it('keeps isArchived and status in sync when writing', () => {
    expect(cabinetArchiveSetFields(true, '2026-08-28T00:00:00.000Z')).toEqual({
      isArchived: true,
      status: 'Archived',
      archivedAt: '2026-08-28T00:00:00.000Z',
    });
    expect(cabinetArchiveSetFields(false)).toEqual({
      isArchived: false,
      status: 'Active',
    });
  });

  it('normalizes API payloads', () => {
    expect(withCabinetArchiveFlags({ name: 'Main', status: 'Archived' })).toMatchObject({
      isArchived: true,
      status: 'Archived',
    });
    expect(
      serializeCabinetRecord({
        _id: { toString: () => 'abc' },
        name: 'Main',
        status: 'Archived',
        drawers: [{ _id: 1, name: 'Drawer 1' }],
      }),
    ).toMatchObject({
      _id: 'abc',
      isArchived: true,
      status: 'Archived',
      drawers: [{ _id: '1', name: 'Drawer 1' }],
    });
  });
});
