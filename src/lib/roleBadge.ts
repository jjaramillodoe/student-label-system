/** Shared semantic role chip classes (profile, docs, etc.). */

export function roleBadgeClass(role?: string | null): string {
  switch (role) {
    case 'Admin':
      return 'ui-badge-danger';
    case 'Data Lead':
      return 'ui-badge-info';
    case 'Data Member':
      return 'ui-badge-muted';
    case 'Intake Member':
      return 'ui-badge-success';
    default:
      return 'ui-badge-muted';
  }
}
