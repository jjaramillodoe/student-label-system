import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

/** Shown when an admin diagnostic scan hit ADMIN_SCAN_STUDENT_CAP. */
export default function ScanTruncatedAlert({
  truncated,
  scanned,
  cap,
}: {
  truncated?: boolean;
  scanned?: number;
  cap?: number;
}) {
  if (!truncated) return null;
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Scan capped</AlertTitle>
      <AlertDescription>
        This review loaded {scanned ?? cap} student records
        {cap != null ? ` (cap ${cap.toLocaleString()})` : ''}. Additional students were
        not scanned, so results may be incomplete.
      </AlertDescription>
    </Alert>
  );
}
