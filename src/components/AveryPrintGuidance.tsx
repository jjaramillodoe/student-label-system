'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { AveryDocxLayout } from '@/lib/downloadAveryDocx';

const COPY: Record<AveryDocxLayout, ReactNode> = {
  avery5163: (
    <>
      Download the Word Doc, then print from Word on <strong>Letter&nbsp;(8.5"×11")</strong> at&nbsp;
      <strong>100%</strong> with margins&nbsp;<strong>None</strong>
    </>
  ),
  avery94205: (
    <>
      Avery 94205 — download Word Doc, then print clear <strong>1.5"×3.75"</strong> labels from Word
      on <strong>Letter</strong> at&nbsp;<strong>100%</strong>
    </>
  ),
};

export default function AveryPrintGuidance({
  layout = 'avery5163',
  className = '',
}: {
  layout?: AveryDocxLayout;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1 ${className}`}
    >
      <Info size={13} className="shrink-0" />
      <span>{COPY[layout]}</span>
    </div>
  );
}
