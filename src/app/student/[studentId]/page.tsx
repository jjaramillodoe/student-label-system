import { loadPublicStudentLookup } from '@/lib/loadPublicStudent';
import StudentPublicView from '@/components/StudentPublicView';
import PublicRecordNotFound from '@/components/PublicRecordNotFound';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const student = await loadPublicStudentLookup(decodeURIComponent(studentId || ''));

  if (!student) {
    return (
      <PublicRecordNotFound
        title="Student not found."
        detail={`ID: ${studentId}`}
      />
    );
  }

  return <StudentPublicView student={student} />;
}
