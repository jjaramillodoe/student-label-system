'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2, Printer } from 'lucide-react';
import Link from 'next/link';
import ArchiveBoxLabelSheet from '@/components/ArchiveBoxLabelSheet';
import ArchiveBoxPdfButton from '@/components/ArchiveBoxPdfButton';
import { Button } from '@/components/ui/button';
import { getBoxPublicUrl } from '@/lib/boxLabel';
import type { BoxLabelArchive, BoxLabelBox, BoxLabelStudent } from '@/lib/boxLabel';

export default function ArchiveBoxLabelPage() {
  const { boxId } = useParams<{ boxId: string }>();
  const [box, setBox] = useState<BoxLabelBox | null>(null);
  const [archive, setArchive] = useState<BoxLabelArchive | null>(null);
  const [students, setStudents] = useState<BoxLabelStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/archive/box?boxId=${encodeURIComponent(boxId)}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Archive box not found.' : 'Failed to load archive box.');
          return;
        }
        const data = await res.json();
        setBox(data.box);
        setArchive(data.archive);
        setStudents(data.students || []);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [boxId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading box label…
      </div>
    );
  }

  if (error || !box || !archive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p>{error || 'Not found'}</p>
        <Button variant="outline" asChild>
          <Link href={`/archive/box/${boxId}`}>Back to box</Link>
        </Button>
      </div>
    );
  }

  const publicUrl = getBoxPublicUrl(box._id, origin);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-background px-4 py-3 flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/archive/box/${boxId}`}>
            <ArrowLeft size={18} />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Printable box label</p>
          <h1 className="font-semibold truncate">{box.label}</h1>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> Public page
          </a>
        </Button>
        <Button className="gap-2" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
        <ArchiveBoxPdfButton
          className="gap-2"
          box={box}
          archive={archive}
          students={students}
          origin={origin}
        />
      </div>

      <div className="max-w-3xl mx-auto p-4">
        <ArchiveBoxLabelSheet
          box={box}
          archive={archive}
          students={students}
          origin={origin}
        />
      </div>
    </div>
  );
}
