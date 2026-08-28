import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { fillIsrfPdf } from './isrfPdf';

describe('fillIsrfPdf', () => {
  it('writes intake fields onto the FY2027 template', async () => {
    const bytes = await fillIsrfPdf(
      {
        firstName: 'Ana',
        lastName: 'Cruz',
        dob: '1988-03-02',
        phone: '2125550199',
        gender: 'F',
        educationStatus: 'ESL',
        email: 'ana@schools.nyc.gov',
      },
      { completedBy: 'Jane Lead', signedOn: '08/28/2026' },
    );
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    expect(form.getTextField('First Name').getText()).toBe('Ana');
    expect(form.getTextField('Last Name').getText()).toBe('Cruz');
    expect(form.getTextField('Birth Date').getText()).toBe('03021988');
    expect(form.getTextField('Phone').getText()).toBe('212');
    expect(form.getTextField('email').getText()).toBe('ana@schools.nyc.gov');
    expect(form.getTextField('date of signature').getText()).toBe('08282026');
    expect(form.getRadioGroup('Gender Required').getSelected()).toBe('Female');
    expect(form.getRadioGroup('English Language Leraner').getSelected()).toBe('Choice3');
  });
});
