import { Search } from 'lucide-react';
import { HistoryBackButton } from '@/components/PublicRecordActions';

export default function PublicRecordNotFound({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 gap-4 text-center">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-8 max-w-sm w-full">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Search className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {detail && <p className="text-sm text-gray-500 mt-2 break-all">{detail}</p>}
        <div className="mt-6 flex justify-center">
          <HistoryBackButton variant="outline" size="sm" className="gap-2" label="Go Back" />
        </div>
      </div>
    </div>
  );
}
