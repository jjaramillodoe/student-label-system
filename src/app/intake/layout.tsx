import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Intake — Adult Education',
  description: 'Register new students and print their label.',
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  // Intentionally plain — no shared Header/Footer/AdminHeader so intake kiosk
  // is distraction-free and works without the main navigation.
  return <>{children}</>;
}
