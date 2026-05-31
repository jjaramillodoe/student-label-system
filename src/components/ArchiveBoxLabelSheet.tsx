'use client';

import QRCodeComponent from '@/components/QRCode';
import {
  formatBoxCabinetLabel,
  formatStudentLine,
  getBoxPublicUrl,
  type BoxLabelArchive,
  type BoxLabelBox,
  type BoxLabelStudent,
} from '@/lib/boxLabel';

type ArchiveBoxLabelSheetProps = {
  box: BoxLabelBox;
  archive: BoxLabelArchive;
  students: BoxLabelStudent[];
  origin?: string;
  showScreenPreview?: boolean;
};

export default function ArchiveBoxLabelSheet({
  box,
  archive,
  students,
  origin,
  showScreenPreview = true,
}: ArchiveBoxLabelSheetProps) {
  const boxUrl = getBoxPublicUrl(box._id, origin);
  const cabinetLabel = formatBoxCabinetLabel(archive);

  return (
    <>
      <div
        id="archive-box-label-print"
        className={
          showScreenPreview
            ? 'rounded-lg border bg-white text-black p-4 max-h-[60vh] overflow-auto'
            : 'bg-white text-black p-4'
        }
      >
        <div className="box-label-page-1 box-label-header flex flex-col items-center text-center gap-3 border-b border-black/20 pb-4 mb-4">
          <div>
            <h1 className="text-lg font-bold leading-tight">{box.label}</h1>
            <p className="text-sm mt-1">{cabinetLabel}{archive.school ? ` · ${archive.school}` : ''}</p>
            <p className="text-sm">{archive.location}</p>
            <p className="text-xs mt-1 text-black/70">
              {archive.schoolYear}
              {archive.archiveDate ? ` · Archived ${archive.archiveDate}` : ''}
              {' · '}
              {students.length || box.currentCount || 0} student file(s)
            </p>
          </div>
          <QRCodeComponent
            value={boxUrl}
            size={200}
            level="M"
            containerStyle={{ width: '1.75in', height: '1.75in' }}
          />
          <p className="text-[10px] break-all max-w-full font-mono text-black/80">{boxUrl}</p>
          <p className="text-[10px] text-black/70">Scan to open the public box page and full student list</p>
        </div>

        <div className="box-label-page-2 box-label-students">
          <h2 className="text-sm font-bold mb-2 uppercase tracking-wide">
            Student files in this box ({students.length})
          </h2>
          {students.length === 0 ? (
            <p className="text-sm text-black/60 italic">No students assigned to this box yet.</p>
          ) : (
            <pre className="box-label-student-list text-[9px] leading-snug font-mono whitespace-pre-wrap columns-2 gap-x-6">
              {students.map((student, index) => formatStudentLine(student, index)).join('\n')}
            </pre>
          )}

          <p className="box-label-footer text-[9px] text-center text-black/50 mt-4 pt-2 border-t border-black/10">
            Adult Education Archive · Do not discard before records retention period ends
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #archive-box-label-print,
          #archive-box-label-print * {
            visibility: visible !important;
          }
          #archive-box-label-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .box-label-page-1 {
            page-break-after: always;
            break-after: page;
            padding: 0.4in 0.5in 0.35in !important;
            border: none !important;
            margin: 0 !important;
          }
          .box-label-page-2 {
            padding: 0.35in 0.5in 0.4in !important;
          }
          .box-label-student-list {
            column-count: 2 !important;
            column-gap: 0.4in !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
            white-space: pre-wrap !important;
          }
          .box-label-footer {
            column-span: all;
          }
          @page {
            margin: 0;
            size: letter portrait;
          }
        }
      `}</style>
    </>
  );
}
