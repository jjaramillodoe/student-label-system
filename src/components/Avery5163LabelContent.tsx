import Barcode from 'react-barcode';
import QRCode from './QRCode';
import { buildStudentQrPayload } from '@/lib/qrPayload';
import {
  LABEL_COLUMN_GAP,
  LABEL_CONTENT_INSET_LEFT,
  LABEL_CONTENT_INSET_TOP,
  LABEL_DOB_FONT_SIZE_PT,
  LABEL_DOB_TO_BARCODE_GAP,
  LABEL_FONT_FAMILY,
  LABEL_NAME_TO_DOB_GAP,
  LABEL_QR_SIZE_IN,
  labelNameFontSizePt,
} from '@/lib/avery5163LabelStyle';

export interface Avery5163LabelStudent {
  firstName: string;
  lastName: string;
  dob: string;
  labelId?: string;
  studentId?: string;
}

function getLabelId(student: Avery5163LabelStudent) {
  return student.labelId || student.studentId || '';
}

/** Inner content for one Avery 5163 label: name/DOB/barcode left, QR right. */
export default function Avery5163LabelContent({ student }: { student: Avery5163LabelStudent }) {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const labelId = getLabelId(student);
  const qrPayload = buildStudentQrPayload({ studentId: labelId });
  const nameSizePt = labelNameFontSizePt(fullName);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        alignItems: 'stretch',
        gap: LABEL_COLUMN_GAP,
        paddingLeft: LABEL_CONTENT_INSET_LEFT,
        paddingTop: LABEL_CONTENT_INSET_TOP,
        boxSizing: 'border-box',
        fontFamily: LABEL_FONT_FAMILY,
      }}
    >
      <div
        style={{
          flex: '1 1 52%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: `${nameSizePt}pt`,
            lineHeight: 1.25,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            marginBottom: LABEL_NAME_TO_DOB_GAP,
          }}
        >
          {fullName}
        </div>

        <div
          style={{
            fontSize: `${LABEL_DOB_FONT_SIZE_PT}pt`,
            lineHeight: 1.3,
            fontWeight: 400,
            marginBottom: LABEL_DOB_TO_BARCODE_GAP,
          }}
        >
          DOB: {student.dob}
        </div>

        {labelId && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Barcode value={labelId} width={1.25} height={32} fontSize={8} margin={0} />
          </div>
        )}
      </div>

      {labelId && (
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QRCode
            value={qrPayload}
            size={320}
            level="M"
            containerStyle={{ width: LABEL_QR_SIZE_IN, height: LABEL_QR_SIZE_IN, flexShrink: 0 }}
          />
        </div>
      )}
    </div>
  );
}
