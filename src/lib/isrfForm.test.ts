import { describe, expect, it } from 'vitest';
import {
  buildIsrfFieldValues,
  displayIsrfDateBox,
  formatIsrfDate,
  isrfDownloadFilename,
  normalizeIsrfGender,
  splitUsPhone,
  todayIsrfDate,
} from './isrfForm';

describe('splitUsPhone', () => {
  it('splits a 10-digit US number', () => {
    expect(splitUsPhone('(212) 555-0199')).toEqual(['212', '555', '0199']);
  });

  it('strips a leading 1', () => {
    expect(splitUsPhone('1-718-555-0100')).toEqual(['718', '555', '0100']);
  });

  it('returns blanks when the number is incomplete', () => {
    expect(splitUsPhone('555-0199')).toEqual(['', '', '']);
  });
});

describe('formatIsrfDate / gender', () => {
  it('formats ISO dates as MMDDYYYY without UTC shift', () => {
    expect(formatIsrfDate('1990-01-15')).toBe('01151990');
    expect(formatIsrfDate('03/02/1988')).toBe('03021988');
    expect(displayIsrfDateBox('03021988')).toBe('03/02/1988');
  });

  it('formats today as an 8-digit New York calendar date', () => {
    expect(todayIsrfDate(new Date('2026-08-28T16:00:00Z'))).toBe('08282026');
  });

  it('normalizes M/F to Male/Female', () => {
    expect(normalizeIsrfGender('m')).toBe('Male');
    expect(normalizeIsrfGender('Female')).toBe('Female');
    expect(normalizeIsrfGender('other')).toBe('');
  });
});

describe('buildIsrfFieldValues', () => {
  it('maps intake identity, address, phone, and ESL barrier', () => {
    const { text, radios } = buildIsrfFieldValues(
      {
        firstName: 'Ana',
        lastName: 'Cruz',
        dob: '1988-03-02',
        startDate: '2026-09-08',
        address: '123 Main St',
        apt: '4B',
        city: 'Bronx',
        state: 'NY',
        zip: '10451',
        phone: '2125550199',
        email: 'ana@schools.nyc.gov',
        gender: 'F',
        educationStatus: 'ESL',
      },
        { completedBy: 'Jane Lead', signedOn: '08/28/2026' },
    );

    expect(text['First Name']).toBe('Ana');
    expect(text['Last Name']).toBe('Cruz');
    expect(text['Birth Date']).toBe('03021988');
    expect(text['Original Program Start Date']).toBe('09082026');
    expect(text['date of signature']).toBe('08282026');
    expect(text.Address).toBe('123 Main St, 4B');
    expect(text.Phone).toBe('212');
    expect(text.undefined).toBe('555');
    expect(text.undefined_2).toBe('0199');
    expect(text.email).toBe('ana@schools.nyc.gov');
    expect(text['Form Completed By Please Print']).toBe('Jane Lead');
    expect(radios['Gender Required']).toBe('Female');
    expect(radios['English Language Leraner']).toBe('Choice3');
    expect(radios['Low Levels Literacy']).toBeUndefined();
    expect(text.MI).toBe('');
  });

  it('maps dual phones, race, employment, hispanic origin, and explicit barriers', () => {
    const { text, radios, checkboxes } = buildIsrfFieldValues({
      middleInitial: 'M',
      homePhone: '2125550199',
      cellPhone: '9175550100',
      emergencyContactNameRelationship: 'Maria Cruz / Mother',
      emergencyContactPhone: '7185550111',
      employmentStatus: 'unemployed-seeking',
      hispanicLatinoOrigin: 'hispanic',
      raceIdentities: ['asian', 'latino'],
      isHomeless: 'Y',
      isEnglishLanguageLearner: 'N',
      educationStatus: 'ESL',
    });
    expect(text.MI).toBe('M');
    expect(text.Phone).toBe('212');
    expect(text.Mobile).toBe('917');
    expect(text['of Contact']).toBe('Maria Cruz / Mother');
    expect(text.Emergency).toBe('718');
    expect(radios['Hispanic/Latino']).toBe('Male');
    expect(radios.Homeless).toBe('Choice1');
    expect(radios['English Language Leraner']).toBe('Choice4');
    expect(checkboxes['Unemployed  Seeking Employment']).toBe(true);
    expect(checkboxes.Asian).toBe(true);
    expect(checkboxes.Latinoa).toBe(true);
  });

  it('marks BE as low literacy and prefers original start date', () => {
    const { text, radios } = buildIsrfFieldValues({
      educationStatus: 'BE',
      originalStartDate: '2025-01-10',
      startDate: '2026-09-08',
    });
    expect(text['Original Program Start Date']).toBe('01102025');
    expect(radios['Low Levels Literacy']).toBe('Choice1');
    expect(radios['English Language Leraner']).toBeUndefined();
  });

  it('does not invent SSN or ethnicity fields', () => {
    const { text } = buildIsrfFieldValues({ firstName: 'Test' });
    expect(text['NOTE Data matching for Employmentrelated outcomes will not be available if SS is not recorded Manual followup will be required after exit']).toBeUndefined();
  });
});

describe('isrfDownloadFilename', () => {
  it('builds a safe filename from name and student id', () => {
    expect(isrfDownloadFilename({ lastName: 'Cruz', firstName: 'Ana', studentId: 'A123' }))
      .toBe('ISRF-Cruz-Ana-A123.pdf');
  });
});
