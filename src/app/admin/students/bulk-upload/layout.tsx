import { notFound } from 'next/navigation';
import { BULK_UPLOAD_STUDENTS_ENABLED } from '@/lib/features';

export default function BulkUploadLayout({ children }: { children: React.ReactNode }) {
  if (!BULK_UPLOAD_STUDENTS_ENABLED) notFound();
  return children;
}
