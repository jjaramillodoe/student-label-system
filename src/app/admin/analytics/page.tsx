'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const AnalyticsClient = dynamic(() => import('./AnalyticsClient'), {
  ssr: false,
  loading: () => (
    <div className="p-6">
      <Skeleton className="h-96 w-full" />
    </div>
  ),
});

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
