/** Product attribution — District 79 Data Systems */
export const PRODUCT_DEVELOPER = {
  name: 'Javier Jaramillo',
  title: 'Data Systems Coordinator',
  organization: 'District 79',
  organizationFull: 'NYC DOE District 79 Adult Education',
  email: 'jjaramillo7@schools.nyc.gov',
} as const;

export function developerCreditLine(): string {
  return `Developed by ${PRODUCT_DEVELOPER.name}, ${PRODUCT_DEVELOPER.title} at ${PRODUCT_DEVELOPER.organization}`;
}

export function developerCreditShort(): string {
  return `${PRODUCT_DEVELOPER.name} · ${PRODUCT_DEVELOPER.title}, ${PRODUCT_DEVELOPER.organization}`;
}
