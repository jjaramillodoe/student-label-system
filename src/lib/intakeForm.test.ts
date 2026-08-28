import { describe, expect, it } from 'vitest';
import { emptyIntakeForm, hydrateIntakeForm } from './intakeForm';

describe('hydrateIntakeForm', () => {
  it('copies legacy phone onto homePhone', () => {
    const form = hydrateIntakeForm({ ...emptyIntakeForm(), phone: '2125550100', homePhone: '' });
    expect(form.homePhone).toBe('2125550100');
    expect(form.phone).toBe('2125550100');
  });

  it('syncs home phone from cell when same-as-cell is set', () => {
    const form = hydrateIntakeForm({
      ...emptyIntakeForm(),
      cellPhone: '9175550199',
      homePhoneSameAsCell: true,
    });
    expect(form.homePhone).toBe('9175550199');
  });
});
