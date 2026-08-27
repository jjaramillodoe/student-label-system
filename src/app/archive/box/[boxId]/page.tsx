import { headers } from 'next/headers';
import { loadPublicArchiveBox } from '@/lib/loadPublicArchiveBox';
import ArchiveBoxPublicView from '@/components/ArchiveBoxPublicView';
import PublicRecordNotFound from '@/components/PublicRecordNotFound';

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

export default async function ArchiveBoxPage({
  params,
}: {
  params: Promise<{ boxId: string }>;
}) {
  const { boxId } = await params;
  const [data, origin] = await Promise.all([
    loadPublicArchiveBox(decodeURIComponent(boxId || '')),
    requestOrigin(),
  ]);

  if (!data) {
    return (
      <PublicRecordNotFound
        title="Archive box not found."
        detail={`Box ID: ${boxId}`}
      />
    );
  }

  return <ArchiveBoxPublicView data={data} origin={origin} />;
}
