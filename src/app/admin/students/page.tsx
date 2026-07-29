import { redirect } from 'next/navigation';

/** Legacy admin students UI — use All Students instead. */
export default function AdminStudentsRedirectPage() {
  redirect('/admin/students/all');
}
