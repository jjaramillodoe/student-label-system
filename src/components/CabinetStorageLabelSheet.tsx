'use client';

import QRCodeComponent from '@/components/QRCode';
import type { StorageLabelItem } from '@/lib/cabinetLabel';

type Props = {
  labels: StorageLabelItem[];
  showScreenPreview?: boolean;
};

const KIND_BADGE: Record<StorageLabelItem['kind'], string> = {
  cabinet: 'CABINET',
  drawer: 'DRAWER',
  section: 'SECTION',
};

export default function CabinetStorageLabelSheet({
  labels,
  showScreenPreview = true,
}: Props) {
  return (
    <>
      <div
        id="cabinet-storage-label-print"
        className={
          showScreenPreview
            ? 'rounded-lg border bg-white text-black p-3 max-h-[60vh] overflow-auto'
            : 'bg-white text-black p-3'
        }
      >
        <div className="cabinet-label-grid grid grid-cols-2 gap-3">
          {labels.map((label) => (
            <div
              key={label.id}
              className="cabinet-label-card break-inside-avoid border-2 border-black rounded-md p-3 flex flex-col items-center text-center gap-2 min-h-[2.6in]"
            >
              <div className="text-[10px] font-bold tracking-widest uppercase text-black/70">
                {KIND_BADGE[label.kind]}
              </div>
              <div className="text-base font-bold leading-tight">{label.title}</div>
              <div className="text-xs leading-snug">{label.subtitle}</div>
              {label.line3 ? (
                <div className="text-[10px] text-black/70">{label.line3}</div>
              ) : null}
              <QRCodeComponent
                value={label.qrValue}
                size={120}
                level="M"
                containerStyle={{ width: '1.1in', height: '1.1in' }}
              />
              <p className="text-[8px] font-mono break-all text-black/60 max-w-full">
                {label.qrValue}
              </p>
              <p className="text-[9px] text-black/50 mt-auto">
                Adult Education · Storage label
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cabinet-storage-label-print,
          #cabinet-storage-label-print * { visibility: visible !important; }
          #cabinet-storage-label-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            padding: 0.25in !important;
            margin: 0 !important;
            background: white !important;
          }
          .cabinet-label-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 0.2in !important;
          }
          .cabinet-label-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @page { size: letter; margin: 0.4in; }
        }
      `}</style>
    </>
  );
}
