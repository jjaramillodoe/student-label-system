import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Intake — Adult Education',
  description: 'Register new and returning students at the front desk.',
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  // Intentionally plain — AppShell skips /intake so the front-desk kiosk
  // stays distraction-free without the left sidebar.
  return <>{children}</>;
}
