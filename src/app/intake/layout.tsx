import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Intake — Adult Education',
  description: 'Register new and returning students at the front desk.',
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  // Front-desk kiosk: no sidebar. The page reuses AppTopBar so staff get
  // the same header chrome as the dashboard.
  return <>{children}</>;
}
