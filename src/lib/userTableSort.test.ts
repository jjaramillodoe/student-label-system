import { describe, expect, it } from 'vitest';
import { nextUserSort, sortUsers, type UserSortable } from './userTableSort';

const users: UserSortable[] = [
  { name: 'Zoe Diaz', email: 'zoe@schools.nyc.gov', role: 'Admin', school: 'School B', createdAt: '2026-01-02', lastLogin: '2026-08-01' },
  { name: 'Ana Cruz', email: 'ana@schools.nyc.gov', role: 'Data Member', school: 'School A', createdAt: '2026-03-01', lastLogin: undefined },
  { name: 'Mia Chen', email: 'mia@schools.nyc.gov', role: 'Data Lead', school: 'School A', createdAt: '2026-02-01', lastLogin: '2026-08-20' },
];

describe('sortUsers', () => {
  it('returns the original list when sort is cleared', () => {
    expect(sortUsers(users, null, null)).toBe(users);
  });

  it('sorts by name A–Z then Z–A', () => {
    expect(sortUsers(users, 'name', 'asc').map((u) => u.name)).toEqual([
      'Ana Cruz',
      'Mia Chen',
      'Zoe Diaz',
    ]);
    expect(sortUsers(users, 'name', 'desc').map((u) => u.name)).toEqual([
      'Zoe Diaz',
      'Mia Chen',
      'Ana Cruz',
    ]);
  });

  it('sorts by role, school, created date, and last login', () => {
    expect(sortUsers(users, 'role', 'asc').map((u) => u.role)).toEqual([
      'Admin',
      'Data Lead',
      'Data Member',
    ]);
    expect(sortUsers(users, 'school', 'asc').map((u) => u.name)).toEqual([
      'Ana Cruz',
      'Mia Chen',
      'Zoe Diaz',
    ]);
    expect(sortUsers(users, 'createdAt', 'asc').map((u) => u.name)).toEqual([
      'Zoe Diaz',
      'Mia Chen',
      'Ana Cruz',
    ]);
    expect(sortUsers(users, 'lastLogin', 'desc').map((u) => u.name)).toEqual([
      'Mia Chen',
      'Zoe Diaz',
      'Ana Cruz',
    ]);
  });

  it('puts missing last-login values first when sorting oldest-first', () => {
    expect(sortUsers(users, 'lastLogin', 'asc').map((u) => u.name)[0]).toBe('Ana Cruz');
  });
});

describe('nextUserSort', () => {
  it('cycles asc → desc → cleared on the same column', () => {
    const first = nextUserSort(null, null, 'role');
    expect(first).toEqual({ column: 'role', direction: 'asc' });
    const second = nextUserSort(first.column, first.direction, 'role');
    expect(second).toEqual({ column: 'role', direction: 'desc' });
    const third = nextUserSort(second.column, second.direction, 'role');
    expect(third).toEqual({ column: null, direction: null });
  });
});
