/** Product attribution — District 79 Data Systems */
export const PRODUCT_DEVELOPER = {
  name: 'Javier Jaramillo',
  title: 'Data Systems Coordinator',
  organization: 'District 79',
  organizationFull: 'NYC DOE District 79 Adult Education',
  email: 'jjaramillo7@schools.nyc.gov',
} as const;

/** Family dedication shown on /about */
export const PRODUCT_DEDICATION = {
  headline: 'Dedicated with love',
  to: [
    { name: 'Cris', relation: 'my wife' },
    { name: 'Mateo', relation: 'my son' },
    { name: 'Sofia', relation: 'my daughter' },
  ],
  note:
    'For the patience, encouragement, and quiet hours that made this work possible — and for reminding me why tools that help people matter.',
} as const;

/** Professional acknowledgements shown on /about */
export const PRODUCT_ACKNOWLEDGEMENTS = {
  headline: 'With gratitude',
  leaders: [
    { name: 'Glenda Esperance Superintendent', note: 'for believing in this vision' },
    { name: 'Najat Amachki Director of Research and Evaluation', note: 'for believing in this vision' },
  ],
  body:
    'Special thanks to Glenda Esperance and Najat Amachki for believing in me and in this idea — and for the support that made it possible to build the Student Label System for Adult Education staff across our schools.',
  staffNote:
    'This tool exists to lighten daily intake, labeling, and filing work so school teams can spend more time with students.',
} as const;

export function developerCreditLine(): string {
  return `Developed by ${PRODUCT_DEVELOPER.name}, ${PRODUCT_DEVELOPER.title} at ${PRODUCT_DEVELOPER.organization}`;
}

export function developerCreditShort(): string {
  return `${PRODUCT_DEVELOPER.name} · ${PRODUCT_DEVELOPER.title}, ${PRODUCT_DEVELOPER.organization}`;
}

export function dedicationLine(): string {
  const names = PRODUCT_DEDICATION.to.map((p) => p.name).join(', ');
  return `Dedicated to ${names}`;
}
