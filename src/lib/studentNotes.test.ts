import { describe, expect, it } from 'vitest';
import {
  STUDENT_NOTE_MAX_LENGTH,
  canDeleteNote,
  canEditNote,
  validateNoteBody,
} from './studentNotes';

const author = { email: 'lead@schools.nyc.gov', name: 'Lead', role: 'Data Lead' };
const createdAt = '2026-10-28T12:00:00.000Z';

describe('validateNoteBody', () => {
  it('trims text and rejects empty or overlong notes', () => {
    expect(validateNoteBody('  Folder pulled for audit  ')).toEqual({ body: 'Folder pulled for audit' });
    expect(validateNoteBody('   ')).toHaveProperty('error');
    expect(validateNoteBody(undefined)).toHaveProperty('error');
    expect(validateNoteBody('x'.repeat(STUDENT_NOTE_MAX_LENGTH + 1))).toHaveProperty('error');
  });
});

describe('canEditNote', () => {
  it('lets the author edit within 24 hours', () => {
    const note = { createdBy: author, createdAt };
    expect(canEditNote(note, 'LEAD@schools.nyc.gov', new Date('2026-10-29T11:59:00.000Z'))).toBe(true);
    expect(canEditNote(note, author.email, new Date('2026-10-29T12:01:00.000Z'))).toBe(false);
  });

  it('blocks other users and deleted notes', () => {
    const now = new Date('2026-10-28T13:00:00.000Z');
    expect(canEditNote({ createdBy: author, createdAt }, 'other@schools.nyc.gov', now)).toBe(false);
    expect(canEditNote({ createdBy: author, createdAt, deletedAt: createdAt }, author.email, now)).toBe(false);
  });
});

describe('canDeleteNote', () => {
  it('allows the author or an Admin', () => {
    const note = { createdBy: author };
    expect(canDeleteNote(note, author.email, 'Data Lead')).toBe(true);
    expect(canDeleteNote(note, 'admin@schools.nyc.gov', 'Admin')).toBe(true);
    expect(canDeleteNote(note, 'member@schools.nyc.gov', 'Data Member')).toBe(false);
  });
});
