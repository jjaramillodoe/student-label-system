import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Intake — Adult Education',
  description: 'Register new and returning students at the front desk.',
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  // Staff see AppShell (sidebar + workspace bar). Intake Members stay kiosk.
  return <>{children}</>;
}
