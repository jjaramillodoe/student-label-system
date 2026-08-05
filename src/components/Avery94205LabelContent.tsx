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
  LABEL_SEQ_FONT_SIZE_PT,
  labelNameFontSizePt,
} from '@/lib/avery94205LabelStyle';
import { formatLabelName, formatLabelSequence } from '@/lib/personName';

export interface Avery94205LabelStudent {
  firstName: string;
  lastName: string;
  dob: string;
  labelId?: string;
  studentId?: string;
}

function getLabelId(student: Avery94205LabelStudent) {
  return student.labelId || student.studentId || '';
}

/** Inner content for one Avery 94205 label: same layout as 5163, scaled for 1.5"×3.75". */
export default function Avery94205LabelContent({
  student,
  sequence,
}: {
  student: Avery94205LabelStudent;
  /** 1-based print-batch sequence (shown as 00001, 00002, …) */
  sequence?: number;
}) {
  const fullName = formatLabelName(student);
  const labelId = getLabelId(student);
  const qrPayload = buildStudentQrPayload({ studentId: labelId });
  const nameSizePt = labelNameFontSizePt(fullName);
  const seqText = sequence != null ? formatLabelSequence(sequence) : '';

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
            overflowWrap: 'anywhere',
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
            marginBottom: seqText ? '0.035in' : LABEL_DOB_TO_BARCODE_GAP,
          }}
        >
          DOB: {student.dob}
        </div>

        {seqText ? (
          <div
            style={{
              fontSize: `${LABEL_SEQ_FONT_SIZE_PT}pt`,
              fontWeight: 700,
              letterSpacing: '0.06em',
              lineHeight: 1.2,
              marginBottom: LABEL_DOB_TO_BARCODE_GAP,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {seqText}
          </div>
        ) : null}

        {labelId && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Barcode value={labelId} width={1.15} height={26} fontSize={7} margin={0} />
          </div>
        )}
      </div>

      {labelId && (
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '0.02in',
          }}
        >
          <QRCode
            value={qrPayload}
            size={280}
            level="M"
            containerStyle={{ width: LABEL_QR_SIZE_IN, height: LABEL_QR_SIZE_IN, flexShrink: 0 }}
          />
        </div>
      )}
    </div>
  );
}
