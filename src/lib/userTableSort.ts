export type UserSortColumn = 'name' | 'role' | 'school' | 'createdAt' | 'lastLogin';
export type UserSortDirection = 'asc' | 'desc';

export type UserSortable = {
  name: string;
  email: string;
  role: string;
  school?: string;
  createdAt?: string;
  lastLogin?: string;
};

function textValue(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function dateValue(value: string | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function compareText(a: string | undefined, b: string | undefined): number {
  return textValue(a).localeCompare(textValue(b), undefined, { sensitivity: 'base' });
}

function tieBreak(a: UserSortable, b: UserSortable): number {
  return compareText(a.name, b.name) || compareText(a.email, b.email);
}

export function sortUsers<T extends UserSortable>(
  users: T[],
  column: UserSortColumn | null,
  direction: UserSortDirection | null,
): T[] {
  if (!column || !direction) return users;

  return [...users].sort((a, b) => {
    let primary = 0;
    switch (column) {
      case 'name':
        primary = compareText(a.name, b.name);
        break;
      case 'role':
        primary = compareText(a.role, b.role);
        break;
      case 'school':
        primary = compareText(a.school, b.school);
        break;
      case 'createdAt':
        primary = dateValue(a.createdAt) - dateValue(b.createdAt);
        break;
      case 'lastLogin':
        primary = dateValue(a.lastLogin) - dateValue(b.lastLogin);
        break;
    }
    if (primary !== 0) return direction === 'asc' ? primary : -primary;
    return tieBreak(a, b);
  });
}

export function nextUserSort(
  currentColumn: UserSortColumn | null,
  currentDirection: UserSortDirection | null,
  clicked: UserSortColumn,
): { column: UserSortColumn | null; direction: UserSortDirection | null } {
  if (currentColumn === clicked) {
    if (currentDirection === 'asc') return { column: clicked, direction: 'desc' };
    if (currentDirection === 'desc') return { column: null, direction: null };
  }
  return { column: clicked, direction: 'asc' };
}
