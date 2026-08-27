'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ReportsClient = dynamic(() => import('./ReportsClient'), {
  ssr: false,
  loading: () => (
    <div className="p-6">
      <Skeleton className="h-96 w-full" />
    </div>
  ),
});

export default function ReportsPage() {
  return <ReportsClient />;
}
